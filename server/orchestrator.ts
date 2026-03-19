import { randomUUID } from 'crypto'
import { loadInputContext } from './contextLoader'
import type {
  AgentCliProvider,
  AgentRateLimits,
  CliExecResult,
  CliRunOptions,
  ReasoningEffort
} from './cliRunner'

export type AgentRole = 'Participant' | 'Facilitator'
export type DiscussionStyle = 'conversation' | 'meeting'

export interface AgentProfileInput {
  id: string
  name: string
  role: AgentRole
  stance: string
  personality: string
  provider: AgentCliProvider
  model: string
  reasoningEffort: ReasoningEffort
  runtimeSessionId: string | null
  rateLimits: AgentRateLimits | null
  status: 'idle' | 'thinking' | 'speaking' | 'raising_hand'
  handRaiseIntensity: number
  speakCount: number
}

export interface MessageRecord {
  id: string
  agentId: string
  content: string
  summary: string
  timestamp: number
}

export interface OrchestratorDebugSnapshot {
  sessionId: string
  turn: number
  selectedSpeakerId: string | null
  dispatchReason: string
  facilitator: {
    agentId: string
    runtimeSessionId: string | null
    overview: string
    rationale: string
    nextFocus: string
    selectedAgentId: string | null
    selectedAgentIds: string[]
    inviteAgentIds: string[]
    interventionPriority: number
    shouldIntervene: boolean
    parallelDispatch: boolean
  } | null
  scores: Array<{
    agentId: string
    runtimeSessionId: string | null
    score: number
    confidence: number
    desiredAction: string
    reason: string
  }>
  workers: Array<{
    workerId: string
    kind: 'score' | 'moderation' | 'speech' | 'synthesis'
    targetAgentId?: string
    startedAt: number
    finishedAt: number
    durationMs: number
  }>
  agentSessions: Array<{
    agentId: string
    runtimeSessionId: string | null
    inboxCount: number
    outboxCount: number
  }>
  log: Array<{
    turn: number
    kind: 'message' | 'moderation' | 'synthesis'
    summary: string
    timestamp: number
  }>
}

export interface RunTurnRequest {
  sessionId?: string
  topic: string
  inputPaths?: string[]
  discussionStyle: DiscussionStyle
  turnLimit: number
  agents: AgentProfileInput[]
}

export interface RunTurnResponse {
  sessionId: string
  agents: AgentProfileInput[]
  messages: MessageRecord[]
  currentTurn: number
  sessionStatus: 'idle' | 'running' | 'finished'
  finalConclusion: string | null
  debug: OrchestratorDebugSnapshot | null
}

interface MailboxItem {
  id: string
  fromAgentId: string
  kind: 'message' | 'facilitator-note' | 'system'
  content: string
  summary: string
  timestamp: number
}

interface RuntimeAgent extends AgentProfileInput {
  inbox: MailboxItem[]
  outbox: MailboxItem[]
}

interface FacilitatorDecision {
  overview: string
  rationale: string
  nextFocus: string
  selectedAgentId: string | null
  selectedAgentIds: string[]
  inviteAgentIds: string[]
  interventionPriority: number
  shouldIntervene: boolean
  parallelDispatch: boolean
}

interface ScoreDecision {
  agentId: string
  runtimeSessionId: string | null
  score: number
  confidence: number
  desiredAction: string
  reason: string
}

interface MeetingSession {
  id: string
  topic: string
  inputPaths: string[]
  inputContextPrompt: string
  inputContextWarnings: string[]
  discussionStyle: DiscussionStyle
  turnLimit: number
  currentTurn: number
  status: 'idle' | 'running' | 'finished'
  agents: RuntimeAgent[]
  messages: MessageRecord[]
  finalConclusion: string | null
  debug: OrchestratorDebugSnapshot | null
  log: OrchestratorDebugSnapshot['log']
}

type CliRunner = (options: CliRunOptions) => Promise<CliExecResult>

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function summarizeResponse(response: string): string {
  const normalized = response.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 80) {
    return normalized
  }

  return `${normalized.slice(0, 80).trim()}...`
}

function cloneAgent(agent: AgentProfileInput): RuntimeAgent {
  return {
    ...agent,
    runtimeSessionId: agent.runtimeSessionId ?? null,
    rateLimits: agent.rateLimits ?? null,
    status: 'idle',
    handRaiseIntensity: 0,
    speakCount: 0,
    inbox: [],
    outbox: []
  }
}

function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1] ?? text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    return null
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

function trimMailbox(items: MailboxItem[], maxItems = 12): MailboxItem[] {
  return items.slice(-maxItems)
}

function getRecentTranscript(session: MeetingSession, limit = 8): string {
  return session.messages
    .slice(-limit)
    .map((message) => {
      const agent = session.agents.find((entry) => entry.id === message.agentId)
      return `${agent?.name ?? message.agentId}: ${message.content}`
    })
    .join(' --- ')
}

function getSharedPromptContext(session: MeetingSession): string {
  const parts = [`テーマ: ${session.topic}`]

  if (session.inputContextPrompt) {
    parts.push(session.inputContextPrompt)
  }

  if (session.inputContextWarnings.length > 0) {
    parts.push(`入力コンテキストの注意:\n${session.inputContextWarnings.join('\n')}`)
  }

  return parts.join('\n\n')
}

function buildReasoningGuidance(reasoningEffort: ReasoningEffort): string {
  switch (reasoningEffort) {
    case 'low':
      return '推論強度は low。簡潔に答えてください。'
    case 'high':
      return '推論強度は high。論点を整理して慎重に答えてください。'
    case 'xhigh':
      return '推論強度は xhigh。十分に比較検討したうえで答えてください。'
    default:
      return '推論強度は medium。簡潔さと妥当性のバランスを取ってください。'
  }
}

function applyResultToAgent(agent: RuntimeAgent, result: CliExecResult): void {
  agent.runtimeSessionId = result.sessionId ?? agent.runtimeSessionId
  if (result.rateLimits) {
    agent.rateLimits = result.rateLimits
  }
}

function getNextConversationSpeaker(session: MeetingSession): RuntimeAgent {
  const participants = session.agents.filter((agent) => agent.role === 'Participant').slice(0, 2)
  if (participants.length === 0) {
    return session.agents[0]
  }

  if (participants.length === 1 || session.messages.length === 0) {
    return [...participants].sort((left, right) => left.speakCount - right.speakCount)[0]
  }

  const lastSpeakerId = session.messages[session.messages.length - 1].agentId
  return participants.find((agent) => agent.id !== lastSpeakerId) ?? participants[0]
}

export class MeetingOrchestrator {
  private readonly sessions = new Map<string, MeetingSession>()

  constructor(private readonly runCli: CliRunner) {}

  async runTurn(input: RunTurnRequest): Promise<RunTurnResponse> {
    const isNewSession = !input.sessionId || !this.sessions.has(input.sessionId)
    const inputPaths = input.inputPaths ?? []
    const loadedContext = isNewSession || input.sessionId === undefined
      ? await loadInputContext(inputPaths)
      : null

    const session = input.sessionId && this.sessions.has(input.sessionId)
      ? this.sessions.get(input.sessionId)!
      : this.createSession(input, loadedContext?.promptBlock ?? '', loadedContext?.warnings ?? [])

    if (!isNewSession && JSON.stringify(session.inputPaths) !== JSON.stringify(inputPaths)) {
      const refreshedContext = await loadInputContext(inputPaths)
      session.inputPaths = [...inputPaths]
      session.inputContextPrompt = refreshedContext.promptBlock
      session.inputContextWarnings = refreshedContext.warnings
    }

    session.status = 'running'

    const totalTurns = session.turnLimit * Math.max(session.agents.length, 1)
    if (session.currentTurn > totalTurns) {
      await this.finalizeSession(session)
      return this.serializeSession(session)
    }

    if (session.discussionStyle === 'conversation') {
      await this.runConversationTurn(session)
    } else {
      await this.runMeetingTurn(session)
    }

    session.currentTurn += 1

    if (session.currentTurn > totalTurns) {
      await this.finalizeSession(session)
    }

    return this.serializeSession(session)
  }

  private createSession(input: RunTurnRequest, inputContextPrompt: string, inputContextWarnings: string[]): MeetingSession {
    const id = input.sessionId ?? randomUUID()
    const session: MeetingSession = {
      id,
      topic: input.topic,
      inputPaths: [...(input.inputPaths ?? [])],
      inputContextPrompt,
      inputContextWarnings,
      discussionStyle: input.discussionStyle,
      turnLimit: input.turnLimit,
      currentTurn: 1,
      status: 'idle',
      agents: input.agents.map(cloneAgent),
      messages: [],
      finalConclusion: null,
      debug: null,
      log: []
    }

    this.sessions.set(id, session)
    return session
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
        provider: agent.provider,
        model: agent.model,
        reasoningEffort: agent.reasoningEffort,
        runtimeSessionId: agent.runtimeSessionId,
        rateLimits: agent.rateLimits,
        status: agent.status,
        handRaiseIntensity: agent.handRaiseIntensity,
        speakCount: agent.speakCount
      })),
      messages: session.messages,
      currentTurn: session.currentTurn,
      sessionStatus: session.status,
      finalConclusion: session.finalConclusion,
      debug: session.debug
    }
  }

  private async runConversationTurn(session: MeetingSession): Promise<void> {
    const speaker = getNextConversationSpeaker(session)
    const prompt = this.buildConversationPrompt(session, speaker)
    const startedAt = Date.now()
    const result = await this.runCli({
      provider: speaker.provider,
      model: speaker.model,
      reasoningEffort: speaker.reasoningEffort,
      prompt,
      sessionId: speaker.runtimeSessionId ?? undefined
    })
    const finishedAt = Date.now()

    applyResultToAgent(speaker, result)
    speaker.status = 'idle'
    speaker.speakCount += 1

    const message = this.recordMessage(session, speaker, result.response, 'message')
    this.deliverMessage(session, speaker.id, message)

    session.agents.forEach((agent) => {
      agent.handRaiseIntensity = agent.id === speaker.id ? 100 : 0
    })

    session.debug = {
      sessionId: session.id,
      turn: session.currentTurn,
      selectedSpeakerId: speaker.id,
      dispatchReason: 'Conversation モードのため、直前の発話者と異なる参加者を選択しました。',
      facilitator: null,
      scores: session.agents
        .filter((agent) => agent.role === 'Participant')
        .map((agent) => ({
          agentId: agent.id,
          runtimeSessionId: agent.runtimeSessionId,
          score: agent.id === speaker.id ? 100 : 0,
          confidence: 100,
          desiredAction: agent.id === speaker.id ? 'respond' : 'wait',
          reason: agent.id === speaker.id ? '交互発話ロジックで選択' : '今回は待機'
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
    }
  }

  private async runMeetingTurn(session: MeetingSession): Promise<void> {
    const facilitator = session.agents.find((agent) => agent.role === 'Facilitator') ?? null
    const participants = session.agents.filter((agent) => agent.role === 'Participant')

    if (session.messages.length === 0 && facilitator) {
      const prompt = this.buildMeetingPrompt(session, facilitator, null, [])
      const startedAt = Date.now()
      const result = await this.runCli({
        provider: facilitator.provider,
        model: facilitator.model,
        reasoningEffort: facilitator.reasoningEffort,
        prompt,
        sessionId: facilitator.runtimeSessionId ?? undefined
      })
      const finishedAt = Date.now()

      applyResultToAgent(facilitator, result)
      facilitator.speakCount += 1
      participants.forEach((agent) => {
        agent.handRaiseIntensity = 0
      })

      const message = this.recordMessage(session, facilitator, result.response, 'moderation')
      this.deliverMessage(session, facilitator.id, message)

      session.debug = {
        sessionId: session.id,
        turn: session.currentTurn,
        selectedSpeakerId: facilitator.id,
        dispatchReason: '会議開始時のため、ファシリテータが最初の論点整理を行いました。',
        facilitator: {
          agentId: facilitator.id,
          runtimeSessionId: facilitator.runtimeSessionId,
          overview: '会議の導入と論点整理',
          rationale: '初手は前提共有を優先',
          nextFocus: '参加者が論点ごとに見解を出す',
          selectedAgentId: null,
          selectedAgentIds: participants.map((agent) => agent.id),
          inviteAgentIds: participants.map((agent) => agent.id),
          interventionPriority: 100,
          shouldIntervene: true,
          parallelDispatch: false
        },
        scores: [],
        workers: [{
          workerId: `speech:${facilitator.id}`,
          kind: 'speech',
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
      }

      return
    }

    const workerRuns: OrchestratorDebugSnapshot['workers'] = []

    const scoreTasks = participants.map(async (agent) => {
      const startedAt = Date.now()
      const score = await this.scoreParticipant(session, agent)
      const finishedAt = Date.now()
      workerRuns.push({
        workerId: `score:${agent.id}`,
        kind: 'score',
        targetAgentId: agent.id,
        startedAt,
        finishedAt,
        durationMs: finishedAt - startedAt
      })
      return score
    })

    const facilitatorTask = facilitator
      ? (async () => {
          const startedAt = Date.now()
          const decision = await this.moderateMeeting(session, facilitator)
          const finishedAt = Date.now()
          workerRuns.push({
            workerId: `moderation:${facilitator.id}`,
            kind: 'moderation',
            targetAgentId: facilitator.id,
            startedAt,
            finishedAt,
            durationMs: finishedAt - startedAt
          })
          return decision
        })()
      : Promise.resolve<FacilitatorDecision | null>(null)

    const [scores, facilitatorDecision] = await Promise.all([Promise.all(scoreTasks), facilitatorTask])

    participants.forEach((agent) => {
      const score = scores.find((entry) => entry.agentId === agent.id)
      agent.handRaiseIntensity = score?.score ?? 0
    })

    if (facilitatorDecision?.inviteAgentIds.length) {
      for (const agentId of facilitatorDecision.inviteAgentIds) {
        const target = session.agents.find((agent) => agent.id === agentId)
        if (!target) {
          continue
        }

        target.inbox = trimMailbox([
          ...target.inbox,
          {
            id: randomUUID(),
            fromAgentId: facilitator?.id ?? 'facilitator',
            kind: 'facilitator-note',
            content: facilitatorDecision.nextFocus,
            summary: `ファシリテータ指示: ${facilitatorDecision.nextFocus}`,
            timestamp: Date.now()
          }
        ])
      }
    }

    const { speakers, dispatchReason } = this.selectSpeakers(session, scores, facilitatorDecision, facilitator)
    const plannedSpeakers = [...speakers]

    const speechRuns = await Promise.all(
      plannedSpeakers.map(async (speaker) => {
        const prompt = this.buildMeetingPrompt(session, speaker, facilitatorDecision, scores)
        const startedAt = Date.now()
        const result = await this.runCli({
          provider: speaker.provider,
          model: speaker.model,
          reasoningEffort: speaker.reasoningEffort,
          prompt,
          sessionId: speaker.runtimeSessionId ?? undefined
        })
        const finishedAt = Date.now()
        return { speaker, result, startedAt, finishedAt }
      })
    )

    for (const speech of speechRuns) {
      workerRuns.push({
        workerId: `speech:${speech.speaker.id}`,
        kind: 'speech',
        targetAgentId: speech.speaker.id,
        startedAt: speech.startedAt,
        finishedAt: speech.finishedAt,
        durationMs: speech.finishedAt - speech.startedAt
      })
    }

    for (const speech of speechRuns) {
      applyResultToAgent(speech.speaker, speech.result)
      speech.speaker.speakCount += 1
    }

    const newMessages = speechRuns.map((speech) =>
      this.recordMessage(
        session,
        speech.speaker,
        speech.result.response,
        speech.speaker.role === 'Facilitator' ? 'moderation' : 'message'
      )
    )

    for (let index = 0; index < speechRuns.length; index += 1) {
      this.deliverMessage(session, speechRuns[index].speaker.id, newMessages[index])
    }

    session.debug = {
      sessionId: session.id,
      turn: session.currentTurn,
      selectedSpeakerId: speechRuns[0]?.speaker.id ?? null,
      dispatchReason,
      facilitator: facilitator && facilitatorDecision ? {
        agentId: facilitator.id,
        runtimeSessionId: facilitator.runtimeSessionId,
        overview: facilitatorDecision.overview,
        rationale: facilitatorDecision.rationale,
        nextFocus: facilitatorDecision.nextFocus,
        selectedAgentId: facilitatorDecision.selectedAgentId,
        selectedAgentIds: facilitatorDecision.selectedAgentIds,
        inviteAgentIds: facilitatorDecision.inviteAgentIds,
        interventionPriority: facilitatorDecision.interventionPriority,
        shouldIntervene: facilitatorDecision.shouldIntervene,
        parallelDispatch: facilitatorDecision.parallelDispatch
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
    }
  }

  private async finalizeSession(session: MeetingSession): Promise<void> {
    if (session.finalConclusion) {
      session.status = 'finished'
      return
    }

    const synthesizer = session.agents.find((agent) => agent.role === 'Facilitator') ?? session.agents[0]
    const transcript = getRecentTranscript(session, 20)
    const prompt = [
      getSharedPromptContext(session),
      'これまでの議論をもとに最終結論を日本語でまとめてください。',
      '次の4見出しをこの順番で必ず含めてください: 1. 結論サマリー 2. 共通認識 3. 残課題 4. 次のアクション',
      '各セクションは簡潔だが具体的に書いてください。',
      `議論ログ: ${transcript}`
    ].join('\n\n')

    const startedAt = Date.now()
    const result = await this.runCli({
      provider: synthesizer.provider,
      model: synthesizer.model,
      reasoningEffort: synthesizer.reasoningEffort,
      prompt,
      sessionId: synthesizer.runtimeSessionId ?? undefined
    })
    const finishedAt = Date.now()

    applyResultToAgent(synthesizer, result)
    session.finalConclusion = result.response
    session.status = 'finished'
    session.log.push({
      turn: session.currentTurn,
      kind: 'synthesis',
      summary: summarizeResponse(result.response),
      timestamp: Date.now()
    })

    session.debug = {
      sessionId: session.id,
      turn: session.currentTurn,
      selectedSpeakerId: null,
      dispatchReason: 'ターン上限に到達したため最終結論を生成しました。',
      facilitator: synthesizer ? {
        agentId: synthesizer.id,
        runtimeSessionId: synthesizer.runtimeSessionId,
        overview: '議論全体の要約',
        rationale: '終了条件に到達したため総括を作成',
        nextFocus: '最終結論の提示',
        selectedAgentId: null,
        selectedAgentIds: [],
        inviteAgentIds: [],
        interventionPriority: 100,
        shouldIntervene: true,
        parallelDispatch: false
      } : null,
      scores: [],
      workers: [{
        workerId: `synthesis:${synthesizer.id}`,
        kind: 'synthesis',
        targetAgentId: synthesizer.id,
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
    }
  }

  private buildConversationPrompt(session: MeetingSession, speaker: RuntimeAgent): string {
    const transcript = getRecentTranscript(session, 8)
    const inboxText = speaker.inbox.slice(-4).map((item) => item.summary).join(' / ')

    const parts = [
      getSharedPromptContext(session),
      `あなたは ${speaker.name} です。立場: ${speaker.stance}。性格: ${speaker.personality}。`,
      buildReasoningGuidance(speaker.reasoningEffort)
    ]

    if (session.messages.length > 0) {
      parts.push(`直近の会話: ${transcript}`)
    }

    if (inboxText) {
      parts.push(`受信メモ: ${inboxText}`)
    }

    parts.push('会話相手に返す短めの一発言を日本語で返してください。2〜4文で十分です。')
    return parts.join('\n\n')
  }

  private async scoreParticipant(session: MeetingSession, agent: RuntimeAgent): Promise<ScoreDecision> {
    const transcript = getRecentTranscript(session, 8)
    const inboxText = agent.inbox.slice(-5).map((item) => item.summary).join(' / ')
    const prompt = [
      getSharedPromptContext(session),
      `あなたは採点係です。対象エージェントは ${agent.name}。立場: ${agent.stance}。性格: ${agent.personality}。`,
      buildReasoningGuidance(agent.reasoningEffort),
      `直近の議論: ${transcript || 'まだ議論は始まっていません。'}`,
      inboxText ? `受信メモ: ${inboxText}` : '',
      'このエージェントが今ターンに発言すべき強さを JSON のみで返してください。',
      '{"score":0-100,"confidence":0-100,"desiredAction":"agree|challenge|question|synthesize|implement","reason":"短い理由"}'
    ].filter(Boolean).join('\n\n')

    const result = await this.runCli({
      provider: agent.provider,
      model: agent.model,
      reasoningEffort: agent.reasoningEffort,
      prompt,
      sessionId: agent.runtimeSessionId ?? undefined
    })

    applyResultToAgent(agent, result)

    const parsed = extractJson<{ score?: number; confidence?: number; desiredAction?: string; reason?: string }>(result.response)
    return {
      agentId: agent.id,
      runtimeSessionId: agent.runtimeSessionId,
      score: clamp(parsed?.score ?? 40, 0, 100),
      confidence: clamp(parsed?.confidence ?? 50, 0, 100),
      desiredAction: parsed?.desiredAction ?? 'question',
      reason: parsed?.reason ?? '発言必要度の理由が不足していたため既定値を使用'
    }
  }

  private async moderateMeeting(session: MeetingSession, facilitator: RuntimeAgent): Promise<FacilitatorDecision> {
    const transcript = getRecentTranscript(session, 10)
    const participantState = session.agents
      .filter((agent) => agent.role === 'Participant')
      .map((agent) => `${agent.name}: 発言${agent.speakCount}回, stance=${agent.stance}, personality=${agent.personality}`)
      .join(' | ')

    const prompt = [
      getSharedPromptContext(session),
      `あなたは会議のファシリテータ ${facilitator.name} です。`,
      buildReasoningGuidance(facilitator.reasoningEffort),
      `参加者の状態: ${participantState}`,
      `直近の議論: ${transcript || 'まだ議論は始まっていません。'}`,
      '必要なら複数担当者へ同時に話題を振ってください。',
      '次の JSON のみを返してください。',
      '{"overview":"現状整理","rationale":"判断理由","nextFocus":"次に進める論点","selectedAgentId":"agent-id or null","selectedAgentIds":["agent-id"],"inviteAgentIds":["agent-id"],"interventionPriority":0-100,"shouldIntervene":true|false,"parallelDispatch":true|false}'
    ].join('\n\n')

    const result = await this.runCli({
      provider: facilitator.provider,
      model: facilitator.model,
      reasoningEffort: facilitator.reasoningEffort,
      prompt,
      sessionId: facilitator.runtimeSessionId ?? undefined
    })

    applyResultToAgent(facilitator, result)

    const parsed = extractJson<Partial<FacilitatorDecision>>(result.response)
    const selectedAgentIds = Array.isArray(parsed?.selectedAgentIds) ? parsed!.selectedAgentIds.filter(Boolean) : []
    const inviteAgentIds = Array.isArray(parsed?.inviteAgentIds) ? parsed!.inviteAgentIds.filter(Boolean) : []

    return {
      overview: parsed?.overview ?? '現状整理を取得できませんでした',
      rationale: parsed?.rationale ?? '判断理由を取得できませんでした',
      nextFocus: parsed?.nextFocus ?? '次の論点を明示してください',
      selectedAgentId: parsed?.selectedAgentId ?? null,
      selectedAgentIds,
      inviteAgentIds,
      interventionPriority: clamp(parsed?.interventionPriority ?? 40, 0, 100),
      shouldIntervene: Boolean(parsed?.shouldIntervene),
      parallelDispatch: Boolean(parsed?.parallelDispatch) || selectedAgentIds.length > 1
    }
  }

  private selectSpeakers(
    session: MeetingSession,
    scores: ScoreDecision[],
    facilitatorDecision: FacilitatorDecision | null,
    facilitator: RuntimeAgent | null
  ): { speakers: RuntimeAgent[]; dispatchReason: string } {
    const participants = session.agents.filter((agent) => agent.role === 'Participant')
    const ranked = participants
      .map((agent) => {
        const score = scores.find((entry) => entry.agentId === agent.id)
        const facilitatorBoost = facilitatorDecision?.selectedAgentIds.includes(agent.id) || facilitatorDecision?.selectedAgentId === agent.id ? 20 : 0
        return {
          agent,
          baseScore: score?.score ?? 0,
          adjustedScore: (score?.score ?? 0) + facilitatorBoost,
          reason: score?.reason ?? '理由なし'
        }
      })
      .sort((left, right) => right.adjustedScore - left.adjustedScore)

    if (
      facilitator &&
      facilitatorDecision?.shouldIntervene &&
      facilitatorDecision.interventionPriority >= (ranked[0]?.adjustedScore ?? 0)
    ) {
      return {
        speakers: [facilitator],
        dispatchReason: `ファシリテータ介入を優先: ${facilitatorDecision.rationale}`
      }
    }

    const explicitlySelectedIds = facilitatorDecision?.selectedAgentIds.filter((id) =>
      participants.some((agent) => agent.id === id)
    ) ?? []

    const fallbackSelectedIds = facilitatorDecision?.selectedAgentId
      ? [facilitatorDecision.selectedAgentId].filter((id) => participants.some((agent) => agent.id === id))
      : []

    const parallelIds = facilitatorDecision?.parallelDispatch
      ? (explicitlySelectedIds.length > 0
          ? explicitlySelectedIds
          : facilitatorDecision?.inviteAgentIds.filter((id) => participants.some((agent) => agent.id === id)) ?? [])
      : []

    const selectedIds = explicitlySelectedIds.length > 0
      ? explicitlySelectedIds
      : parallelIds.length > 1
        ? parallelIds
        : fallbackSelectedIds.length > 0
          ? fallbackSelectedIds
          : ranked.slice(0, 1).map((entry) => entry.agent.id)

    const speakers = selectedIds
      .map((agentId) => participants.find((agent) => agent.id === agentId) ?? null)
      .filter((agent): agent is RuntimeAgent => agent !== null)

    if (speakers.length === 0) {
      return {
        speakers: ranked.length > 0 ? [ranked[0].agent] : [session.agents[0]],
        dispatchReason: '候補が空だったため最高スコアの参加者を選択しました。'
      }
    }

    if (speakers.length > 1) {
      const speakerNames = speakers.map((agent) => agent.name).join(', ')
      return {
        speakers,
        dispatchReason: `ファシリテータが複数担当者へ同時依頼: ${speakerNames}`
      }
    }

    const topReason = ranked[0]
      ? `${ranked[0].agent.name} を選択。score=${ranked[0].adjustedScore} (${ranked[0].reason})`
      : '候補情報なし'

    return {
      speakers,
      dispatchReason: topReason
    }
  }

  private buildMeetingPrompt(
    session: MeetingSession,
    speaker: RuntimeAgent,
    facilitatorDecision: FacilitatorDecision | null,
    scores: ScoreDecision[]
  ): string {
    const transcript = getRecentTranscript(session, 10)
    const inboxText = speaker.inbox.slice(-5).map((item) => item.summary).join(' / ')

    if (speaker.role === 'Facilitator') {
      return [
        getSharedPromptContext(session),
        `あなたはファシリテータ ${speaker.name} です。`,
        buildReasoningGuidance(speaker.reasoningEffort),
        `現在の整理: ${facilitatorDecision?.overview ?? '未整理'}`,
        `次の焦点: ${facilitatorDecision?.nextFocus ?? '論点を再整理してください'}`,
        `直近の議論: ${transcript || 'まだ議論は始まっていません。'}`,
        '次に進めるための短い進行発話を日本語で返してください。'
      ].join('\n\n')
    }

    const scoreInfo = scores.find((entry) => entry.agentId === speaker.id)
    return [
      getSharedPromptContext(session),
      `あなたは ${speaker.name} です。立場: ${speaker.stance}。性格: ${speaker.personality}。`,
      buildReasoningGuidance(speaker.reasoningEffort),
      `直近の議論: ${transcript || 'まだ議論は始まっていません。'}`,
      facilitatorDecision ? `ファシリテータ整理: ${facilitatorDecision.overview}\n次の焦点: ${facilitatorDecision.nextFocus}` : '',
      inboxText ? `受信メモ: ${inboxText}` : '',
      scoreInfo ? `期待される行動: ${scoreInfo.desiredAction} / 理由: ${scoreInfo.reason}` : '',
      '会議を前に進める具体的な一発言を日本語で返してください。2〜5文で十分です。'
    ].filter(Boolean).join('\n\n')
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
    }

    session.messages.push(message)
    session.log.push({
      turn: session.currentTurn,
      kind,
      summary: message.summary,
      timestamp: message.timestamp
    })

    return message
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
      }

      if (agent.id === speakerId) {
        agent.outbox = trimMailbox([...agent.outbox, envelope])
      } else {
        agent.inbox = trimMailbox([...agent.inbox, envelope])
      }
    })
  }
}
