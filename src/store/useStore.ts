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
  runtimeSessionId: string | null;
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

export interface OrchestrationDebug {
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
  backendSessionId: string | null;
  orchestrationDebug: OrchestrationDebug | null;

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
    runtimeSessionId: null,
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
    runtimeSessionId: null,
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
    runtimeSessionId: null,
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
    runtimeSessionId: null,
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
    runtimeSessionId: null,
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
    runtimeSessionId: null,
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
  backendSessionId: null,
  orchestrationDebug: null,

  setTopic: (topic) => set({ topic }),
  setSessionMode: (mode) => set(() => ({
    sessionMode: mode,
    ...getSessionDefaults(mode),
    messages: [],
    currentTurn: 0,
    finalConclusion: null,
    sessionError: null,
    backendSessionId: null,
    orchestrationDebug: null,
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
    backendSessionId: null,
    orchestrationDebug: null,
    agents: s.agents.map(a => ({ ...a, runtimeSessionId: null, status: 'idle' as const, speakCount: 0, handRaiseIntensity: 0 }))
  })),
  stopSession: () => set({ sessionStatus: 'finished' }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clearSessionError: () => set({ sessionError: null }),
  resetSession: () => set({ sessionStatus: 'idle', messages: [], currentTurn: 0, finalConclusion: null, sessionError: null, backendSessionId: null, orchestrationDebug: null }),

  // ===================================================================
  // メインの議論ループ
  // ===================================================================
  processNextTurn: async () => {
    const state = get();
    if (state.sessionStatus !== 'running') return;
    try {
      const res = await fetch('http://localhost:3001/api/orchestrator/run-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.backendSessionId,
          topic: state.topic,
          sessionMode: state.sessionMode,
          turnLimit: state.turnLimit,
          agents: state.agents
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.details || data?.error || `HTTP ${res.status}`);
      }
      
      if (data.success) {
        set({
          backendSessionId: data.sessionId,
          agents: data.agents,
          messages: data.messages,
          currentTurn: data.currentTurn,
          sessionStatus: data.sessionStatus,
          finalConclusion: data.finalConclusion,
          orchestrationDebug: data.debug,
          sessionError: null
        });
      } else {
        throw new Error(data.details || data.error);
      }
    } catch (e) {
      console.error('Agent interaction failed:', e);
      set({
        sessionStatus: 'finished',
        sessionError: getAgentInteractionErrorMessage(e)
      });
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
