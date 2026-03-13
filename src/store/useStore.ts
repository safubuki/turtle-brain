import { create } from 'zustand';

// エージェントの役割
export type AgentRole = 'Participant' | 'Facilitator';

// 挙手判定方式
export type HandRaiseMode = 'rule-based' | 'ai-evaluation';

// セッションモード
export type SessionMode = 'conversation' | 'meeting';

// エージェントのデータ構造
export interface AgentProfile {
  id: string;
  name: string;
  role: AgentRole;
  stance: string;        // 例: 建設的、批判的
  personality: string;   // 例: 声が大きい、データ重視
  model: string;         // 使用言語モデル
  // UI用の一時的なステータス状態
  status: 'idle' | 'thinking' | 'speaking' | 'raising_hand';
  handRaiseIntensity: number; // 挙手の強さ (0〜100)
  speakCount: number;         // 発言回数
}

// 1つの発言（メッセージ）のデータ
export interface Message {
  id: string;
  agentId: string;
  content: string;
  summary: string;   // この発言の要約（カラム冒頭に表示）
  timestamp: number;
}

// 全体のストア状態
interface TurtleBrainState {
  // 設定関連
  agents: AgentProfile[];
  topic: string;
  turnLimit: number;
  currentTurn: number;
  environment: 'sandbox' | 'full';
  handRaiseMode: HandRaiseMode;
  sessionMode: SessionMode;
  
  // 対話・議論データ
  messages: Message[];
  sessionStatus: 'idle' | 'running' | 'finished';
  finalConclusion: string | null;
  sessionError: string | null;

  // アクション操作
  setTopic: (topic: string) => void;
  setSessionMode: (mode: SessionMode) => void;
  setHandRaiseMode: (mode: HandRaiseMode) => void;
  setTurnLimit: (limit: number) => void;
  addAgent: (agent: AgentProfile) => void;
  updateAgent: (id: string, updates: Partial<AgentProfile>) => void;
  removeAgent: (id: string) => void;
  resetAgentsToDefault: () => void;
  resetAgentToDefault: (id: string) => void;
  
  startSession: (topic: string) => void;
  stopSession: () => void;
  addMessage: (message: Message) => void;
  clearSessionError: () => void;
  resetSession: () => void;
  processNextTurn: () => Promise<void>;
  generateFinalConclusion: () => Promise<void>;
}

function getAgentInteractionErrorMessage(error: unknown, details?: string): string {
  if (details) {
    return `エージェント呼び出し失敗: ${details}`;
  }

  if (error instanceof TypeError) {
    return 'バックエンド未起動の可能性があります。server を起動してから再実行してください。';
  }

  if (error instanceof Error && error.message) {
    return `エージェント呼び出し失敗: ${error.message}`;
  }

  return 'エージェント呼び出しに失敗しました。';
}

const conversationDefaultAgents: AgentProfile[] = [
  {
    id: 'agent-1',
    name: 'エージェントA',
    role: 'Participant',
    stance: '建設的・共感的',
    personality: '前向き・協調的',
    model: 'gpt-5.4',
    status: 'idle',
    handRaiseIntensity: 0,
    speakCount: 0
  },
  {
    id: 'agent-2',
    name: 'エージェントB',
    role: 'Participant',
    stance: '探究的・批判的',
    personality: '慎重・論理的',
    model: 'gpt-5.4',
    status: 'idle',
    handRaiseIntensity: 0,
    speakCount: 0
  }
];

// デフォルトのエージェント（4名: 参加者3名 + ファシリテーター1名）
const defaultAgents: AgentProfile[] = [
  {
    id: 'agent-1',
    name: 'エージェントA',
    role: 'Participant',
    stance: '建設的・アイデア出し',
    personality: '前向き・協調的',
    model: 'gpt-5.4',
    status: 'idle',
    handRaiseIntensity: 0,
    speakCount: 0
  },
  {
    id: 'agent-2',
    name: 'エージェントB',
    role: 'Participant',
    stance: '批判的・リスク分析',
    personality: '慎重・論理的',
    model: 'gpt-5.4',
    status: 'idle',
    handRaiseIntensity: 0,
    speakCount: 0
  },
  {
    id: 'agent-3',
    name: 'エージェントC',
    role: 'Participant',
    stance: '中立・データ重視・ユーザー目線',
    personality: '分析的・俯瞰的',
    model: 'gpt-5.4',
    status: 'idle',
    handRaiseIntensity: 0,
    speakCount: 0
  },
  {
    id: 'moderator',
    name: 'ファシリテーターエージェント',
    role: 'Facilitator',
    stance: '中立',
    personality: '冷静・俯瞰的',
    model: 'gpt-5.4',
    status: 'idle',
    handRaiseIntensity: 0,
    speakCount: 0
  }
];

function cloneAgents(agents: AgentProfile[]): AgentProfile[] {
  return agents.map((agent) => ({ ...agent }));
}

function getSessionDefaults(mode: SessionMode): {
  agents: AgentProfile[];
  turnLimit: number;
  handRaiseMode: HandRaiseMode;
} {
  if (mode === 'conversation') {
    return {
      agents: cloneAgents(conversationDefaultAgents),
      turnLimit: 4,
      handRaiseMode: 'rule-based'
    };
  }

  return {
    agents: cloneAgents(defaultAgents),
    turnLimit: 2,
    handRaiseMode: 'rule-based'
  };
}

function getNextConversationSpeaker(agents: AgentProfile[], messages: Message[]): AgentProfile {
  const participants = agents.filter((agent) => agent.role === 'Participant').slice(0, 2);

  if (participants.length === 0) {
    return agents[0];
  }

  if (participants.length === 1 || messages.length === 0) {
    return [...participants].sort((left, right) => left.speakCount - right.speakCount)[0];
  }

  const lastSpeakerId = messages[messages.length - 1].agentId;
  return participants.find((agent) => agent.id !== lastSpeakerId) ?? participants[0];
}

// -------------------------------------------------------------------
// 挙手判定: ルールベース
// -------------------------------------------------------------------
function evaluateHandRaiseRuleBased(
  agent: AgentProfile,
  agents: AgentProfile[],
  messages: Message[],
  _topic: string
): number {
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  
  let score = 50; // 基本スコア

  // 1. 連続発言防止: 直前の発言者は大きく減点
  if (lastMessage && lastMessage.agentId === agent.id) {
    score -= 80;
  }

  // 2. 発言回数バランス: 発言が少ないほど加点
  const maxSpeakCount = Math.max(...agents.map(a => a.speakCount), 1);
  const speakRatio = agent.speakCount / maxSpeakCount;
  score += Math.round((1 - speakRatio) * 30); // 最大+30

  // 3. 直前の発言で自分が言及されていたら加点
  if (lastMessage && lastMessage.content.includes(agent.name)) {
    score += 25;
  }

  // 4. ファシリテーターは通常低め、偏りが大きいときだけ介入
  if (agent.role === 'Facilitator') {
    score -= 20; // 通常は控えめ
    
    // 発言回数の偏りが大きい場合に介入（ファシリテーターの出番）
    const participantAgents = agents.filter(a => a.role === 'Participant');
    const speakCounts = participantAgents.map(a => a.speakCount);
    const maxSpeak = Math.max(...speakCounts);
    const minSpeak = Math.min(...speakCounts);
    if (maxSpeak >= minSpeak + 2) {
      score += 40; // 偏りが大きいので介入
    }
    
    // 一定ターン間隔でも介入（議論の整理）
    if (messages.length > 0 && messages.length % 4 === 0) {
      score += 30;
    }
  }

  // 5. 最初のターンはファシリテーターではなく参加者から
  if (messages.length === 0 && agent.role === 'Facilitator') {
    score = 0;
  }

  // 6. ランダム要素（同点回避）
  score += Math.floor(Math.random() * 10);

  return Math.max(0, Math.min(100, score));
}

// -------------------------------------------------------------------
// 挙手判定: AI評価（Codexで発言意欲を判定）
// -------------------------------------------------------------------
async function evaluateHandRaiseAI(
  agent: AgentProfile,
  agents: AgentProfile[],
  messages: Message[],
  topic: string
): Promise<number> {
  // ファシリテーターは通常AI評価しない（ルールベースと同様のロジック）
  if (agent.role === 'Facilitator') {
    return evaluateHandRaiseRuleBased(agent, agents, messages, topic);
  }

  // 最初のターン（Facilitatorは上で既にreturn済み）
  if (messages.length === 0) {
    return 50 + Math.floor(Math.random() * 20);
  }

  const lastMessage = messages[messages.length - 1];
  // 連続発言防止
  if (lastMessage.agentId === agent.id) return 5;

  const lastSpeaker = agents.find(a => a.id === lastMessage.agentId);
  
  try {
    const prompt = `あなたは「${agent.name}」（スタンス: ${agent.stance}、性格: ${agent.personality}）です。` +
      `テーマ「${topic}」の議論で、直前に${lastSpeaker?.name || '他の参加者'}が「${lastMessage.content.substring(0, 200)}」と発言しました。` +
      `あなたがこの発言に対して意見を述べたい度合いを0〜100の数値のみで回答してください。数値のみ。`;

    const res = await fetch('http://localhost:3001/api/agent/interact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model: agent.model })
    });

    const data = await res.json();
    if (data.success) {
      const match = data.response.match(/(\d+)/);
      if (match) {
        return Math.max(0, Math.min(100, parseInt(match[1], 10)));
      }
    }
  } catch (e) {
    console.warn(`AI hand-raise evaluation failed for ${agent.name}:`, e);
  }
  
  // フォールバック: ルールベース
  return evaluateHandRaiseRuleBased(agent, agents, messages, topic);
}

// -------------------------------------------------------------------
// プロンプト構築
// -------------------------------------------------------------------
function buildPrompt(
  agent: AgentProfile,
  agents: AgentProfile[],
  messages: Message[],
  topic: string,
  sessionMode: SessionMode
): string {
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const lastSpeaker = lastMessage ? agents.find(a => a.id === lastMessage.agentId) : null;
  
  // 全発言の履歴テキスト
  const historyText = messages.map(m => {
    const ag = agents.find(a => a.id === m.agentId);
    return `${ag?.name || 'Unknown'}: ${m.content}`;
  }).join(' --- ');

  if (sessionMode === 'conversation') {
    if (messages.length === 0) {
      return `テーマ「${topic}」について、2人でじっくり対話を始めます。あなたは「${agent.stance}」の立場、性格は「${agent.personality}」です。` +
        ` 相手が受け取りやすいトーンで、最初の見解を簡潔に2〜3文で述べてください。自己紹介は不要です。`;
    }

    return `テーマ「${topic}」について2人で対話中です。あなたは「${agent.stance}」の立場、性格は「${agent.personality}」です。` +
      ` 直前に${lastSpeaker?.name || '相手'}が次のように発言しました:「${lastMessage?.content}」` +
      ` 相手の論点を一度受け止めた上で、賛成・懸念・補足のいずれかを明確にし、会話が続くように1つ問いや深掘りを添えて2〜3文で返答してください。` +
      ` 自己紹介は不要です。` +
      (messages.length > 1 ? ` 参考:これまでの対話全体: ${historyText}` : '');
  }

  // ファシリテーター用プロンプト
  if (agent.role === 'Facilitator') {
    const participants = agents.filter(a => a.role === 'Participant');
    const speakInfo = participants.map(a => `${a.name}(${a.stance}): ${a.speakCount}回発言`).join('、');
    
    // 発言の少ない参加者を特定
    const minSpeakCount = Math.min(...participants.map(a => a.speakCount));
    const quietAgents = participants.filter(a => a.speakCount === minSpeakCount);
    
    return `あなたは議論のファシリテーター（司会進行）です。テーマ「${topic}」について複数のエージェントが議論しています。` +
      ` あなたの役割: 意見を述べるのではなく、議論を整理し、論点を明確にし、発言の少ない参加者に意見を求めること。` +
      ` 現在の参加者の発言状況: ${speakInfo}。` +
      (quietAgents.length > 0 ? ` 特に${quietAgents.map(a => a.name).join('と')}がまだ十分に発言していません。` : '') +
      ` これまでの議論を踏まえて、論点の整理や議論の方向性を示したり、発言の少ない参加者に具体的に問いかけてください。` +
      ` 簡潔に2〜3文で。自己紹介は不要です。` +
      ` これまでの議論: ${historyText}`;
  }

  // 参加者用プロンプト
  if (messages.length === 0) {
    return `テーマ「${topic}」について、${agent.stance}の立場から意見を述べてください。性格は「${agent.personality}」です。簡潔に2〜3文で回答してください。自己紹介は不要です。`;
  }

  // 直前がファシリテーターの場合: 問いかけに答える形で
  if (lastSpeaker?.role === 'Facilitator') {
    return `テーマ「${topic}」について議論中です。あなたは「${agent.stance}」の立場、性格は「${agent.personality}」です。` +
      ` ファシリテーター（${lastSpeaker.name}）が次のように発言しました:「${lastMessage?.content}」` +
      ` この問いかけや指摘に応じて、あなたの立場から意見を2〜3文で述べてください。自己紹介は不要です。` +
      (messages.length > 1 ? ` 参考:これまでの議論全体: ${historyText}` : '');
  }

  // 通常の参加者間対話
  return `テーマ「${topic}」について議論中です。あなたは「${agent.stance}」の立場、性格は「${agent.personality}」です。` +
    ` 直前に${lastSpeaker?.name || '相手'}が次のように発言しました:「${lastMessage?.content}」` +
    ` この発言に対して、あなたのスタンスに基づき、相手の意見の良い点や問題点に具体的に言及しながら自分の意見を2〜3文で述べてください。` +
    ` 相手の意見を引用・批判・同意・補足するなど、対話的に応答してください。自己紹介は不要です。` +
    (messages.length > 1 ? ` 参考:これまでの議論全体: ${historyText}` : '');
}

// ===================================================================
// Zustand ストア
// ===================================================================
export const useStore = create<TurtleBrainState>((set, get) => ({
  agents: cloneAgents(conversationDefaultAgents),
  topic: '',
  turnLimit: 4,
  currentTurn: 0,
  environment: 'sandbox',
  handRaiseMode: 'rule-based', // デフォルトはルールベース
  sessionMode: 'conversation',
  
  messages: [],
  sessionStatus: 'idle',
  finalConclusion: null,
  sessionError: null,

  setTopic: (topic) => set({ topic }),
  setSessionMode: (mode) => set(() => ({
    sessionMode: mode,
    ...getSessionDefaults(mode),
    messages: [],
    currentTurn: 0,
    finalConclusion: null,
    sessionError: null,
    sessionStatus: 'idle'
  })),
  setHandRaiseMode: (mode) => set({ handRaiseMode: mode }),
  setTurnLimit: (limit) => set({ turnLimit: limit }),
  
  addAgent: (agent) => set((state) => ({ 
    agents: [...state.agents, agent] 
  })),
  
  updateAgent: (id, updates) => set((state) => ({
    agents: state.agents.map(a => a.id === id ? { ...a, ...updates } : a)
  })),
  
  removeAgent: (id) => set((state) => ({
    agents: state.agents.filter(a => a.id !== id)
  })),

  // 全エージェントをデフォルトに戻す
  resetAgentsToDefault: () => set((state) => ({ agents: getSessionDefaults(state.sessionMode).agents })),
  
  // 特定のエージェントをデフォルトに戻す
  resetAgentToDefault: (id) => set((state) => {
    const defaultAgent = getSessionDefaults(state.sessionMode).agents.find(a => a.id === id);
    if (!defaultAgent) return state;
    return {
      agents: state.agents.map(a => a.id === id ? { ...defaultAgent } : a)
    };
  }),
  startSession: (topic: string) => set((s) => ({
    topic,
    sessionStatus: 'running',
    currentTurn: 1,
    messages: [],
    finalConclusion: null,
    sessionError: null,
    agents: s.agents.map(a => ({ ...a, status: 'idle' as const, speakCount: 0, handRaiseIntensity: 0 }))
  })),
  stopSession: () => set({ sessionStatus: 'finished' }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clearSessionError: () => set({ sessionError: null }),
  resetSession: () => set({ sessionStatus: 'idle', messages: [], currentTurn: 0, finalConclusion: null, sessionError: null }),

  // ===================================================================
  // メインの議論ループ
  // ===================================================================
  processNextTurn: async () => {
    const state = get();
    if (state.sessionStatus !== 'running') return;
    
    // 規定ターン数に達したら終了
    const totalTurns = state.turnLimit * state.agents.length;
    if (state.currentTurn > totalTurns) {
      set({ sessionStatus: 'finished' });
      get().generateFinalConclusion();
      return;
    }

    // ---------------------------------------------------------------
    // 挙手判定: 次の発言者を決定
    // ---------------------------------------------------------------
    const handRaiseScores: { agent: AgentProfile; score: number }[] = [];

    if (state.sessionMode === 'conversation') {
      const conversationSpeaker = getNextConversationSpeaker(state.agents, state.messages);
      handRaiseScores.push(
        ...state.agents.map((agent) => ({
          agent,
          score: agent.id === conversationSpeaker.id ? 100 : 0
        }))
      );
    } else if (state.handRaiseMode === 'ai-evaluation') {
      // AI評価（並列で全エージェント）
      set((s) => ({
        agents: s.agents.map(a => ({ ...a, status: 'raising_hand' as const }))
      }));

      const scores = await Promise.all(
        state.agents.map(async (agent) => ({
          agent,
          score: await evaluateHandRaiseAI(agent, state.agents, state.messages, state.topic)
        }))
      );
      handRaiseScores.push(...scores);
    } else {
      // ルールベース（高速）
      for (const agent of state.agents) {
        const score = evaluateHandRaiseRuleBased(agent, state.agents, state.messages, state.topic);
        handRaiseScores.push({ agent, score });
      }
    }

    // スコアをUIに反映
    set((s) => ({
      agents: s.agents.map(a => {
        const entry = handRaiseScores.find(h => h.agent.id === a.id);
        return { ...a, handRaiseIntensity: entry?.score || 0, status: 'idle' as const };
      })
    }));

    // 最高スコアのエージェントを選出
    handRaiseScores.sort((a, b) => b.score - a.score);
    const currentAgent = handRaiseScores[0].agent;
    
    console.log(`[Turn ${state.currentTurn}] Hand-raise scores:`, 
      handRaiseScores.map(h => `${h.agent.name}: ${h.score}`).join(', '),
      `→ ${currentAgent.name} speaks`
    );

    // ステータスを思考中に変更
    set((s) => ({
      agents: s.agents.map(a => a.id === currentAgent.id ? { ...a, status: 'thinking' } : a)
    }));

    try {
      // プロンプト構築
      const systemPrompt = buildPrompt(currentAgent, state.agents, state.messages, state.topic, state.sessionMode);

      const res = await fetch('http://localhost:3001/api/agent/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: systemPrompt,
          model: currentAgent.model
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.details || data?.error || `HTTP ${res.status}`);
      }
      
      if (data.success) {
        // 要約の生成: 最初の1文を抽出（「。」で区切り）
        const response = data.response;
        const firstSentenceEnd = response.indexOf('。');
        let summaryText: string;
        if (firstSentenceEnd > 0 && firstSentenceEnd < 80) {
          summaryText = response.substring(0, firstSentenceEnd + 1);
        } else if (firstSentenceEnd > 80) {
          summaryText = response.substring(0, 40) + '…';
        } else {
          summaryText = response.length > 50 ? response.substring(0, 50) + '…' : response;
        }

        set((s) => ({
          messages: [...s.messages, {
            id: `msg-${Date.now()}`,
            agentId: currentAgent.id,
            content: data.response,
            summary: summaryText,
            timestamp: Date.now()
          }],
          currentTurn: s.currentTurn + 1,
          sessionError: null,
          agents: s.agents.map(a => a.id === currentAgent.id 
            ? { ...a, status: 'idle', speakCount: a.speakCount + 1 } 
            : a
          )
        }));
      } else {
        throw new Error(data.details || data.error);
      }
    } catch (e) {
      console.error('Agent interaction failed:', e);
      set((s) => ({
        sessionStatus: 'finished',
        sessionError: getAgentInteractionErrorMessage(e),
        agents: s.agents.map(a => a.id === currentAgent.id ? { ...a, status: 'idle' } : a)
      }));
    }
  },

  // ===================================================================
  // 最終結論の生成
  // ===================================================================
  generateFinalConclusion: async () => {
    const state = get();
    set({ finalConclusion: '生成中...', sessionError: null });

    try {
      // 発言のあったエージェントのみ対象
      const activeAgents = state.agents.filter(a => 
        state.messages.some(m => m.agentId === a.id) && a.role === 'Participant'
      );

      const agentSummaries = activeAgents.map(ag => {
        const agMessages = state.messages.filter(m => m.agentId === ag.id);
        const agText = agMessages.map((m, i) => `[${i + 1}回目] ${m.content}`).join(' ');
        return `【${ag.name}（${ag.stance}）】 ${agText}`;
      }).join(' ---- ');

      const systemPrompt = `テーマ「${state.topic}」について、複数のAIエージェントが議論しました。以下の議論内容をもとに、最終結論をまとめてください。` +
        ` 重要: 全てのエージェントの意見を公平かつ十分に汲み取ること。建設的な意見だけでなく、批判的・慎重な意見も同等の重みで扱ってください。` +
        ` 以下の構造で回答してください:` +
        ` 1. 冒頭に3〜4行の「総括サマリー」を書く（テーマに対する全体的な結論を凝縮）` +
        ` 2. 「共通認識」のセクション: 全参加者の意見が一致している点を箇条書きで整理` +
        ` 3. 「対立軸」のセクション: 意見が分かれたポイントを明確に記述し、それぞれの立場の根拠を公平に提示` +
        ` 4. 「統合的結論」のセクション: 共通認識と対立軸を踏まえた上で、実践的な提言や推奨事項をまとめる` +
        ` 5. 各ポイントは具体的に書き、曖昧な表現は避けてください。` +
        ` ---- 議論内容 ---- ${agentSummaries}`;

      const res = await fetch('http://localhost:3001/api/agent/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: systemPrompt,
          model: 'gpt-5.4'
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.details || data?.error || `HTTP ${res.status}`);
      }
      
      if (data.success) {
        set({ finalConclusion: data.response });
      } else {
        throw new Error(data.details || data.error);
      }
    } catch (e) {
      console.error('Failed to generate final conclusion:', e);
      set({ 
        finalConclusion: '最終結論の生成に失敗しました。',
        sessionError: getAgentInteractionErrorMessage(e)
      });
    }
  }
}));
