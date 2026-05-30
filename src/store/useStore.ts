import { create } from 'zustand'
import {
  PERSONALITY_PRESETS,
  PERSONALITY_VALUE_ALIASES,
  STANCE_PRESETS,
  STANCE_VALUE_ALIASES,
  getViewpointRolePreset,
  normalizeSelectableValue
} from '../config/agentMetadata'
import { getDefaultBuiltInAgentIcon, type BuiltInAgentIconId } from '../config/iconAssets'
import { apiRequestJson } from '../lib/apiClient'

export type AgentRole = 'Participant' | 'Facilitator'
export type HandRaiseMode = 'rule-based' | 'ai-evaluation'
export type ExecutionMode = 'orchestration' | 'autonomous'
export type DiscussionStyle = 'conversation' | 'meeting'
export type AgentCliProvider = 'codex' | 'gemini' | 'copilot' | 'claude'
export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh'
export type AgentViewpointRoleId =
  | 'executive-business'
  | 'operations'
  | 'project-management'
  | 'customer-user'
  | 'sales-market'
  | 'technical-practice'
  | 'quality-qms'
  | 'research-development'
  | 'finance-accounting'
  | 'people-organization'
  | 'legal-compliance-ip'
  | 'security-risk'

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
  viewpointRoleId: AgentViewpointRoleId | null
  viewpointFocus: string
  viewpointAvoid: string
  avatarPreset: BuiltInAgentIconId | null
  avatarCustomDataUrl: string | null
  avatarCustomName: string | null
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

export interface StructuredFinalConclusion {
  schemaVersion: 1
  title: string
  conclusionSummary: string
  finalAnswer: string
  reasoning: string[]
  supportingPoints: string[]
  counterArguments: string[]
  unresolvedIssues: string[]
  risks: string[]
  confidence: {
    score: number
    reason: string
  }
  nextActions: Array<{
    label: string
    detail: string
    priority: 'high' | 'medium' | 'low'
  }>
}

export type ConvergenceStatus = 'exploring' | 'debating' | 'needs_verification' | 'ready_to_conclude' | 'blocked'

export interface DeliberationState {
  agenda: string[]
  claims: Array<{
    id: string
    text: string
    supportLevel: 'weak' | 'medium' | 'strong'
    challengedBy: string[]
  }>
  openIssues: string[]
  disagreements: string[]
  evidenceGaps: string[]
  consensus: {
    level: number
    summary: string
  }
  convergence: {
    status: ConvergenceStatus
    reason: string
    confidence: number
    recommendedNextFocus: string | null
  }
}

export interface ConvergenceDecision {
  readyToConclude: boolean
  confidence: number
  reason: string
  remainingIssues: string[]
  nextFocus: string | null
}

export interface OrchestrationDebug {
  sessionId: string
  turn: number
  executionMode: ExecutionMode
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
    unresolvedIssues: string[]
    evidenceGaps: string[]
    readyToConclude: boolean
    recommendedNextFocus: string | null
  } | null
  deliberationState: DeliberationState | null
  convergenceDecision: ConvergenceDecision | null
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
    kind: 'score' | 'moderation' | 'speech' | 'synthesis' | 'deliberation' | 'autonomous'
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
  finalConclusionStructured: StructuredFinalConclusion | null
  sessionError: string | null
  backendSessionId: string | null
  sessionRunNonce: number
  orchestrationDebug: OrchestrationDebug | null
  providerCatalogs: ProviderCatalogMap
  providerCatalogStatus: 'idle' | 'loading' | 'ready' | 'error'
  providerCatalogError: string | null
  setTopic: (topic: string) => void
  setInputPaths: (paths: string[]) => void
  setExecutionMode: (mode: ExecutionMode) => void
  setDiscussionStyle: (style: DiscussionStyle) => void
  setTurnLimit: (limit: number) => void
  addAgent: (agent: AgentProfile) => void
  updateAgent: (id: string, updates: Partial<AgentProfile>) => void
  removeAgent: (id: string) => void
  resetAgentsToDefault: () => void
  resetAgentToDefault: (id: string) => void
  saveSettings: () => void
  clearSavedSettings: () => void
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
        createProviderModel('gpt-5.5', 'gpt-5.5', {
          description: 'Latest frontier agentic coding model.',
          supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
          defaultReasoningEffort: 'medium'
        }),
        createProviderModel('gpt-5.4', 'gpt-5.4', {
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
    },
    claude: {
      provider: 'claude',
      label: 'Claude Code',
      source: 'fallback',
      fetchedAt: null,
      available: true,
      error: null,
      models: [
        createProviderModel('sonnet', 'Sonnet (latest alias)', {
          description: 'Claude Code latest Sonnet alias.',
          supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
          defaultReasoningEffort: 'medium'
        }),
        createProviderModel('opus', 'Opus (latest alias)', {
          description: 'Claude Code latest Opus alias.',
          supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
          defaultReasoningEffort: 'high'
        }),
        createProviderModel('claude-sonnet-4-6', 'Claude Sonnet 4.6', {
          supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
          defaultReasoningEffort: 'medium'
        }),
        createProviderModel('claude-opus-4-6', 'Claude Opus 4.6', {
          supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'],
          defaultReasoningEffort: 'high'
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
    copilot: { ...catalogs.copilot, models: catalogs.copilot.models.map((model) => ({ ...model })) },
    claude: { ...catalogs.claude, models: catalogs.claude.models.map((model) => ({ ...model })) }
  }
}

function normalizeAgentSelections<T extends { stance: string; personality: string }>(agent: T): T {
  return {
    ...agent,
    stance: normalizeSelectableValue(agent.stance, STANCE_PRESETS, STANCE_VALUE_ALIASES),
    personality: normalizeSelectableValue(agent.personality, PERSONALITY_PRESETS, PERSONALITY_VALUE_ALIASES)
  }
}

function normalizeViewpointRoleId(value: unknown): AgentViewpointRoleId | null {
  return typeof value === 'string' && getViewpointRolePreset(value as AgentViewpointRoleId)
    ? value as AgentViewpointRoleId
    : null
}

const LEGACY_VIEWPOINT_DEFAULTS: Partial<
  Record<AgentViewpointRoleId, { focus?: string[]; avoid?: string[] }>
> = {
  'executive-business': {
    focus: [
      '事業目的、投資対効果、意思決定の優先順位、長期的な責任範囲を重視する。',
      '事業目的、収益性、投資判断、長期方針から議論を整理します。'
    ],
    avoid: [
      '細部の実装論だけに寄りすぎず、事業上の判断材料へ戻す。',
      '細部の実装論だけに寄らず、事業上の判断材料へ戻します。',
      '細部の実装論だけで判断せず、投資判断・優先順位・長期影響へ戻します。',
      '短期の好みや実装詳細だけで意思決定しません。',
      '短期の好みや実装詳細だけでの意思決定'
    ]
  },
  'customer-user': {
    focus: [
      '利用者の価値、困りごと、理解しやすさ、導入時の心理的抵抗を重視する。',
      '利用者の価値、困りごと、理解しやすさ、導入時の抵抗感から確認します。'
    ],
    avoid: [
      '提供側の都合だけで判断せず、使う人の行動と負担に引き戻す。',
      '提供側の都合だけで判断せず、使う人の行動と負担へ引き戻します。',
      '提供側の都合や作り手目線に偏らず、利用者の行動・負担・受容性で確認します。',
      '提供側の都合をそのまま受け入れず、分かりにくさや利用負担を見過ごしません。',
      '提供側の都合だけでの判断、分かりにくさや利用負担の見落とし'
    ]
  },
  'sales-market': {
    focus: [
      '提案価値、市場性、競合差別化、商談で説明しやすいメッセージを重視する。',
      '提案価値、市場性、競合差別化、説明しやすさから売れる理由を整理します。'
    ],
    avoid: [
      '社内都合の説明に寄りすぎず、顧客が買う理由を明確にする。',
      '社内都合の説明に寄りすぎず、顧客が買う理由を明確にします。',
      '機能説明や社内都合に寄りすぎず、顧客が買う理由と伝わり方を確認します。',
      '機能説明だけで売れると見なさず、顧客の購買理由が弱い提案を通しません。'
    ]
  },
  operations: {
    focus: [
      '現場負荷、業務手順、運用継続性、例外対応、教育しやすさを重視する。',
      '現場負荷、業務手順、継続運用、例外対応から実行しやすさを確認します。'
    ],
    avoid: [
      '理想論だけで進めず、日々の運用で詰まる点を具体化する。',
      '理想論だけで進めず、日々の運用で詰まる点を具体化します。',
      '理想的な手順だけで進めず、繁忙時・例外時・担当者負荷まで確認します。',
      '理想的な手順だけで納得せず、繁忙時・例外時・担当者負荷を見落としません。'
    ]
  },
  'project-management': {
    focus: [
      'スケジュール、担当、依存関係、意思決定ポイント、実行順序を重視する。',
      'スケジュール、担当、依存関係、意思決定ポイントから実行順序を整理します。',
      '目的、優先順位、スケジュール、担当、依存関係から実行順序を整理します。'
    ],
    avoid: [
      '抽象論で終わらせず、次に動ける単位へ分解する。',
      '抽象論で終わらせず、次に動ける単位へ分解します。',
      '方針や期待だけで進めず、担当・期限・依存関係を実行単位へ落とします。',
      '方針や期待だけで進行せず、担当・期限・依存関係を曖昧なままにしません。'
    ]
  },
  'research-development': {
    focus: [
      '新規性、実験仮説、技術探索、将来価値から可能性を確認します。'
    ]
  },
  'technical-practice': {
    focus: [
      '実装可能性、品質、保守性、技術負債、専門的な制約を重視する。',
      '実装可能性、品質、保守性、技術負債、専門的制約から妥当性を確認します。',
      '設計、実装難易度、保守性、リリース影響から世に出せる形を確認します。'
    ],
    avoid: [
      '技術的な正しさだけでなく、事業・運用上の妥当性も考慮する。',
      '技術的な正しさだけに寄らず、事業・運用上の妥当性も考慮します。',
      '技術的な正しさだけで完結させず、導入・運用・保守の現実性も確認します。',
      '技術的な正しさだけを優先せず、導入・運用・保守の無理を見過ごしません。',
      '技術的な正しさだけの優先、導入・運用・保守の無理の見落とし',
      '研究段階の可能性だけでの判断、保守・移行・リリース負荷の見落とし'
    ]
  },
  'quality-qms': {
    focus: [
      '品質基準、検証方法、標準化、監査性、不具合予防から確認します。'
    ]
  },
  'finance-accounting': {
    focus: [
      '初期費用、継続費用、予算、採算、費用対効果、会計上の扱いを重視する。',
      '初期費用、継続費用、予算、採算、費用対効果から判断材料を整理します。'
    ],
    avoid: [
      '効果を定性的な期待だけで扱わず、金額・期間・根拠へ落とす。',
      '効果を定性的な期待だけで扱わず、金額・期間・根拠へ落とします。',
      '定性的な期待だけで判断せず、金額・期間・回収根拠へ落とします。',
      '効果を期待値だけで認めず、費用・期間・回収根拠を曖昧なままにしません。'
    ]
  },
  'people-organization': {
    focus: [
      '人員配置、教育、採用、評価、心理的安全性、組織への影響を重視する。',
      '人員配置、教育、採用、評価、心理的安全性から組織影響を確認します。'
    ],
    avoid: [
      '制度や人の負担を軽視せず、継続可能な働き方として考える。',
      '制度や人の負担を軽視せず、継続可能な働き方として考えます。',
      '制度設計だけで完結させず、人員負荷・育成・納得感まで確認します。',
      '制度や体制だけで成立すると見なさず、人員負荷・育成・納得感を軽視しません。'
    ]
  },
  'legal-compliance-ip': {
    focus: [
      '契約、規制、責任範囲、知財、コンプライアンス上の説明可能性を重視する。',
      '契約、規制、責任範囲、知財、説明可能性からリスクを確認します。'
    ],
    avoid: [
      'リスクを過度に恐れて止めるだけでなく、条件付きで進める方法も探す。',
      'リスクを恐れて止めるだけでなく、条件付きで進める方法も探します。',
      'リスク指摘だけで止めず、条件・責任範囲・代替案を明確にします。',
      '契約・規制・権利関係が曖昧なまま進めません。'
    ]
  },
  'security-risk': {
    focus: [
      '情報管理、権限、監査、事故対応、BCP、悪用可能性を重視する。',
      '情報管理、権限、監査、事故対応、BCP、悪用可能性から安全性を確認します。'
    ],
    avoid: [
      '不安を並べるだけでなく、現実的な対策と残余リスクを分けて示す。',
      '不安を並べるだけでなく、現実的な対策と残余リスクを分けて示します。',
      '危険性を並べるだけで終えず、優先度・対策・残余リスクを分けて示します。',
      '安全性を根拠なく楽観視せず、対策や残余リスクを曖昧なままにしません。'
    ]
  }
}

function normalizePresetBackedField(
  value: string | null | undefined,
  currentDefault: string,
  legacyDefaults: string[] | undefined
): string {
  if (value === null || value === undefined) {
    return currentDefault
  }

  return legacyDefaults?.includes(value) ? currentDefault : value
}

function ensureAgentProfileState(agent: AgentProfile, index = 0): AgentProfile {
  const rawAgent = agent as AgentProfile & {
    avatarPreset?: BuiltInAgentIconId | null
    avatarCustomDataUrl?: string | null
    avatarCustomName?: string | null
    viewpointRoleId?: AgentViewpointRoleId | null
    viewpointFocus?: string | null
    viewpointAvoid?: string | null
  }
  const viewpointRoleId = normalizeViewpointRoleId(rawAgent.viewpointRoleId)
  const viewpointPreset = getViewpointRolePreset(viewpointRoleId)
  const legacyDefaults = viewpointRoleId ? LEGACY_VIEWPOINT_DEFAULTS[viewpointRoleId] : undefined

  return {
    ...agent,
    viewpointRoleId,
    viewpointFocus: normalizePresetBackedField(
      rawAgent.viewpointFocus,
      viewpointPreset?.defaultFocus ?? '',
      legacyDefaults?.focus
    ),
    viewpointAvoid: normalizePresetBackedField(
      rawAgent.viewpointAvoid,
      viewpointPreset?.defaultAvoid ?? '',
      legacyDefaults?.avoid
    ),
    avatarPreset:
      rawAgent.avatarPreset === undefined ? getDefaultBuiltInAgentIcon(index) : (rawAgent.avatarPreset ?? null),
    avatarCustomDataUrl: rawAgent.avatarCustomDataUrl ?? null,
    avatarCustomName: rawAgent.avatarCustomName ?? null
  }
}

function createAgent(
  partial: Pick<AgentProfile, 'id' | 'name' | 'role' | 'stance' | 'personality'> &
    Partial<
      Pick<
        AgentProfile,
        | 'provider'
        | 'model'
        | 'reasoningEffort'
        | 'viewpointRoleId'
        | 'viewpointFocus'
        | 'viewpointAvoid'
        | 'avatarPreset'
        | 'avatarCustomDataUrl'
        | 'avatarCustomName'
      >
    >
): AgentProfile {
  const viewpointPreset = getViewpointRolePreset(partial.viewpointRoleId ?? null)
  const baseAgent: AgentProfile = {
    provider: partial.provider ?? 'codex',
    model: partial.model ?? 'gpt-5.4',
    reasoningEffort: partial.reasoningEffort ?? 'medium',
    viewpointRoleId: partial.viewpointRoleId ?? null,
    viewpointFocus: partial.viewpointFocus ?? viewpointPreset?.defaultFocus ?? '',
    viewpointAvoid: partial.viewpointAvoid ?? viewpointPreset?.defaultAvoid ?? '',
    avatarPreset: partial.avatarPreset ?? null,
    avatarCustomDataUrl: partial.avatarCustomDataUrl ?? null,
    avatarCustomName: partial.avatarCustomName ?? null,
    runtimeSessionId: null,
    rateLimits: createEmptyRateLimits(),
    status: 'idle',
    handRaiseIntensity: 0,
    speakCount: 0,
    ...partial
  }

  return ensureAgentProfileState(normalizeAgentSelections(baseAgent))
}

const conversationDefaultAgents: AgentProfile[] = [
  createAgent({
    id: 'agent-1',
    name: 'エージェントA',
    role: 'Participant',
    stance: 'アイデア出し・新規性重視',
    personality: '率直・論理的',
    avatarPreset: 'user_icon1',
    viewpointRoleId: 'executive-business',
    provider: 'codex',
    model: 'gpt-5.5'
  }),
  createAgent({
    id: 'agent-2',
    name: 'エージェントB',
    role: 'Participant',
    stance: '批判的・データ重視',
    personality: '丁寧・堅実',
    avatarPreset: 'user_icon2',
    viewpointRoleId: 'customer-user',
    provider: 'copilot',
    model: 'gpt-5.2'
  })
]

const meetingDefaultAgents: AgentProfile[] = [
  createAgent({
    id: 'agent-1',
    name: 'エージェントA',
    role: 'Participant',
    stance: 'アイデア出し・新規性重視',
    personality: '率直・論理的',
    avatarPreset: 'user_icon1',
    viewpointRoleId: 'executive-business',
    provider: 'codex',
    model: 'gpt-5.5'
  }),
  createAgent({
    id: 'agent-2',
    name: 'エージェントB',
    role: 'Participant',
    stance: '品質重視・リスク分析',
    personality: '慎重・分析的',
    avatarPreset: 'user_icon2',
    viewpointRoleId: 'quality-qms',
    provider: 'copilot',
    model: 'gpt-5.2'
  }),
  createAgent({
    id: 'agent-3',
    name: 'エージェントC',
    role: 'Participant',
    stance: 'ユーザー目線',
    personality: '前向き・協調的',
    avatarPreset: 'user_icon3',
    viewpointRoleId: 'customer-user',
    provider: 'gemini',
    model: 'gemini-2.5-flash'
  }),
  createAgent({
    id: 'moderator',
    name: 'ファシリテータ',
    role: 'Facilitator',
    stance: '中立・合意形成重視',
    personality: '丁寧・俯瞰的',
    avatarPreset: 'user_icon4',
    viewpointRoleId: 'project-management',
    provider: 'codex',
    model: 'gpt-5.5'
  })
]

function cloneAgents(agents: AgentProfile[]): AgentProfile[] {
  return agents.map((agent, index) => ({
    ...ensureAgentProfileState(normalizeAgentSelections(agent), index),
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
    handRaiseMode: 'ai-evaluation'
  }
}

function getEffectiveHandRaiseMode(
  discussionStyle: DiscussionStyle,
  executionMode: ExecutionMode,
  handRaiseMode: HandRaiseMode
): HandRaiseMode {
  if (discussionStyle === 'meeting' && executionMode === 'orchestration') {
    return 'ai-evaluation'
  }

  return handRaiseMode === 'ai-evaluation' ? 'ai-evaluation' : 'rule-based'
}

const SETTINGS_STORAGE_KEY = 'turtle-brain:settings:v1'

interface PersistedSettingsSnapshot {
  version: 1
  discussionStyle: DiscussionStyle
  executionMode: ExecutionMode
  handRaiseMode: HandRaiseMode
  turnLimit: number
  agents: AgentProfile[]
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function loadPersistedSettings(): PersistedSettingsSnapshot | null {
  if (!canUseLocalStorage()) {
    return null
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<PersistedSettingsSnapshot>
    if (parsed.version !== 1) {
      return null
    }

    const discussionStyle: DiscussionStyle =
      parsed.discussionStyle === 'meeting' ? 'meeting' : 'conversation'
    const executionMode: ExecutionMode =
      parsed.executionMode === 'autonomous' ? 'autonomous' : 'orchestration'
    const handRaiseMode = getEffectiveHandRaiseMode(
      discussionStyle,
      executionMode,
      parsed.handRaiseMode === 'ai-evaluation' ? 'ai-evaluation' : 'rule-based'
    )
    const turnLimit =
      typeof parsed.turnLimit === 'number' && Number.isFinite(parsed.turnLimit)
        ? Math.max(1, Math.min(12, Math.trunc(parsed.turnLimit)))
        : getDiscussionStyleDefaults(discussionStyle).turnLimit

    const fallbackAgents = getDiscussionStyleDefaults(discussionStyle).agents
    const agents = Array.isArray(parsed.agents) && parsed.agents.length > 0
      ? sanitizeAgents(parsed.agents as AgentProfile[])
      : fallbackAgents

    return {
      version: 1,
      discussionStyle,
      executionMode,
      handRaiseMode,
      turnLimit,
      agents
    }
  } catch {
    return null
  }
}

function writePersistedSettings(snapshot: PersistedSettingsSnapshot): void {
  if (!canUseLocalStorage()) {
    return
  }

  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(snapshot))
}

function removePersistedSettings(): void {
  if (!canUseLocalStorage()) {
    return
  }

  window.localStorage.removeItem(SETTINGS_STORAGE_KEY)
}

const REQUIRED_BACKEND_FEATURE_MARKER = 'copilot-sdk-bridge-v3'

interface BackendHealthResponse {
  status?: string
  featureMarker?: string
  features?: {
    copilotSdkBridge?: boolean
  }
}

async function ensureCopilotBackendReady(agents: AgentProfile[]): Promise<void> {
  if (!agents.some((agent) => agent.provider === 'copilot')) {
    return
  }

  const health = await apiRequestJson<BackendHealthResponse>('/api/health')
  if (health.features?.copilotSdkBridge === true && health.featureMarker === REQUIRED_BACKEND_FEATURE_MARKER) {
    return
  }

  throw new Error('COPILOT_BACKEND_OUTDATED')
}

function getAgentInteractionErrorMessage(error: unknown, details?: string): string {
  if (details && /COPILOT_BACKEND_OUTDATED/i.test(details)) {
    return 'GitHub Copilot CLI の継続会話には新しいバックエンドが必要です。現在は古い server が 3001 番ポートに残っている可能性があります。server を再起動してください。'
  }

  if (error instanceof Error && /COPILOT_BACKEND_OUTDATED/i.test(error.message)) {
    return 'GitHub Copilot CLI の継続会話には新しいバックエンドが必要です。現在は古い server が 3001 番ポートに残っている可能性があります。server を再起動してください。'
  }

  if (error instanceof Error && /GitHub Copilot SDK runtime is not available/i.test(error.message)) {
    return 'GitHub Copilot SDK が見つからないため、継続会話モードを開始できませんでした。グローバルの Copilot CLI / SDK が見える状態で server を再起動してください。'
  }
  if (details) {
    return `エージェント処理に失敗しました: ${details}`
  }

  if (error instanceof TypeError) {
    return 'バックエンドへ接続できませんでした。サーバーが起動しているか確認してください。'
  }

  if (error instanceof Error && /ENAMETOOLONG/i.test(error.message)) {
    return 'GitHub Copilot CLI の実行が古い引数経路に落ちています。新しい SDK 継続経路が使われていないため、古い server が残っている可能性があります。server を再起動してください。'
  }

  if (error instanceof Error && /ENAMETOOLONG/i.test(error.message)) {
    return 'エージェント処理に失敗しました: CLI の起動引数が長すぎます。Copilot SDK の継続セッション経路が使えていない可能性があります。server を再起動し、それでも続く場合はバックエンドが旧経路のまま動いていないか確認してください。'
  }

  if (error instanceof Error && error.message) {
    if (/ENAMETOOLONG/i.test(error.message)) {
      return 'エージェント処理に失敗しました: CLI の起動引数が長すぎます。Copilot の継続実行経路を調整しているため、サーバー再起動後に新規セッションで再試行してください。'
    }

    return `エージェント処理に失敗しました: ${error.message}`
  }

  return 'エージェント処理で不明なエラーが発生しました。'
}

function sanitizeAgents(agents: AgentProfile[]): AgentProfile[] {
  return agents.map((agent, index) => ({
    ...ensureAgentProfileState(normalizeAgentSelections(agent), index),
    runtimeSessionId: null,
    rateLimits: agent.rateLimits ?? createEmptyRateLimits(),
    status: 'idle',
    speakCount: 0,
    handRaiseIntensity: 0
  }))
}

function reconcileAgentsWithCatalogs(agents: AgentProfile[], catalogs: ProviderCatalogMap): AgentProfile[] {
  return agents.map((agent, index) => {
    const normalizedAgent = ensureAgentProfileState(normalizeAgentSelections(agent), index)
    const providerCatalog = catalogs[agent.provider]
    const models = providerCatalog?.models ?? []
    const matchedModel = models.find((model) => model.id === normalizedAgent.model)
    const resolvedModel = matchedModel?.id ?? models[0]?.id ?? normalizedAgent.model
    const supportedReasoning = (matchedModel ?? models[0])?.supportedReasoningEfforts ?? []

    const reasoningEffort =
      supportedReasoning.length === 0
        ? normalizedAgent.reasoningEffort
        : supportedReasoning.includes(normalizedAgent.reasoningEffort)
          ? normalizedAgent.reasoningEffort
          : (matchedModel ?? models[0])?.defaultReasoningEffort ?? supportedReasoning[0] ?? normalizedAgent.reasoningEffort

    return {
      ...normalizedAgent,
      model: resolvedModel,
      reasoningEffort
    }
  })
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

let currentTurnAbortController: AbortController | null = null
const persistedSettings = loadPersistedSettings()
const initialDiscussionStyle = persistedSettings?.discussionStyle ?? 'conversation'
const initialExecutionMode = persistedSettings?.executionMode ?? 'orchestration'
const initialHandRaiseMode = getEffectiveHandRaiseMode(
  initialDiscussionStyle,
  initialExecutionMode,
  persistedSettings?.handRaiseMode ?? getDiscussionStyleDefaults(initialDiscussionStyle).handRaiseMode
)

export const useStore = create<TurtleBrainState>((set, get) => ({
  agents: persistedSettings?.agents ? cloneAgents(persistedSettings.agents) : cloneAgents(conversationDefaultAgents),
  topic: '',
  inputPaths: [],
  turnLimit: persistedSettings?.turnLimit ?? 3,
  currentTurn: 0,
  environment: 'sandbox',
  handRaiseMode: initialHandRaiseMode,
  executionMode: initialExecutionMode,
  discussionStyle: initialDiscussionStyle,
  messages: [],
  sessionStatus: 'idle',
  finalConclusion: null,
  finalConclusionStructured: null,
  sessionError: null,
  backendSessionId: null,
  sessionRunNonce: 0,
  orchestrationDebug: null,
  providerCatalogs: getDefaultCatalogs(),
  providerCatalogStatus: 'idle',
  providerCatalogError: null,

  setTopic: (topic) => set({ topic }),
  setInputPaths: (inputPaths) => set({ inputPaths }),

  setExecutionMode: (executionMode) =>
    set((state) => ({
      executionMode,
      handRaiseMode: getEffectiveHandRaiseMode(state.discussionStyle, executionMode, state.handRaiseMode),
      messages: [],
      currentTurn: 0,
      finalConclusion: null,
      finalConclusionStructured: null,
      sessionError: null,
      backendSessionId: null,
      sessionRunNonce: 0,
      orchestrationDebug: null,
      sessionStatus: 'idle'
    })),

  setDiscussionStyle: (discussionStyle) =>
    set((state) => {
      const defaults = getDiscussionStyleDefaults(discussionStyle)

      return {
        discussionStyle,
        ...defaults,
        handRaiseMode: getEffectiveHandRaiseMode(discussionStyle, state.executionMode, defaults.handRaiseMode),
        messages: [],
        currentTurn: 0,
        finalConclusion: null,
        finalConclusionStructured: null,
        sessionError: null,
        backendSessionId: null,
        sessionRunNonce: 0,
        orchestrationDebug: null,
        sessionStatus: 'idle'
      }
    }),

  setTurnLimit: (turnLimit) => set({ turnLimit }),

  addAgent: (agent) =>
    set((state) => ({
      agents: [
        ...state.agents,
        ensureAgentProfileState(
          normalizeAgentSelections({ ...agent, rateLimits: agent.rateLimits ?? createEmptyRateLimits() }),
          state.agents.length
        )
      ]
    })),

  updateAgent: (id, updates) =>
    set((state) => ({
      agents: state.agents.map((agent, index) =>
        agent.id === id
          ? ensureAgentProfileState(normalizeAgentSelections({
              ...agent,
              ...updates,
              rateLimits: updates.rateLimits ?? agent.rateLimits
            }), index)
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

  saveSettings: () => {
    const state = get()
    writePersistedSettings({
      version: 1,
      discussionStyle: state.discussionStyle,
      executionMode: state.executionMode,
      handRaiseMode: getEffectiveHandRaiseMode(state.discussionStyle, state.executionMode, state.handRaiseMode),
      turnLimit: state.turnLimit,
      agents: sanitizeAgents(state.agents)
    })
  },

  clearSavedSettings: () => {
    currentTurnAbortController?.abort()
    currentTurnAbortController = null
    removePersistedSettings()

    const defaultStyle: DiscussionStyle = 'conversation'
    const defaults = getDiscussionStyleDefaults(defaultStyle)

    set((state) => ({
      agents: defaults.agents,
      topic: '',
      inputPaths: [],
      turnLimit: defaults.turnLimit,
      currentTurn: 0,
      handRaiseMode: defaults.handRaiseMode,
      executionMode: 'orchestration',
      discussionStyle: defaultStyle,
      messages: [],
      sessionStatus: 'idle',
      finalConclusion: null,
      finalConclusionStructured: null,
      sessionError: null,
      backendSessionId: null,
      sessionRunNonce: state.sessionRunNonce + 1,
      orchestrationDebug: null
    }))
  },

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
        copilot: normalizeCatalog(incoming.copilot ?? fallbackCatalogs.copilot, fallbackCatalogs.copilot),
        claude: normalizeCatalog(incoming.claude ?? fallbackCatalogs.claude, fallbackCatalogs.claude)
      }

      set({
        providerCatalogs: cloneCatalogs(mergedCatalogs),
        providerCatalogStatus: 'ready',
        providerCatalogError: null
      })
      set((state) => ({
        agents: reconcileAgentsWithCatalogs(state.agents, mergedCatalogs)
      }))
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
      sessionRunNonce: state.sessionRunNonce + 1,
      currentTurn: 1,
      messages: [],
      finalConclusion: null,
      finalConclusionStructured: null,
      sessionError: null,
      backendSessionId: null,
      orchestrationDebug: null,
      agents: sanitizeAgents(state.agents)
    })),

  stopSession: () => {
    currentTurnAbortController?.abort()
    currentTurnAbortController = null

    const state = get()
    const sessionId = state.backendSessionId

    set((current) => ({
      sessionStatus: 'finished',
      sessionRunNonce: current.sessionRunNonce + 1
    }))

    if (sessionId) {
      void apiRequestJson<{ success?: boolean; stopped?: boolean }>('/api/orchestrator/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      }).catch((error) => {
        console.error('Failed to stop backend session:', error)
      })
    }
  },

  clearSessionError: () => set({ sessionError: null }),

  resetSession: () =>
    set((state) => {
      currentTurnAbortController?.abort()
      currentTurnAbortController = null

      return {
        topic: '',
        inputPaths: [],
        sessionStatus: 'idle',
        messages: [],
        currentTurn: 0,
        finalConclusion: null,
        finalConclusionStructured: null,
        sessionError: null,
        backendSessionId: null,
        sessionRunNonce: state.sessionRunNonce + 1,
        orchestrationDebug: null,
        agents: sanitizeAgents(state.agents)
      }
    }),

  processNextTurn: async () => {
    const state = get()
    if (state.sessionStatus !== 'running') {
      return
    }

    const runNonce = state.sessionRunNonce
    const controller = new AbortController()
    currentTurnAbortController = controller

    try {
      await ensureCopilotBackendReady(state.agents)

      const data = await apiRequestJson<{
        success?: boolean
        sessionId: string | null
        agents: AgentProfile[]
        messages: Message[]
        currentTurn: number
        sessionStatus: TurtleBrainState['sessionStatus']
        finalConclusion: string | null
        finalConclusionStructured: StructuredFinalConclusion | null
        debug: OrchestrationDebug | null
        details?: string
        error?: string
      }>('/api/orchestrator/run-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          sessionId: state.backendSessionId,
          topic: state.topic,
          inputPaths: state.inputPaths,
          executionMode: state.executionMode,
          discussionStyle: state.discussionStyle,
          handRaiseMode: getEffectiveHandRaiseMode(state.discussionStyle, state.executionMode, state.handRaiseMode),
          turnLimit: state.turnLimit,
          agents: state.agents
        })
      })

      if (!data.success) {
        throw new Error(data.details || data.error || 'オーケストレーションの実行に失敗しました。')
      }

      const latestState = get()
      if (latestState.sessionRunNonce !== runNonce || latestState.sessionStatus !== 'running') {
        return
      }

      set({
        backendSessionId: data.sessionId,
        agents: data.agents.map((agent, index) => ensureAgentProfileState(normalizeAgentSelections(agent), index)),
        messages: data.messages,
        currentTurn: data.currentTurn,
        sessionStatus: data.sessionStatus,
        finalConclusion: data.finalConclusion,
        finalConclusionStructured: data.finalConclusionStructured,
        orchestrationDebug: data.debug,
        sessionError: null
      })
    } catch (error) {
      if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        return
      }

      console.error('Agent interaction failed:', error)
      set({
        sessionStatus: 'finished',
        sessionError: getAgentInteractionErrorMessage(error)
      })
    } finally {
      if (currentTurnAbortController === controller) {
        currentTurnAbortController = null
      }
    }
  }
}))
