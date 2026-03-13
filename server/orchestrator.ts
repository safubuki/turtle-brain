import { randomUUID } from 'crypto';

export type AgentRole = 'Participant' | 'Facilitator';
export type SessionMode = 'conversation' | 'meeting';

export interface AgentProfileInput {
  id: string;
  name: string;
  role: AgentRole;
  stance: string;
  personality: string;
  model: string;
  runtimeSessionId: string | null;
  status: 'idle' | 'thinking' | 'speaking' | 'raising_hand';
  handRaiseIntensity: number;
  speakCount: number;
}

export interface MessageRecord {
  id: string;
  agentId: string;
  content: string;
  summary: string;
  timestamp: number;
}

export interface CodexExecResult {
  response: string;
  sessionId: string | null;
}

export interface OrchestratorDebugSnapshot {
  sessionId: string;
  turn: number;
  selectedSpeakerId: string | null;
  dispatchReason: string;
  facilitator: {
    agentId: string;
    runtimeSessionId: string | null;
    overview: string;
    rationale: string;
    nextFocus: string;
    selectedAgentId: string | null;
    inviteAgentIds: string[];
    interventionPriority: number;
    shouldIntervene: boolean;
  } | null;
  scores: Array<{
    agentId: string;
    runtimeSessionId: string | null;
    score: number;
    confidence: number;
    desiredAction: string;
    reason: string;
  }>;
  workers: Array<{
    workerId: string;
    kind: 'score' | 'moderation' | 'speech' | 'synthesis';
    targetAgentId?: string;
    startedAt: number;
    finishedAt: number;
    durationMs: number;
  }>;
  agentSessions: Array<{
    agentId: string;
    runtimeSessionId: string | null;
    inboxCount: number;
    outboxCount: number;
  }>;
  log: Array<{
    turn: number;
    kind: 'message' | 'moderation' | 'synthesis';
    summary: string;
    timestamp: number;
  }>;
}

export interface RunTurnRequest {
  sessionId?: string;
  topic: string;
  sessionMode: SessionMode;
  turnLimit: number;
  agents: AgentProfileInput[];
}

export interface RunTurnResponse {
  sessionId: string;
  agents: AgentProfileInput[];
  messages: MessageRecord[];
  currentTurn: number;
  sessionStatus: 'idle' | 'running' | 'finished';
  finalConclusion: string | null;
  debug: OrchestratorDebugSnapshot | null;
}

interface MailboxItem {
  id: string;
  fromAgentId: string;
  kind: 'message' | 'facilitator-note' | 'system';
  content: string;
  summary: string;
  timestamp: number;
}

interface RuntimeAgent extends AgentProfileInput {
  inbox: MailboxItem[];
  outbox: MailboxItem[];
}

interface FacilitatorDecision {
  overview: string;
  rationale: string;
  nextFocus: string;
  selectedAgentId: string | null;
  inviteAgentIds: string[];
  interventionPriority: number;
  shouldIntervene: boolean;
}

interface ScoreDecision {
  agentId: string;
  runtimeSessionId: string | null;
  score: number;
  confidence: number;
  desiredAction: string;
  reason: string;
}

interface MeetingSession {
  id: string;
  topic: string;
  mode: SessionMode;
  turnLimit: number;
  currentTurn: number;
  status: 'idle' | 'running' | 'finished';
  agents: RuntimeAgent[];
  messages: MessageRecord[];
  finalConclusion: string | null;
  debug: OrchestratorDebugSnapshot | null;
  log: OrchestratorDebugSnapshot['log'];
}

type CodexRunner = (model: string, prompt: string, sessionId?: string) => Promise<CodexExecResult>;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function summarizeResponse(response: string): string {
  const firstSentenceEnd = response.indexOf('。');
  if (firstSentenceEnd > 0 && firstSentenceEnd < 80) {
    return response.substring(0, firstSentenceEnd + 1);
  }
  if (firstSentenceEnd > 80) {
    return response.substring(0, 40) + '…';
  }
  return response.length > 50 ? response.substring(0, 50) + '…' : response;
}

function cloneAgent(agent: AgentProfileInput): RuntimeAgent {
  return {
    ...agent,
    runtimeSessionId: agent.runtimeSessionId ?? null,
    status: 'idle',
    handRaiseIntensity: 0,
    speakCount: 0,
    inbox: [],
    outbox: []
  };
}

function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

function trimMailbox(items: MailboxItem[], maxItems = 12): MailboxItem[] {
  return items.slice(-maxItems);
}

function getRecentTranscript(session: MeetingSession, limit = 8): string {
  return session.messages
    .slice(-limit)
    .map((message) => {
      const agent = session.agents.find((entry) => entry.id === message.agentId);
      return `${agent?.name ?? message.agentId}: ${message.content}`;
    })
    .join(' --- ');
}

function getNextConversationSpeaker(session: MeetingSession): RuntimeAgent {
  const participants = session.agents.filter((agent) => agent.role === 'Participant').slice(0, 2);
  if (participants.length === 0) {
    return session.agents[0];
  }
  if (participants.length === 1 || session.messages.length === 0) {
    return [...participants].sort((left, right) => left.speakCount - right.speakCount)[0];
  }
  const lastSpeakerId = session.messages[session.messages.length - 1].agentId;
  return participants.find((agent) => agent.id !== lastSpeakerId) ?? participants[0];
}

export class MeetingOrchestrator {
  private readonly sessions = new Map<string, MeetingSession>();

  constructor(private readonly runCodex: CodexRunner) {}

  async runTurn(input: RunTurnRequest): Promise<RunTurnResponse> {
    const session = input.sessionId && this.sessions.has(input.sessionId)
      ? this.sessions.get(input.sessionId)!
      : this.createSession(input);

    session.status = 'running';

    const totalTurns = session.turnLimit * session.agents.length;
    if (session.currentTurn > totalTurns) {
      await this.finalizeSession(session);
      return this.serializeSession(session);
    }

    if (session.mode === 'conversation') {
      await this.runConversationTurn(session);
    } else {
      await this.runMeetingTurn(session);
    }

    session.currentTurn += 1;

    if (session.currentTurn > totalTurns) {
      await this.finalizeSession(session);
    }

    return this.serializeSession(session);
  }

  private createSession(input: RunTurnRequest): MeetingSession {
    const id = input.sessionId ?? randomUUID();
    const session: MeetingSession = {
      id,
      topic: input.topic,
      mode: input.sessionMode,
      turnLimit: input.turnLimit,
      currentTurn: 1,
      status: 'idle',
      agents: input.agents.map(cloneAgent),
      messages: [],
      finalConclusion: null,
      debug: null,
      log: []
    };
    this.sessions.set(id, session);
    return session;
  }

  private serializeSession(session: MeetingSession): RunTurnResponse {
    return {
      sessionId: session.id,
      agents: session.agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        stance: agent.stance,
        personality: agent.personality,
        model: agent.model,
        runtimeSessionId: agent.runtimeSessionId,
        status: agent.status,
        handRaiseIntensity: agent.handRaiseIntensity,
        speakCount: agent.speakCount
      })),
      messages: session.messages,
      currentTurn: session.currentTurn,
      sessionStatus: session.status,
      finalConclusion: session.finalConclusion,
      debug: session.debug
    };
  }

  private async runConversationTurn(session: MeetingSession): Promise<void> {
    const speaker = getNextConversationSpeaker(session);
    const prompt = this.buildConversationPrompt(session, speaker);
    const startedAt = Date.now();
    const result = await this.runCodex(speaker.model, prompt, speaker.runtimeSessionId ?? undefined);
    const finishedAt = Date.now();

    speaker.runtimeSessionId = result.sessionId;
    speaker.status = 'idle';
    speaker.speakCount += 1;

    const message = this.recordMessage(session, speaker, result.response, 'message');
    this.deliverMessage(session, speaker.id, message);

    session.agents.forEach((agent) => {
      agent.handRaiseIntensity = agent.id === speaker.id ? 100 : 0;
    });

    session.debug = {
      sessionId: session.id,
      turn: session.currentTurn,
      selectedSpeakerId: speaker.id,
      dispatchReason: 'Conversation モードでは直前とは別の参加者が交互に応答します。',
      facilitator: null,
      scores: session.agents
        .filter((agent) => agent.role === 'Participant')
        .map((agent) => ({
          agentId: agent.id,
          runtimeSessionId: agent.runtimeSessionId,
          score: agent.id === speaker.id ? 100 : 0,
          confidence: 100,
          desiredAction: agent.id === speaker.id ? 'respond' : 'wait',
          reason: agent.id === speaker.id ? '交互応答の順番になったため選出。' : '相手の返答待ち。'
        })),
      workers: [{
        workerId: `speech:${speaker.id}`,
        kind: 'speech',
        targetAgentId: speaker.id,
        startedAt,
        finishedAt,
        durationMs: finishedAt - startedAt
      }],
      agentSessions: session.agents.map((agent) => ({
        agentId: agent.id,
        runtimeSessionId: agent.runtimeSessionId,
        inboxCount: agent.inbox.length,
        outboxCount: agent.outbox.length
      })),
      log: session.log.slice(-8)
    };
  }

  private async runMeetingTurn(session: MeetingSession): Promise<void> {
    const facilitator = session.agents.find((agent) => agent.role === 'Facilitator') ?? null;
    const participants = session.agents.filter((agent) => agent.role === 'Participant');

    const workerRuns: OrchestratorDebugSnapshot['workers'] = [];

    const scoreTasks = participants.map(async (agent) => {
      const startedAt = Date.now();
      const score = await this.scoreParticipant(session, agent);
      const finishedAt = Date.now();
      workerRuns.push({
        workerId: `score:${agent.id}`,
        kind: 'score',
        targetAgentId: agent.id,
        startedAt,
        finishedAt,
        durationMs: finishedAt - startedAt
      });
      return score;
    });

    const facilitatorTask = facilitator
      ? (async () => {
          const startedAt = Date.now();
          const decision = await this.moderateMeeting(session, facilitator);
          const finishedAt = Date.now();
          workerRuns.push({
            workerId: `moderation:${facilitator.id}`,
            kind: 'moderation',
            targetAgentId: facilitator.id,
            startedAt,
            finishedAt,
            durationMs: finishedAt - startedAt
          });
          return decision;
        })()
      : Promise.resolve<FacilitatorDecision | null>(null);

    const [scores, facilitatorDecision] = await Promise.all([Promise.all(scoreTasks), facilitatorTask]);

    participants.forEach((agent) => {
      const score = scores.find((entry) => entry.agentId === agent.id);
      agent.handRaiseIntensity = score?.score ?? 0;
    });

    if (facilitatorDecision?.inviteAgentIds.length) {
      facilitatorDecision.inviteAgentIds.forEach((agentId) => {
        const target = session.agents.find((agent) => agent.id === agentId);
        if (!target) return;
        target.inbox = trimMailbox([
          ...target.inbox,
          {
            id: randomUUID(),
            fromAgentId: facilitator?.id ?? 'facilitator',
            kind: 'facilitator-note',
            content: facilitatorDecision.nextFocus,
            summary: `ファシリテーター依頼: ${facilitatorDecision.nextFocus}`,
            timestamp: Date.now()
          }
        ]);
      });
    }

    const { speaker, dispatchReason } = this.selectSpeaker(session, scores, facilitatorDecision, facilitator);
    const speechPrompt = this.buildMeetingPrompt(session, speaker, facilitatorDecision, scores);
    const speechStartedAt = Date.now();
    const result = await this.runCodex(speaker.model, speechPrompt, speaker.runtimeSessionId ?? undefined);
    const speechFinishedAt = Date.now();
    workerRuns.push({
      workerId: `speech:${speaker.id}`,
      kind: 'speech',
      targetAgentId: speaker.id,
      startedAt: speechStartedAt,
      finishedAt: speechFinishedAt,
      durationMs: speechFinishedAt - speechStartedAt
    });

    speaker.runtimeSessionId = result.sessionId;
    speaker.speakCount += 1;

    const kind = speaker.role === 'Facilitator' ? 'moderation' : 'message';
    const message = this.recordMessage(session, speaker, result.response, kind);
    this.deliverMessage(session, speaker.id, message);

    session.debug = {
      sessionId: session.id,
      turn: session.currentTurn,
      selectedSpeakerId: speaker.id,
      dispatchReason,
      facilitator: facilitator && facilitatorDecision ? {
        agentId: facilitator.id,
        runtimeSessionId: facilitator.runtimeSessionId,
        overview: facilitatorDecision.overview,
        rationale: facilitatorDecision.rationale,
        nextFocus: facilitatorDecision.nextFocus,
        selectedAgentId: facilitatorDecision.selectedAgentId,
        inviteAgentIds: facilitatorDecision.inviteAgentIds,
        interventionPriority: facilitatorDecision.interventionPriority,
        shouldIntervene: facilitatorDecision.shouldIntervene
      } : null,
      scores,
      workers: workerRuns,
      agentSessions: session.agents.map((agent) => ({
        agentId: agent.id,
        runtimeSessionId: agent.runtimeSessionId,
        inboxCount: agent.inbox.length,
        outboxCount: agent.outbox.length
      })),
      log: session.log.slice(-8)
    };
  }

  private async finalizeSession(session: MeetingSession): Promise<void> {
    if (session.finalConclusion) {
      session.status = 'finished';
      return;
    }

    const facilitator = session.agents.find((agent) => agent.role === 'Facilitator') ?? session.agents[0];
    const transcript = getRecentTranscript(session, 20);
    const prompt = `あなたは会議全体を取りまとめる役割です。テーマ「${session.topic}」についての議論を収束させてください。` +
      ` 次の形式で日本語でまとめてください: 1. 総括サマリー 2. 共通認識 3. 対立軸 4. 次のアクション。` +
      ` 議論ログ: ${transcript}`;
    const startedAt = Date.now();
    const result = await this.runCodex(facilitator.model, prompt, facilitator.runtimeSessionId ?? undefined);
    const finishedAt = Date.now();
    facilitator.runtimeSessionId = result.sessionId;
    session.finalConclusion = result.response;
    session.status = 'finished';
    session.log.push({
      turn: session.currentTurn,
      kind: 'synthesis',
      summary: summarizeResponse(result.response),
      timestamp: Date.now()
    });
    session.debug = {
      sessionId: session.id,
      turn: session.currentTurn,
      selectedSpeakerId: null,
      dispatchReason: '規定ターンに達したため、ファシリテーターが会議を収束して結論を生成しました。',
      facilitator: facilitator ? {
        agentId: facilitator.id,
        runtimeSessionId: facilitator.runtimeSessionId,
        overview: '会議全体を最終集約',
        rationale: '規定ターン到達により合意形成と総括を実施',
        nextFocus: '最終結論の提示',
        selectedAgentId: null,
        inviteAgentIds: [],
        interventionPriority: 100,
        shouldIntervene: true
      } : null,
      scores: [],
      workers: [{
        workerId: `synthesis:${facilitator.id}`,
        kind: 'synthesis',
        targetAgentId: facilitator.id,
        startedAt,
        finishedAt,
        durationMs: finishedAt - startedAt
      }],
      agentSessions: session.agents.map((agent) => ({
        agentId: agent.id,
        runtimeSessionId: agent.runtimeSessionId,
        inboxCount: agent.inbox.length,
        outboxCount: agent.outbox.length
      })),
      log: session.log.slice(-8)
    };
  }

  private buildConversationPrompt(session: MeetingSession, speaker: RuntimeAgent): string {
    const transcript = getRecentTranscript(session, 8);
    const inboxText = speaker.inbox.slice(-4).map((item) => item.summary).join(' / ');
    if (session.messages.length === 0) {
      return `テーマ「${session.topic}」について2人で対話を始めます。あなたは「${speaker.stance}」の立場、性格は「${speaker.personality}」です。` +
        ` 相手が受け取りやすいトーンで、最初の見解を2〜3文で述べてください。`;
    }

    return `テーマ「${session.topic}」について2人で対話中です。あなたは「${speaker.stance}」の立場、性格は「${speaker.personality}」です。` +
      ` 最近の対話: ${transcript}` +
      (inboxText ? ` 受け取っている論点: ${inboxText}` : '') +
      ` 相手の論点を一度受け止めてから、賛成・懸念・補足のいずれかを明確にし、次の応答が続くように問いを1つ添えて2〜3文で返答してください。`;
  }

  private async scoreParticipant(session: MeetingSession, agent: RuntimeAgent): Promise<ScoreDecision> {
    const transcript = getRecentTranscript(session, 8);
    const inboxText = agent.inbox.slice(-5).map((item) => item.summary).join(' / ');
    const prompt = `あなたは会議参加者「${agent.name}」です。スタンスは「${agent.stance}」、性格は「${agent.personality}」です。` +
      ` テーマは「${session.topic}」です。最近の議論: ${transcript || 'まだ開始直後です。'}` +
      (inboxText ? ` あなたの inbox: ${inboxText}` : '') +
      ` 今この瞬間に発言したい度合いを、以下の JSON だけで返してください。` +
      ` {"score":0-100,"confidence":0-100,"desiredAction":"agree|challenge|question|synthesize","reason":"短い説明"}`;
    const result = await this.runCodex(agent.model, prompt, agent.runtimeSessionId ?? undefined);
    agent.runtimeSessionId = result.sessionId;
    const parsed = extractJson<{ score?: number; confidence?: number; desiredAction?: string; reason?: string }>(result.response);
    return {
      agentId: agent.id,
      runtimeSessionId: agent.runtimeSessionId,
      score: clamp(parsed?.score ?? 40, 0, 100),
      confidence: clamp(parsed?.confidence ?? 50, 0, 100),
      desiredAction: parsed?.desiredAction ?? 'question',
      reason: parsed?.reason ?? '追加発言の必要性を要約できませんでした。'
    };
  }

  private async moderateMeeting(session: MeetingSession, facilitator: RuntimeAgent): Promise<FacilitatorDecision> {
    const transcript = getRecentTranscript(session, 10);
    const participantState = session.agents
      .filter((agent) => agent.role === 'Participant')
      .map((agent) => `${agent.name}: 発言${agent.speakCount}回, inbox${agent.inbox.length}件, stance=${agent.stance}, personality=${agent.personality}`)
      .join(' | ');
    const prompt = `あなたは会議のファシリテーターです。テーマは「${session.topic}」です。` +
      ` 参加者状態: ${participantState}` +
      ` 最近の議論: ${transcript || 'まだ議論開始直後です。'}` +
      ` 次に誰を話させるべきか、また自分が介入すべきかを判断し、以下の JSON だけを返してください。` +
      ` {"overview":"現状の整理","rationale":"判断理由","nextFocus":"次に深掘りすべき論点","selectedAgentId":"agent-id or null","inviteAgentIds":["agent-id"],"interventionPriority":0-100,"shouldIntervene":true|false}`;
    const result = await this.runCodex(facilitator.model, prompt, facilitator.runtimeSessionId ?? undefined);
    facilitator.runtimeSessionId = result.sessionId;
    const parsed = extractJson<Partial<FacilitatorDecision>>(result.response);
    return {
      overview: parsed?.overview ?? '現状の整理を取得できませんでした。',
      rationale: parsed?.rationale ?? '判断理由を取得できませんでした。',
      nextFocus: parsed?.nextFocus ?? '論点整理を継続',
      selectedAgentId: parsed?.selectedAgentId ?? null,
      inviteAgentIds: Array.isArray(parsed?.inviteAgentIds) ? parsed!.inviteAgentIds : [],
      interventionPriority: clamp(parsed?.interventionPriority ?? 40, 0, 100),
      shouldIntervene: Boolean(parsed?.shouldIntervene)
    };
  }

  private selectSpeaker(
    session: MeetingSession,
    scores: ScoreDecision[],
    facilitatorDecision: FacilitatorDecision | null,
    facilitator: RuntimeAgent | null
  ): { speaker: RuntimeAgent; dispatchReason: string } {
    const participants = session.agents.filter((agent) => agent.role === 'Participant');
    const ranked = participants
      .map((agent) => {
        const score = scores.find((entry) => entry.agentId === agent.id);
        const facilitatorBoost = facilitatorDecision?.selectedAgentId === agent.id ? 20 : 0;
        return {
          agent,
          baseScore: score?.score ?? 0,
          adjustedScore: (score?.score ?? 0) + facilitatorBoost,
          reason: score?.reason ?? '理由なし'
        };
      })
      .sort((left, right) => right.adjustedScore - left.adjustedScore);

    const bestParticipant = ranked[0]?.agent ?? session.agents[0];
    if (
      facilitator &&
      facilitatorDecision?.shouldIntervene &&
      facilitatorDecision.interventionPriority >= (ranked[0]?.adjustedScore ?? 0)
    ) {
      return {
        speaker: facilitator,
        dispatchReason: `ファシリテーターが介入を優先。理由: ${facilitatorDecision.rationale}`
      };
    }

    const topReason = ranked[0] ? `${ranked[0].agent.name} を選出。score=${ranked[0].adjustedScore} (${ranked[0].reason})` : '参加者が見つかりませんでした。';
    return {
      speaker: bestParticipant,
      dispatchReason: facilitatorDecision?.selectedAgentId === bestParticipant.id
        ? `${topReason}。ファシリテーター推薦を反映。`
        : topReason
    };
  }

  private buildMeetingPrompt(
    session: MeetingSession,
    speaker: RuntimeAgent,
    facilitatorDecision: FacilitatorDecision | null,
    scores: ScoreDecision[]
  ): string {
    const transcript = getRecentTranscript(session, 10);
    const inboxText = speaker.inbox.slice(-5).map((item) => item.summary).join(' / ');
    if (speaker.role === 'Facilitator') {
      return `あなたは会議のファシリテーターです。テーマは「${session.topic}」です。` +
        ` 現在の整理: ${facilitatorDecision?.overview ?? '整理情報なし'}` +
        ` 次の焦点: ${facilitatorDecision?.nextFocus ?? '論点整理'}` +
        ` 最近の議論: ${transcript || 'まだ開始直後です。'}` +
        ` 参加者に問いかけたり論点を整理したりして、会議を前進させる2〜3文を返してください。`;
    }

    const scoreInfo = scores.find((entry) => entry.agentId === speaker.id);
    return `あなたは会議参加者「${speaker.name}」です。スタンスは「${speaker.stance}」、性格は「${speaker.personality}」です。` +
      ` テーマは「${session.topic}」です。最近の議論: ${transcript || 'まだ開始直後です。'}` +
      (facilitatorDecision ? ` ファシリテーター整理: ${facilitatorDecision.overview}。次の焦点: ${facilitatorDecision.nextFocus}。` : '') +
      (inboxText ? ` あなたの inbox: ${inboxText}` : '') +
      (scoreInfo ? ` あなたが今話したい理由: ${scoreInfo.reason} (${scoreInfo.desiredAction})。` : '') +
      ` 他者の発言に具体的に触れながら、2〜3文で会議を前に進める発言をしてください。`;
  }

  private recordMessage(
    session: MeetingSession,
    speaker: RuntimeAgent,
    content: string,
    kind: 'message' | 'moderation'
  ): MessageRecord {
    const message: MessageRecord = {
      id: `msg-${Date.now()}-${randomUUID().slice(0, 6)}`,
      agentId: speaker.id,
      content,
      summary: summarizeResponse(content),
      timestamp: Date.now()
    };
    session.messages.push(message);
    session.log.push({
      turn: session.currentTurn,
      kind,
      summary: message.summary,
      timestamp: message.timestamp
    });
    return message;
  }

  private deliverMessage(session: MeetingSession, speakerId: string, message: MessageRecord): void {
    session.agents.forEach((agent) => {
      const envelope: MailboxItem = {
        id: randomUUID(),
        fromAgentId: speakerId,
        kind: 'message',
        content: message.content,
        summary: message.summary,
        timestamp: message.timestamp
      };

      if (agent.id === speakerId) {
        agent.outbox = trimMailbox([...agent.outbox, envelope]);
      } else {
        agent.inbox = trimMailbox([...agent.inbox, envelope]);
      }
    });
  }
}