import { create } from 'zustand'
import { apiRequestJson } from '../lib/apiClient'

export type AgentRole = 'Participant' | 'Facilitator'
export type HandRaiseMode = 'rule-based' | 'ai-evaluation'
export type ExecutionMode = 'orchestration' | 'autonomous'
export type DiscussionStyle = 'conversation' | 'meeting'
export type AgentCliProvider = 'codex' | 'gemini' | 'copilot'
export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh'

export interface RateLimitWindow {
  remaining: number | null
  limit: number | null
  resetAt: string | null
}

export interface AgentRateLimits {
  daily: RateLimitWindow | null
  weekly: RateLimitWindow | null
  source: string | null
}

export interface ProviderModelInfo {
  id: string
  name: string
  description?: string
  supportedReasoningEfforts: ReasoningEffort[]
  defaultReasoningEffort: ReasoningEffort | null
  billingMultiplier: number | null
}

export interface ProviderCatalog {
  provider: AgentCliProvider
  label: string
  source: string
  fetchedAt: string | null
  available: boolean
  models: ProviderModelInfo[]
  error: string | null
}

export type ProviderCatalogMap = Record<AgentCliProvider, ProviderCatalog>

export interface AgentProfile {
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

export interface Message {
  id: string
  agentId: string
  content: string
  summary: string
  timestamp: number
}

export interface OrchestrationDebug {
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

interface TurtleBrainState {
  agents: AgentProfile[]
  topic: string
  inputPaths: string[]
  turnLimit: number
  currentTurn: number
  environment: 'sandbox' | 'full'
  handRaiseMode: HandRaiseMode
  executionMode: ExecutionMode
  discussionStyle: DiscussionStyle
  messages: Message[]
  sessionStatus: 'idle' | 'running' | 'finished'
  finalConclusion: string | null
  sessionError: string | null
  backendSessionId: string | null
  orchestrationDebug: OrchestrationDebug | null
  providerCatalogs: ProviderCatalogMap
  providerCatalogStatus: 'idle' | 'loading' | 'ready' | 'error'
  providerCatalogError: string | null
  setTopic: (topic: string) => void
  setInputPaths: (paths: string[]) => void
  setExecutionMode: (mode: ExecutionMode) => void
  setDiscussionStyle: (style: DiscussionStyle) => void
  setHandRaiseMode: (mode: HandRaiseMode) => void
  setTurnLimit: (limit: number) => void
  addAgent: (agent: AgentProfile) => void
  updateAgent: (id: string, updates: Partial<AgentProfile>) => void
  removeAgent: (id: string) => void
  resetAgentsToDefault: () => void
  resetAgentToDefault: (id: string) => void
  refreshProviderCatalogs: (force?: boolean) => Promise<void>
  startSession: (topic: string, inputPaths?: string[]) => void
  stopSession: () => void
  clearSessionError: () => void
  resetSession: () => void
  processNextTurn: () => Promise<void>
}

function createEmptyRateLimits(): AgentRateLimits {
  return {
    daily: null,
    weekly: null,
    source: null
  }
}

function createProviderModel(
  id: string,
  name: string,
  options?: {
    description?: string
    supportedReasoningEfforts?: ReasoningEffort[]
    defaultReasoningEffort?: ReasoningEffort | null
    billingMultiplier?: number | null
  }
): ProviderModelInfo {
  return {
    id,
    name,
    description: options?.description,
    supportedReasoningEfforts: options?.supportedReasoningEfforts ?? [],
    defaultReasoningEffort: options?.defaultReasoningEffort ?? null,
    billingMultiplier: options?.billingMultiplier ?? null
  }
}

function createFallbackProviderCatalogs(): ProviderCatalogMap {
  return {
    codex: {
      provider: 'codex',
      label: 'Codex CLI',
      source: 'fallback',
      fetchedAt: null,
      available: true,
      error: null,
      models: [
        createProviderModel('gpt-5.4', 'gpt-5.4', {
          description: 'Latest frontier agentic coding model.',
          supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
          defaultReasoningEffort: 'medium'
        }),
        createProviderModel('gpt-5.4-mini', 'gpt-5.4-mini', {
          supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
          defaultReasoningEffort: 'medium'
        }),
        createProviderModel('gpt-5.3-codex', 'gpt-5.3-codex', {
          supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
          defaultReasoningEffort: 'medium'
        }),
        createProviderModel('gpt-5.2-codex', 'gpt-5.2-codex', {
          supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
          defaultReasoningEffort: 'medium'
        }),
        createProviderModel('gpt-5.2', 'gpt-5.2', {
          supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
          defaultReasoningEffort: 'medium'
        }),
        createProviderModel('gpt-5.1-codex-max', 'gpt-5.1-codex-max', {
          supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
          defaultReasoningEffort: 'medium'
        }),
        createProviderModel('gpt-5.1-codex', 'gpt-5.1-codex', {
          supportedReasoningEfforts: ['low', 'medium', 'high'],
          defaultReasoningEffort: 'medium'
        }),
        createProviderModel('gpt-5.1', 'gpt-5.1', {
          supportedReasoningEfforts: ['low', 'medium', 'high'],
          defaultReasoningEffort: 'medium'
        }),
        createProviderModel('gpt-5.1-codex-mini', 'gpt-5.1-codex-mini', {
          supportedReasoningEfforts: ['medium', 'high'],
          defaultReasoningEffort: 'medium'
        })
      ]
    },
    gemini: {
      provider: 'gemini',
      label: 'Gemini CLI',
      source: 'fallback',
      fetchedAt: null,
      available: true,
      error: null,
      models: [
        createProviderModel('auto-gemini-3', 'Auto (Gemini 3)'),
        createProviderModel('auto-gemini-2.5', 'Auto (Gemini 2.5)'),
        createProviderModel('gemini-3.1-pro-preview', 'Gemini 3.1 Pro Preview'),
        createProviderModel('gemini-3.1-pro-preview-customtools', 'Gemini 3.1 Pro Preview Custom Tools'),
        createProviderModel('gemini-3-flash-preview', 'Gemini 3 Flash Preview'),
        createProviderModel('gemini-3.1-flash-lite-preview', 'Gemini 3.1 Flash Lite Preview'),
        createProviderModel('gemini-2.5-pro', 'Gemini 2.5 Pro'),
        createProviderModel('gemini-2.5-flash', 'Gemini 2.5 Flash'),
        createProviderModel('gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite')
      ]
    },
    copilot: {
      provider: 'copilot',
      label: 'GitHub Copilot CLI',
      source: 'fallback',
      fetchedAt: null,
      available: true,
      error: null,
      models: [
        createProviderModel('claude-sonnet-4.6', 'Claude Sonnet 4.6', {
          supportedReasoningEfforts: ['low', 'medium', 'high'],
          defaultReasoningEffort: 'medium',
          billingMultiplier: 1
        }),
        createProviderModel('claude-opus-4.6', 'Claude Opus 4.6', {
          supportedReasoningEfforts: ['low', 'medium', 'high'],
          defaultReasoningEffort: 'high',
          billingMultiplier: 3
        }),
        createProviderModel('gemini-3-pro-preview', 'Gemini 3 Pro (Preview)', {
          billingMultiplier: 1
        }),
        createProviderModel('gpt-5.4', 'GPT-5.4', {
          supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
          defaultReasoningEffort: 'medium',
          billingMultiplier: 1
        }),
        createProviderModel('gpt-5.3-codex', 'GPT-5.3-Codex', {
          supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
          defaultReasoningEffort: 'medium',
          billingMultiplier: 1
        }),
        createProviderModel('gpt-5.2-codex', 'GPT-5.2-Codex', {
          supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
          defaultReasoningEffort: 'high',
          billingMultiplier: 1
        }),
        createProviderModel('gpt-5.2', 'GPT-5.2', {
          supportedReasoningEfforts: ['low', 'medium', 'high'],
          defaultReasoningEffort: 'medium',
          billingMultiplier: 1
        }),
        createProviderModel('gpt-5.1-codex-max', 'GPT-5.1-Codex-Max', {
          supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
          defaultReasoningEffort: 'medium',
          billingMultiplier: 1
        }),
        createProviderModel('gpt-5.1-codex', 'GPT-5.1-Codex', {
          supportedReasoningEfforts: ['low', 'medium', 'high'],
          defaultReasoningEffort: 'medium',
          billingMultiplier: 1
        }),
        createProviderModel('gpt-5.1', 'GPT-5.1', {
          supportedReasoningEfforts: ['low', 'medium', 'high'],
          defaultReasoningEffort: 'medium',
          billingMultiplier: 1
        }),
        createProviderModel('gpt-5.1-codex-mini', 'GPT-5.1-Codex-Mini', {
          supportedReasoningEfforts: ['low', 'medium', 'high'],
          defaultReasoningEffort: 'medium',
          billingMultiplier: 0.33
        }),
        createProviderModel('gpt-5-mini', 'GPT-5 mini', {
          supportedReasoningEfforts: ['low', 'medium', 'high'],
          defaultReasoningEffort: 'medium',
          billingMultiplier: 0
        })
      ]
    }
  }
}

function getDefaultCatalogs(): ProviderCatalogMap {
  return createFallbackProviderCatalogs()
}

function cloneCatalogs(catalogs: ProviderCatalogMap): ProviderCatalogMap {
  return {
    codex: { ...catalogs.codex, models: catalogs.codex.models.map((model) => ({ ...model })) },
    gemini: { ...catalogs.gemini, models: catalogs.gemini.models.map((model) => ({ ...model })) },
    copilot: { ...catalogs.copilot, models: catalogs.copilot.models.map((model) => ({ ...model })) }
  }
}

function createAgent(
  partial: Pick<AgentProfile, 'id' | 'name' | 'role' | 'stance' | 'personality'> &
    Partial<Pick<AgentProfile, 'provider' | 'model' | 'reasoningEffort'>>
): AgentProfile {
  return {
    provider: partial.provider ?? 'codex',
    model: partial.model ?? 'gpt-5.4',
    reasoningEffort: partial.reasoningEffort ?? 'medium',
    runtimeSessionId: null,
    rateLimits: createEmptyRateLimits(),
    status: 'idle',
    handRaiseIntensity: 0,
    speakCount: 0,
    ...partial
  }
}

const conversationDefaultAgents: AgentProfile[] = [
  createAgent({
    id: 'agent-1',
    name: '技術担当',
    role: 'Participant',
    stance: '新規性重視 / ユーザー価値重視',
    personality: '率直・論理的 / 高速・実務的',
    provider: 'codex',
    model: 'gpt-5.4'
  }),
  createAgent({
    id: 'agent-2',
    name: '品質担当',
    role: 'Participant',
    stance: '批判的検証 / 品質・リスク管理',
    personality: '丁寧・堅実 / 慎重・分析的',
    provider: 'copilot',
    model: 'gpt-5.2'
  })
]

const meetingDefaultAgents: AgentProfile[] = [
  createAgent({
    id: 'agent-1',
    name: '技術担当',
    role: 'Participant',
    stance: '新規性重視 / コスト最適化',
    personality: '高速・実務的 / 大胆・発想型',
    provider: 'codex',
    model: 'gpt-5.4'
  }),
  createAgent({
    id: 'agent-2',
    name: '品質担当',
    role: 'Participant',
    stance: '品質・リスク管理 / 長期運用重視',
    personality: '丁寧・堅実 / 慎重・分析的',
    provider: 'copilot',
    model: 'gpt-5.2'
  }),
  createAgent({
    id: 'agent-3',
    name: 'ユーザー担当',
    role: 'Participant',
    stance: 'ユーザー価値重視 / 中立・バランス',
    personality: 'フレンドリー / 率直・論理的',
    provider: 'gemini',
    model: 'gemini-2.5-flash'
  }),
  createAgent({
    id: 'moderator',
    name: 'ファシリテータ',
    role: 'Facilitator',
    stance: '進行管理 / 中立・バランス',
    personality: '丁寧・堅実 / フレンドリー',
    provider: 'codex',
    model: 'gpt-5.4'
  })
]

function cloneAgents(agents: AgentProfile[]): AgentProfile[] {
  return agents.map((agent) => ({
    ...agent,
    rateLimits: agent.rateLimits
      ? {
          source: agent.rateLimits.source,
          daily: agent.rateLimits.daily ? { ...agent.rateLimits.daily } : null,
          weekly: agent.rateLimits.weekly ? { ...agent.rateLimits.weekly } : null
        }
      : createEmptyRateLimits()
  }))
}

function getDiscussionStyleDefaults(style: DiscussionStyle): {
  agents: AgentProfile[]
  turnLimit: number
  handRaiseMode: HandRaiseMode
} {
  if (style === 'conversation') {
    return {
      agents: cloneAgents(conversationDefaultAgents),
      turnLimit: 3,
      handRaiseMode: 'rule-based'
    }
  }

  return {
    agents: cloneAgents(meetingDefaultAgents),
    turnLimit: 3,
    handRaiseMode: 'rule-based'
  }
}

function getAgentInteractionErrorMessage(error: unknown, details?: string): string {
  if (details) {
    return `エージェント処理に失敗しました: ${details}`
  }

  if (error instanceof TypeError) {
    return 'バックエンドへ接続できませんでした。サーバーが起動しているか確認してください。'
  }

  if (error instanceof Error && error.message) {
    if (/ENAMETOOLONG/i.test(error.message)) {
      return 'エージェント処理に失敗しました: コマンド引数が長すぎます。古いバックエンドが動いたままの可能性が高いので、サーバーを再起動してください。今回の修正以降は server 側も自動再起動されます。'
    }

    return `エージェント処理に失敗しました: ${error.message}`
  }

  return 'エージェント処理で不明なエラーが発生しました。'
}

function sanitizeAgents(agents: AgentProfile[]): AgentProfile[] {
  return agents.map((agent) => ({
    ...agent,
    runtimeSessionId: null,
    rateLimits: agent.rateLimits ?? createEmptyRateLimits(),
    status: 'idle',
    speakCount: 0,
    handRaiseIntensity: 0
  }))
}

function normalizeCatalog(raw: ProviderCatalog, fallback: ProviderCatalog): ProviderCatalog {
  const models = (raw.models?.length ? raw.models : fallback.models).map((model) => ({
    id: model.id,
    name: model.name || model.id,
    description: model.description,
    supportedReasoningEfforts: model.supportedReasoningEfforts ?? [],
    defaultReasoningEffort: model.defaultReasoningEffort ?? null,
    billingMultiplier: model.billingMultiplier ?? null
  }))

  return {
    provider: raw.provider,
    label: raw.label || fallback.label,
    source: raw.source || fallback.source,
    fetchedAt: raw.fetchedAt ?? null,
    available: raw.available ?? true,
    error: raw.error ?? null,
    models
  }
}

export const useStore = create<TurtleBrainState>((set, get) => ({
  agents: cloneAgents(conversationDefaultAgents),
  topic: '',
  inputPaths: [],
  turnLimit: 3,
  currentTurn: 0,
  environment: 'sandbox',
  handRaiseMode: 'rule-based',
  executionMode: 'orchestration',
  discussionStyle: 'conversation',
  messages: [],
  sessionStatus: 'idle',
  finalConclusion: null,
  sessionError: null,
  backendSessionId: null,
  orchestrationDebug: null,
  providerCatalogs: getDefaultCatalogs(),
  providerCatalogStatus: 'idle',
  providerCatalogError: null,

  setTopic: (topic) => set({ topic }),
  setInputPaths: (inputPaths) => set({ inputPaths }),

  setExecutionMode: (executionMode) =>
    set(() => ({
      executionMode,
      messages: [],
      currentTurn: 0,
      finalConclusion: null,
      sessionError: null,
      backendSessionId: null,
      orchestrationDebug: null,
      sessionStatus: 'idle'
    })),

  setDiscussionStyle: (discussionStyle) =>
    set(() => ({
      discussionStyle,
      ...getDiscussionStyleDefaults(discussionStyle),
      messages: [],
      currentTurn: 0,
      finalConclusion: null,
      sessionError: null,
      backendSessionId: null,
      orchestrationDebug: null,
      sessionStatus: 'idle'
    })),

  setHandRaiseMode: (handRaiseMode) => set({ handRaiseMode }),
  setTurnLimit: (turnLimit) => set({ turnLimit }),

  addAgent: (agent) =>
    set((state) => ({
      agents: [...state.agents, { ...agent, rateLimits: agent.rateLimits ?? createEmptyRateLimits() }]
    })),

  updateAgent: (id, updates) =>
    set((state) => ({
      agents: state.agents.map((agent) =>
        agent.id === id
          ? {
              ...agent,
              ...updates,
              rateLimits: updates.rateLimits ?? agent.rateLimits
            }
          : agent
      )
    })),

  removeAgent: (id) =>
    set((state) => ({
      agents: state.agents.filter((agent) => agent.id !== id)
    })),

  resetAgentsToDefault: () =>
    set((state) => ({
      agents: getDiscussionStyleDefaults(state.discussionStyle).agents
    })),

  resetAgentToDefault: (id) =>
    set((state) => {
      const defaults = getDiscussionStyleDefaults(state.discussionStyle).agents
      const defaultAgent = defaults.find((agent) => agent.id === id)
      if (!defaultAgent) {
        return state
      }

      return {
        agents: state.agents.map((agent) => (agent.id === id ? { ...defaultAgent } : agent))
      }
    }),

  refreshProviderCatalogs: async (force = false) => {
    const fallbackCatalogs = getDefaultCatalogs()

    set((state) => ({
      providerCatalogStatus: 'loading',
      providerCatalogError: null,
      providerCatalogs: state.providerCatalogStatus === 'idle' ? fallbackCatalogs : state.providerCatalogs
    }))

    try {
      const data = await apiRequestJson<{
        success?: boolean
        catalogs?: ProviderCatalogMap
        details?: string
        error?: string
      }>(`/api/providers/catalogs${force ? '?refresh=1' : ''}`)

      if (!data?.success || !data?.catalogs) {
        throw new Error(data?.details || data?.error || 'モデル候補を取得できませんでした。')
      }

      const incoming = data.catalogs as ProviderCatalogMap
      const mergedCatalogs: ProviderCatalogMap = {
        codex: normalizeCatalog(incoming.codex ?? fallbackCatalogs.codex, fallbackCatalogs.codex),
        gemini: normalizeCatalog(incoming.gemini ?? fallbackCatalogs.gemini, fallbackCatalogs.gemini),
        copilot: normalizeCatalog(incoming.copilot ?? fallbackCatalogs.copilot, fallbackCatalogs.copilot)
      }

      set({
        providerCatalogs: cloneCatalogs(mergedCatalogs),
        providerCatalogStatus: 'ready',
        providerCatalogError: null
      })
    } catch (error) {
      set((state) => ({
        providerCatalogStatus: 'error',
        providerCatalogError: error instanceof Error ? error.message : String(error),
        providerCatalogs: state.providerCatalogs
      }))
    }
  },

  startSession: (topic, inputPaths = []) =>
    set((state) => ({
      topic: topic.trim(),
      inputPaths,
      sessionStatus: 'running',
      currentTurn: 1,
      messages: [],
      finalConclusion: null,
      sessionError: null,
      backendSessionId: null,
      orchestrationDebug: null,
      agents: sanitizeAgents(state.agents)
    })),

  stopSession: () => set({ sessionStatus: 'finished' }),

  clearSessionError: () => set({ sessionError: null }),

  resetSession: () =>
    set((state) => ({
      topic: '',
      inputPaths: [],
      sessionStatus: 'idle',
      messages: [],
      currentTurn: 0,
      finalConclusion: null,
      sessionError: null,
      backendSessionId: null,
      orchestrationDebug: null,
      agents: sanitizeAgents(state.agents)
    })),

  processNextTurn: async () => {
    const state = get()
    if (state.sessionStatus !== 'running') {
      return
    }

    try {
      const data = await apiRequestJson<{
        success?: boolean
        sessionId: string | null
        agents: AgentProfile[]
        messages: Message[]
        currentTurn: number
        sessionStatus: TurtleBrainState['sessionStatus']
        finalConclusion: string | null
        debug: OrchestrationDebug | null
        details?: string
        error?: string
      }>('/api/orchestrator/run-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.backendSessionId,
          topic: state.topic,
          inputPaths: state.inputPaths,
          discussionStyle: state.discussionStyle,
          turnLimit: state.turnLimit,
          agents: state.agents
        })
      })

      if (!data.success) {
        throw new Error(data.details || data.error || 'オーケストレーションの実行に失敗しました。')
      }

      set({
        backendSessionId: data.sessionId,
        agents: data.agents,
        messages: data.messages,
        currentTurn: data.currentTurn,
        sessionStatus: data.sessionStatus,
        finalConclusion: data.finalConclusion,
        orchestrationDebug: data.debug,
        sessionError: null
      })
    } catch (error) {
      console.error('Agent interaction failed:', error)
      set({
        sessionStatus: 'finished',
        sessionError: getAgentInteractionErrorMessage(error)
      })
    }
  }
}))
