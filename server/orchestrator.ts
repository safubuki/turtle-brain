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
export type ExecutionMode = 'orchestration' | 'autonomous'
export type HandRaiseMode = 'rule-based' | 'ai-evaluation'
export type AgentAvatarPreset = 'user_icon1' | 'user_icon2' | 'user_icon3' | 'user_icon4'
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
type ConvergenceStatus = 'exploring' | 'debating' | 'needs_verification' | 'ready_to_conclude' | 'blocked'
type DesiredAction = 'respond' | 'question' | 'critique' | 'verify' | 'synthesize' | 'conclude' | 'wait'
type AutonomousActionType = 'speak' | 'wait' | 'ask' | 'critique' | 'conclude'

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

interface AutonomousAction {
  agentId: string
  action: AutonomousActionType
  reason: string
  message: string
  confidence: number
}

export interface AgentProfileInput {
  id: string
  name: string
  role: AgentRole
  stance: string
  personality: string
  viewpointRoleId: AgentViewpointRoleId | null
  viewpointFocus: string
  viewpointAvoid: string
  avatarPreset: AgentAvatarPreset | null
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

export interface RunTurnRequest {
  sessionId?: string
  topic: string
  inputPaths?: string[]
  executionMode?: ExecutionMode
  discussionStyle: DiscussionStyle
  handRaiseMode?: HandRaiseMode
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
  finalConclusionStructured: StructuredFinalConclusion | null
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
  unresolvedIssues: string[]
  evidenceGaps: string[]
  readyToConclude: boolean
  recommendedNextFocus: string | null
  participantScores: Array<{
    agentId: string
    score: number
    confidence: number
    desiredAction: DesiredAction
    reason: string
  }>
}

interface ScoreDecision {
  agentId: string
  runtimeSessionId: string | null
  score: number
  confidence: number
  desiredAction: DesiredAction
  reason: string
}

interface MeetingSession {
  id: string
  topic: string
  inputPaths: string[]
  inputContextPrompt: string
  inputContextWarnings: string[]
  executionMode: ExecutionMode
  discussionStyle: DiscussionStyle
  handRaiseMode: HandRaiseMode
  turnLimit: number
  currentTurn: number
  status: 'idle' | 'running' | 'finished'
  agents: RuntimeAgent[]
  messages: MessageRecord[]
  finalConclusion: string | null
  finalConclusionStructured: StructuredFinalConclusion | null
  deliberationState: DeliberationState | null
  convergenceDecision: ConvergenceDecision | null
  debug: OrchestratorDebugSnapshot | null
  log: OrchestratorDebugSnapshot['log']
  stopRequested: boolean
}

type CliRunner = (options: CliRunOptions) => Promise<CliExecResult>

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function asStringArray(value: unknown, maxItems = 8): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems)
}

function normalizeDesiredAction(value: unknown, fallback: DesiredAction = 'question'): DesiredAction {
  if (
    value === 'respond' ||
    value === 'question' ||
    value === 'critique' ||
    value === 'verify' ||
    value === 'synthesize' ||
    value === 'conclude' ||
    value === 'wait'
  ) {
    return value
  }

  if (value === 'agree' || value === 'implement') {
    return 'respond'
  }

  if (value === 'challenge') {
    return 'critique'
  }

  return fallback
}

function normalizePriority(value: unknown): 'high' | 'medium' | 'low' {
  return value === 'high' || value === 'low' ? value : 'medium'
}

function createInitialDeliberationState(topic: string): DeliberationState {
  return {
    agenda: [topic],
    claims: [],
    openIssues: [],
    disagreements: [],
    evidenceGaps: [],
    consensus: {
      level: 0,
      summary: '議論はまだ開始直後です。'
    },
    convergence: {
      status: 'exploring',
      reason: '議論材料を集めている段階です。',
      confidence: 0,
      recommendedNextFocus: topic
    }
  }
}

function normalizeDeliberationState(value: unknown, fallback: DeliberationState): DeliberationState | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const rawConsensus = record.consensus && typeof record.consensus === 'object'
    ? record.consensus as Record<string, unknown>
    : {}
  const rawConvergence = record.convergence && typeof record.convergence === 'object'
    ? record.convergence as Record<string, unknown>
    : {}
  const status = rawConvergence.status
  const convergenceStatus: ConvergenceStatus =
    status === 'debating' ||
    status === 'needs_verification' ||
    status === 'ready_to_conclude' ||
    status === 'blocked'
      ? status
      : 'exploring'

  const rawClaims = Array.isArray(record.claims) ? record.claims : []
  const claims = rawClaims
    .filter((claim): claim is Record<string, unknown> => Boolean(claim && typeof claim === 'object'))
    .map((claim, index): DeliberationState['claims'][number] => {
      const support = claim.supportLevel
      const supportLevel: DeliberationState['claims'][number]['supportLevel'] =
        support === 'strong' || support === 'medium' ? support : 'weak'
      return {
        id: asString(claim.id, `claim-${index + 1}`),
        text: asString(claim.text, ''),
        supportLevel,
        challengedBy: asStringArray(claim.challengedBy, 6)
      }
    })
    .filter((claim) => claim.text.length > 0)
    .slice(0, 10)

  return {
    agenda: asStringArray(record.agenda, 8),
    claims,
    openIssues: asStringArray(record.openIssues, 8),
    disagreements: asStringArray(record.disagreements, 8),
    evidenceGaps: asStringArray(record.evidenceGaps, 8),
    consensus: {
      level: clamp(typeof rawConsensus.level === 'number' ? rawConsensus.level : fallback.consensus.level, 0, 100),
      summary: asString(rawConsensus.summary, fallback.consensus.summary)
    },
    convergence: {
      status: convergenceStatus,
      reason: asString(rawConvergence.reason, fallback.convergence.reason),
      confidence: clamp(
        typeof rawConvergence.confidence === 'number' ? rawConvergence.confidence : fallback.convergence.confidence,
        0,
        100
      ),
      recommendedNextFocus:
        typeof rawConvergence.recommendedNextFocus === 'string' && rawConvergence.recommendedNextFocus.trim().length > 0
          ? rawConvergence.recommendedNextFocus.trim()
          : null
    }
  }
}

function normalizeStructuredFinalConclusion(value: unknown): StructuredFinalConclusion | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const rawConfidence = record.confidence && typeof record.confidence === 'object'
    ? record.confidence as Record<string, unknown>
    : {}
  const rawNextActions = Array.isArray(record.nextActions) ? record.nextActions : []
  const nextActions = rawNextActions
    .filter((action): action is Record<string, unknown> => Boolean(action && typeof action === 'object'))
    .map((action) => ({
      label: asString(action.label, '次のアクション'),
      detail: asString(action.detail, ''),
      priority: normalizePriority(action.priority)
    }))
    .filter((action) => action.detail.length > 0 || action.label.length > 0)
    .slice(0, 8)

  const finalAnswer = asString(record.finalAnswer, '')
  const conclusionSummary = asString(record.conclusionSummary, finalAnswer)
  if (!finalAnswer && !conclusionSummary) {
    return null
  }

  return {
    schemaVersion: 1,
    title: asString(record.title, '最終整理'),
    conclusionSummary,
    finalAnswer: finalAnswer || conclusionSummary,
    reasoning: asStringArray(record.reasoning, 10),
    supportingPoints: asStringArray(record.supportingPoints, 10),
    counterArguments: asStringArray(record.counterArguments, 10),
    unresolvedIssues: asStringArray(record.unresolvedIssues, 10),
    risks: asStringArray(record.risks, 10),
    confidence: {
      score: clamp(typeof rawConfidence.score === 'number' ? rawConfidence.score : 50, 0, 100),
      reason: asString(rawConfidence.reason, '信頼度理由は明示されていません。')
    },
    nextActions
  }
}

function formatStructuredConclusionAsText(conclusion: StructuredFinalConclusion): string {
  const sections = [
    `1. 結論サマリー\n${conclusion.conclusionSummary}`,
    `2. 詳細な解説\n${conclusion.finalAnswer}`,
    `3. 根拠\n${conclusion.reasoning.concat(conclusion.supportingPoints).join('\n') || '根拠は明示されていません。'}`,
    `4. 反対意見・未解決事項・リスク\n${[
      ...conclusion.counterArguments.map((item) => `反対意見: ${item}`),
      ...conclusion.unresolvedIssues.map((item) => `未解決: ${item}`),
      ...conclusion.risks.map((item) => `リスク: ${item}`)
    ].join('\n') || '大きな反対意見・未解決事項・リスクは明示されていません。'}`,
    `5. 次のアクション\n${conclusion.nextActions
      .map((action) => `${action.priority}: ${action.label} - ${action.detail}`)
      .join('\n') || '次のアクションは明示されていません。'}`
  ]

  return sections.join('\n\n')
}

function formatDeliberationStateForPrompt(state: DeliberationState | null): string {
  if (!state) {
    return 'No deliberation state yet.'
  }

  return [
    `Agenda: ${state.agenda.join(' / ') || 'none'}`,
    `Open issues: ${state.openIssues.join(' / ') || 'none'}`,
    `Disagreements: ${state.disagreements.join(' / ') || 'none'}`,
    `Evidence gaps: ${state.evidenceGaps.join(' / ') || 'none'}`,
    `Consensus: ${state.consensus.level}/100 - ${state.consensus.summary}`,
    `Convergence: ${state.convergence.status} (${state.convergence.confidence}/100) - ${state.convergence.reason}`,
    state.convergence.recommendedNextFocus ? `Recommended next focus: ${state.convergence.recommendedNextFocus}` : ''
  ].filter(Boolean).join('\n')
}

const VIEWPOINT_ROLE_LABELS: Record<AgentViewpointRoleId, string> = {
  'executive-business': '経営・事業責任',
  operations: '現場・業務運用',
  'project-management': 'プロジェクト・プロダクト推進',
  'customer-user': '顧客・利用者',
  'sales-market': '営業・市場',
  'technical-practice': '開発担当者',
  'quality-qms': '品質・QMS',
  'research-development': '研究開発',
  'finance-accounting': '財務・経理',
  'people-organization': '人事・組織',
  'legal-compliance-ip': '法務・コンプライアンス・知財',
  'security-risk': 'セキュリティ・リスク管理'
}

function normalizeViewpointRoleId(value: unknown): AgentViewpointRoleId | null {
  return typeof value === 'string' && value in VIEWPOINT_ROLE_LABELS
    ? value as AgentViewpointRoleId
    : null
}

function getAgentViewpointLabel(agent: Pick<AgentProfileInput, 'viewpointRoleId'>): string {
  return agent.viewpointRoleId ? VIEWPOINT_ROLE_LABELS[agent.viewpointRoleId] ?? agent.viewpointRoleId : '標準'
}

function formatAgentPerspectiveForPrompt(
  agent: Pick<AgentProfileInput, 'viewpointRoleId' | 'viewpointFocus' | 'viewpointAvoid'>
): string {
  const lines = [
    `Viewpoint role: ${getAgentViewpointLabel(agent)}`,
    agent.viewpointFocus ? `Primary viewpoint focus: ${agent.viewpointFocus}` : '',
    agent.viewpointAvoid ? `Avoid leaning too heavily on: ${agent.viewpointAvoid}` : ''
  ].filter(Boolean)

  return lines.join('\n')
}

function formatAgentProfilesForPrompt(agents: RuntimeAgent[]): string {
  return agents
    .map((agent) => [
      `${agent.name}: role=${agent.role}, viewpoint=${getAgentViewpointLabel(agent)}, stance=${agent.stance}, personality=${agent.personality}`,
      agent.viewpointFocus ? `  focus=${agent.viewpointFocus}` : '',
      agent.viewpointAvoid ? `  avoid=${agent.viewpointAvoid}` : ''
    ].filter(Boolean).join('\n'))
    .join('\n')
}

function countKeywordOverlap(source: string, targets: string[]): number {
  const normalizedSource = source.toLowerCase()
  const words = targets
    .flatMap((target) => target.toLowerCase().split(/[^\p{L}\p{N}]+/u))
    .map((word) => word.trim())
    .filter((word) => word.length >= 3)

  return Array.from(new Set(words)).filter((word) => normalizedSource.includes(word)).length
}

function extractJsonLineRecords(value: string): Record<string, unknown>[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line)
        return parsed && typeof parsed === 'object' ? [parsed as Record<string, unknown>] : []
      } catch {
        return []
      }
    })
}

function getNestedString(record: unknown, pathSegments: string[]): string | null {
  let current: unknown = record

  for (const segment of pathSegments) {
    if (!current || typeof current !== 'object') {
      return null
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return typeof current === 'string' && current.trim().length > 0 ? current : null
}

function extractAssistantContentFromEventLog(value: string): string | null {
  const records = extractJsonLineRecords(value)
  if (records.length === 0) {
    return null
  }

  const assistantMessageEvent = [...records]
    .reverse()
    .find((record) => getNestedString(record, ['type']) === 'assistant.message')

  const assistantMessageContent = getNestedString(assistantMessageEvent, ['data', 'content'])
  if (assistantMessageContent) {
    return assistantMessageContent.trim()
  }

  const lastDeltaEvent = [...records]
    .reverse()
    .find((record) => getNestedString(record, ['type']) === 'assistant.message_delta')
  const lastMessageId = getNestedString(lastDeltaEvent, ['data', 'messageId'])
  if (!lastMessageId) {
    return null
  }

  const deltaContent = records
    .filter(
      (record) =>
        getNestedString(record, ['type']) === 'assistant.message_delta' &&
        getNestedString(record, ['data', 'messageId']) === lastMessageId
    )
    .map((record) => getNestedString(record, ['data', 'deltaContent']) ?? '')
    .join('')
    .trim()

  return deltaContent || null
}

function sanitizeMessageContent(value: string): string {
  return (extractAssistantContentFromEventLog(value) ?? value).trim()
}

function summarizeResponse(response: string): string {
  const normalized = sanitizeMessageContent(response).replace(/\s+/g, ' ').trim()
  if (normalized.length <= 80) {
    return normalized
  }

  return `${normalized.slice(0, 80).trim()}...`
}

function buildPromptExcerpt(value: string, maxChars: number): string {
  const normalized = sanitizeMessageContent(value).replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxChars) {
    return normalized
  }

  return `${normalized.slice(0, maxChars).trim()}...`
}

function getRecentDialogue(session: MeetingSession, limit = 6, excerptChars = 180): string {
  const recentMessages = session.messages.slice(-limit)
  if (recentMessages.length === 0) {
    return 'まだ会話は始まっていません。'
  }

  return recentMessages
    .map((message) => {
      const agent = session.agents.find((entry) => entry.id === message.agentId)
      return `- ${agent?.name ?? message.agentId}: ${buildPromptExcerpt(message.content, excerptChars)}`
    })
    .join('\n')
}

function getLastOtherMessage(session: MeetingSession, speaker: RuntimeAgent, excerptChars = 180): string | null {
  const target = [...session.messages].reverse().find((message) => message.agentId !== speaker.id)
  if (!target) {
    return null
  }

  const agent = session.agents.find((entry) => entry.id === target.agentId)
  return `${agent?.name ?? target.agentId}: ${buildPromptExcerpt(target.content, excerptChars)}`
}

function getInboxPrompt(session: MeetingSession, speaker: RuntimeAgent, limit = 3, excerptChars = 150): string {
  return speaker.inbox
    .slice(-limit)
    .map((item) => {
      const fromAgent = session.agents.find((entry) => entry.id === item.fromAgentId)
      const label = fromAgent?.name ?? item.fromAgentId
      const content = item.kind === 'facilitator-note' ? item.summary : buildPromptExcerpt(item.content, excerptChars)
      return `- ${label}: ${content}`
    })
    .join('\n')
}

function getSelfHistoryPrompt(session: MeetingSession, speaker: RuntimeAgent, limit = 2, excerptChars = 180): string {
  return getSafeSelfHistoryPrompt(session, speaker, limit, excerptChars)
  const ownMessages = session.messages.filter((message) => message.agentId === speaker.id).slice(-limit)
  if (ownMessages.length === 0) {
    return ''
  }

  return ownMessages
    .map((message, index) => {
      const globalOrder = session.messages.findIndex((entry) => entry.id === message.id) + 1
      return `- 直近${index + 1}: 全体${globalOrder}件目 / ${buildPromptExcerpt(message.content, excerptChars)}`
    })
    .join('\n')
}

function getDesiredActionGuidance(desiredAction?: string): string {
  switch (desiredAction) {
    case 'critique':
      return '相手の前提や見落としを1つだけ丁寧に指摘してください。'
    case 'question':
      return '次に進めるための具体的な質問を1つ入れてください。'
    case 'verify':
      return '根拠不足を補う観点で、確認すべき事実や検証方法を1つ示してください。'
    case 'synthesize':
      return '複数の意見をつなぎ、今の論点を整理してください。'
    case 'conclude':
      return '結論に近づけるため、合意点と残る条件を簡潔に示してください。'
    case 'wait':
      return '今回は発言量を抑え、必要最小限の補足だけにしてください。'
    case 'respond':
      return '今すぐ試せる具体案や手順を1つ提案してください。'
    default:
      return '直前の発言を受けて、会話が前に進む具体的な返答にしてください。'
  }
}

function cloneAgent(agent: AgentProfileInput): RuntimeAgent {
  const viewpointRoleId = normalizeViewpointRoleId(agent.viewpointRoleId)
  return {
    ...agent,
    viewpointRoleId,
    viewpointFocus: agent.viewpointFocus ?? '',
    viewpointAvoid: agent.viewpointAvoid ?? '',
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
      return `${agent?.name ?? message.agentId}: ${summarizeResponse(message.content)}`
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
  const sanitizedSessionId =
    result.sessionId && result.sessionId.trim().length > 0 && result.sessionId.trim().length <= 160 && !/[\r\n]/.test(result.sessionId)
      ? result.sessionId.trim()
      : null

  agent.runtimeSessionId = sanitizedSessionId ?? agent.runtimeSessionId
  if (result.rateLimits) {
    agent.rateLimits = result.rateLimits
  }
}

function getSafeRecentDialogue(session: MeetingSession, limit = 6, excerptChars = 180): string {
  const recentMessages = session.messages.slice(-limit)
  if (recentMessages.length === 0) {
    return 'No recent messages yet.'
  }

  return recentMessages
    .map((message) => {
      const agent = session.agents.find((entry) => entry.id === message.agentId)
      return `- ${agent?.name ?? message.agentId}: ${buildPromptExcerpt(message.content, excerptChars)}`
    })
    .join('\n')
}

function getSafeSharedPromptContext(session: MeetingSession): string {
  const parts = [`Topic: ${session.topic}`]

  if (session.inputContextPrompt) {
    parts.push(session.inputContextPrompt)
  }

  if (session.inputContextWarnings.length > 0) {
    parts.push(`Input context warnings:\n${session.inputContextWarnings.join('\n')}`)
  }

  return parts.join('\n\n')
}

function getSafeReasoningGuidance(reasoningEffort: ReasoningEffort): string {
  switch (reasoningEffort) {
    case 'low':
      return 'Reasoning effort is low. Prefer speed and simplicity.'
    case 'high':
      return 'Reasoning effort is high. Think carefully and be precise.'
    case 'xhigh':
      return 'Reasoning effort is xhigh. Use the strongest deliberation before answering.'
    default:
      return 'Reasoning effort is medium. Balance speed and quality.'
  }
}

function getSafeSelfHistoryPrompt(
  session: MeetingSession,
  speaker: RuntimeAgent,
  limit = 2,
  excerptChars = 180
): string {
  const ownMessages = session.messages.filter((message) => message.agentId === speaker.id).slice(-limit)
  if (ownMessages.length === 0) {
    return ''
  }

  return ownMessages
    .map((message, index) => {
      const globalOrder = session.messages.findIndex((entry) => entry.id === message.id) + 1
      return `- Your recent message ${index + 1}: global #${globalOrder} / ${buildPromptExcerpt(message.content, excerptChars)}`
    })
    .join('\n')
}

function getLatestAgentMessage(session: MeetingSession, agentId: string): MessageRecord | null {
  return [...session.messages].reverse().find((message) => message.agentId === agentId) ?? null
}

function getVisibleParticipantState(session: MeetingSession, agent: RuntimeAgent, excerptChars = 120): string {
  const latestMessage = getLatestAgentMessage(session, agent.id)
  const latestSummary = latestMessage
    ? buildPromptExcerpt(latestMessage.content, excerptChars)
    : 'No visible statement yet.'

  return `${agent.name}: viewpoint=${getAgentViewpointLabel(agent)}, speakCount=${agent.speakCount}, handRaise=${agent.handRaiseIntensity}, latest="${latestSummary}"`
}

function getMessagesSinceLastFacilitator(session: MeetingSession, facilitatorId: string): number {
  let count = 0

  for (let index = session.messages.length - 1; index >= 0; index -= 1) {
    if (session.messages[index].agentId === facilitatorId) {
      return count
    }

    count += 1
  }

  return Number.POSITIVE_INFINITY
}

function getMessagesSinceAgentSpoke(session: MeetingSession, agentId: string): number {
  let count = 0

  for (let index = session.messages.length - 1; index >= 0; index -= 1) {
    if (session.messages[index].agentId === agentId) {
      return count
    }

    count += 1
  }

  return Number.POSITIVE_INFINITY
}

function countSubstringOccurrences(text: string, needle: string): number {
  if (!needle.trim()) {
    return 0
  }

  let count = 0
  let searchIndex = 0

  while (searchIndex < text.length) {
    const foundAt = text.indexOf(needle, searchIndex)
    if (foundAt === -1) {
      break
    }

    count += 1
    searchIndex = foundAt + needle.length
  }

  return count
}

function getParticipantRecencyPenalty(session: MeetingSession, agentId: string): number {
  const recentParticipantIds = [...session.messages]
    .reverse()
    .filter((message) => {
      const speaker = session.agents.find((agent) => agent.id === message.agentId)
      return speaker?.role === 'Participant'
    })
    .slice(0, 2)
    .map((message) => message.agentId)

  if (recentParticipantIds[0] === agentId) {
    return 28
  }

  if (recentParticipantIds.includes(agentId)) {
    return 14
  }

  return 0
}

function getSpeakCountSpread(participants: RuntimeAgent[]): number {
  if (participants.length === 0) {
    return 0
  }

  const counts = participants.map((agent) => agent.speakCount)
  return Math.max(...counts) - Math.min(...counts)
}

function getQuietParticipantIds(participants: RuntimeAgent[]): string[] {
  if (participants.length === 0) {
    return []
  }

  const minSpeakCount = Math.min(...participants.map((agent) => agent.speakCount))
  return participants.filter((agent) => agent.speakCount === minSpeakCount).map((agent) => agent.id)
}

function getSynthesisCapabilityScore(agent: RuntimeAgent): number {
  const providerBonus: Record<AgentCliProvider, number> = {
    codex: 28,
    copilot: 24,
    gemini: 18,
    claude: 26
  }
  const model = agent.model.toLowerCase()
  let score = 50 + providerBonus[agent.provider]

  if (model.includes('opus')) score += 28
  else if (model.includes('gpt-5.4')) score += 26
  else if (model.includes('pro')) score += 22
  else if (model.includes('sonnet')) score += 18
  else if (model.includes('gpt-5.3')) score += 18
  else if (model.includes('gpt-5.2')) score += 14
  else if (model.includes('gpt-5.1')) score += 10

  if (model.includes('mini')) score -= 24
  if (model.includes('flash')) score -= 22
  if (model.includes('lite')) score -= 28

  return score
}

function getSafeDesiredActionGuidance(desiredAction?: string): string {
  switch (desiredAction) {
    case 'respond':
      return 'Respond to the latest point and add one concrete implication or next step.'
    case 'critique':
      return 'Raise one concrete concern or counterpoint.'
    case 'question':
      return 'Ask one concrete question that helps the discussion move forward.'
    case 'verify':
      return 'Identify one evidence gap and propose how to verify it.'
    case 'synthesize':
      return 'Synthesize multiple points into one short direction or takeaway.'
    case 'conclude':
      return 'Move toward a conclusion by stating the current agreement and remaining condition.'
    case 'wait':
      return 'Keep the contribution minimal unless you can unblock the discussion.'
    default:
      return 'Respond to the latest discussion with one useful, specific contribution.'
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

    session.executionMode = input.executionMode ?? session.executionMode
    session.handRaiseMode = input.handRaiseMode ?? session.handRaiseMode

    if (session.stopRequested || session.status === 'finished') {
      session.status = 'finished'
      return this.serializeSession(session)
    }

    session.status = 'running'

    const totalTurns = session.turnLimit * Math.max(session.agents.length, 1)
    if (session.currentTurn > totalTurns) {
      await this.finalizeSession(session)
      return this.serializeSession(session)
    }

    const fallbackFromAutonomousMeeting = session.executionMode === 'autonomous' && session.discussionStyle === 'meeting'
    if (session.executionMode === 'autonomous' && session.discussionStyle === 'conversation') {
      await this.runAutonomousConversationTurn(session)
    } else if (session.discussionStyle === 'conversation') {
      await this.runConversationTurn(session)
    } else {
      await this.runMeetingTurn(session)
    }

    if (fallbackFromAutonomousMeeting && session.debug) {
      session.debug.dispatchReason = `Autonomous × Meeting は未実装のため Orchestration × Meeting にフォールバックしました。${session.debug.dispatchReason}`
    }

    if (session.stopRequested) {
      session.status = 'finished'
      return this.serializeSession(session)
    }

    const deliberationWorker = await this.updateDeliberationState(session)
    const convergenceDecision = this.evaluateConvergence(session)
    session.convergenceDecision = convergenceDecision
    this.applyTurnAnalysisToDebug(session, deliberationWorker)

    if (convergenceDecision.readyToConclude && convergenceDecision.confidence >= 70 && session.messages.length >= 2) {
      await this.finalizeSession(session, `収束判定により最終整理を生成しました: ${convergenceDecision.reason}`)
      return this.serializeSession(session)
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
      executionMode: input.executionMode ?? 'orchestration',
      discussionStyle: input.discussionStyle,
      handRaiseMode: input.handRaiseMode ?? 'ai-evaluation',
      turnLimit: input.turnLimit,
      currentTurn: 1,
      status: 'idle',
      agents: input.agents.map(cloneAgent),
      messages: [],
      finalConclusion: null,
      finalConclusionStructured: null,
      deliberationState: createInitialDeliberationState(input.topic),
      convergenceDecision: null,
      debug: null,
      log: [],
      stopRequested: false
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
        viewpointRoleId: agent.viewpointRoleId,
        viewpointFocus: agent.viewpointFocus,
        viewpointAvoid: agent.viewpointAvoid,
        avatarPreset: agent.avatarPreset,
        avatarCustomDataUrl: agent.avatarCustomDataUrl,
        avatarCustomName: agent.avatarCustomName,
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
      finalConclusionStructured: session.finalConclusionStructured,
      debug: session.debug
    }
  }

  private async runConversationTurn(session: MeetingSession): Promise<void> {
    const speaker = getNextConversationSpeaker(session)
    const prompt = this.buildConversationPromptV2(session, speaker)
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
      executionMode: session.executionMode,
      selectedSpeakerId: speaker.id,
      dispatchReason: 'Conversation モードのため、直前の発話者と異なる参加者を選択しました。',
      facilitator: null,
      deliberationState: session.deliberationState,
      convergenceDecision: session.convergenceDecision,
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
      const prompt = this.buildMeetingPromptV2(session, facilitator, null, [])
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
        executionMode: session.executionMode,
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
          parallelDispatch: false,
          unresolvedIssues: session.deliberationState?.openIssues ?? [],
          evidenceGaps: session.deliberationState?.evidenceGaps ?? [],
          readyToConclude: false,
          recommendedNextFocus: session.deliberationState?.convergence.recommendedNextFocus ?? null
        },
        deliberationState: session.deliberationState,
        convergenceDecision: session.convergenceDecision,
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
    const useAiEvaluation = session.handRaiseMode === 'ai-evaluation'
    let facilitatorDecision: FacilitatorDecision | null = null
    let scores: ScoreDecision[] = []

    if (useAiEvaluation && facilitator) {
      const startedAt = Date.now()
      facilitatorDecision = await this.moderateMeetingV2(session, facilitator)
      const finishedAt = Date.now()
      workerRuns.push({
        workerId: `moderation:${facilitator.id}`,
        kind: 'moderation',
        targetAgentId: facilitator.id,
        startedAt,
        finishedAt,
        durationMs: finishedAt - startedAt
      })

      scores = participants.map((agent) => {
        const matched = facilitatorDecision?.participantScores.find((entry) => entry.agentId === agent.id)
        return {
          agentId: agent.id,
          runtimeSessionId: agent.runtimeSessionId,
          score: clamp(matched?.score ?? 40, 0, 100),
          confidence: clamp(matched?.confidence ?? 50, 0, 100),
          desiredAction: matched?.desiredAction ?? 'question',
          reason: matched?.reason ?? 'Fallback score because the facilitator did not return a participant score.'
        }
      })
    } else {
      scores = await Promise.all(
        participants.map(async (agent) => {
          const startedAt = Date.now()
          const score = useAiEvaluation
            ? await this.scoreParticipantV2(session, agent)
            : this.scoreParticipantRuleBased(session, agent)
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
      )
    }

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
        const prompt = this.buildMeetingPromptV2(session, speaker, facilitatorDecision, scores)
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
      executionMode: session.executionMode,
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
        parallelDispatch: facilitatorDecision.parallelDispatch,
        unresolvedIssues: facilitatorDecision.unresolvedIssues,
        evidenceGaps: facilitatorDecision.evidenceGaps,
        readyToConclude: facilitatorDecision.readyToConclude,
        recommendedNextFocus: facilitatorDecision.recommendedNextFocus
      } : null,
      deliberationState: session.deliberationState,
      convergenceDecision: session.convergenceDecision,
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

  private async runAutonomousConversationTurn(session: MeetingSession): Promise<void> {
    const participants = session.agents.filter((agent) => agent.role === 'Participant')
    if (participants.length === 0) {
      await this.runConversationTurn(session)
      if (session.debug) {
        session.debug.dispatchReason = `Autonomous Conversation の参加者が空だったため通常 Conversation にフォールバックしました。${session.debug.dispatchReason}`
      }
      return
    }

    const actionRuns = await Promise.all(
      participants.map(async (agent) => {
        const startedAt = Date.now()
        const result = await this.runCli({
          provider: agent.provider,
          model: agent.model,
          reasoningEffort: agent.reasoningEffort,
          prompt: this.buildAutonomousActionPrompt(session, agent),
          sessionId: agent.runtimeSessionId ?? undefined
        })
        const finishedAt = Date.now()
        applyResultToAgent(agent, result)
        return {
          agent,
          action: this.normalizeAutonomousAction(agent, result.response),
          startedAt,
          finishedAt
        }
      })
    )

    const validActions = actionRuns
      .map((run) => ({ ...run, rank: this.scoreAutonomousAction(session, run.agent, run.action) }))
      .filter((run) => run.rank > 0)
      .sort((left, right) => right.rank - left.rank)

    if (validActions.length === 0) {
      await this.runConversationTurn(session)
      if (session.debug) {
        session.debug.dispatchReason = `Autonomous actions が全て wait または無効だったため通常 Conversation にフォールバックしました。${session.debug.dispatchReason}`
        session.debug.workers = [
          ...actionRuns.map((run) => ({
            workerId: `autonomous:${run.agent.id}`,
            kind: 'autonomous' as const,
            targetAgentId: run.agent.id,
            startedAt: run.startedAt,
            finishedAt: run.finishedAt,
            durationMs: run.finishedAt - run.startedAt
          })),
          ...session.debug.workers
        ]
      }
      return
    }

    const selected = validActions[0]
    const speaker = selected.agent
    speaker.status = 'idle'
    speaker.speakCount += 1
    const message = this.recordMessage(session, speaker, selected.action.message, 'message')
    this.deliverMessage(session, speaker.id, message)

    session.agents.forEach((agent) => {
      const actionRun = actionRuns.find((run) => run.agent.id === agent.id)
      agent.handRaiseIntensity = actionRun ? clamp(actionRun.action.confidence, 0, 100) : 0
    })

    const concludeCount = actionRuns.filter((run) => run.action.action === 'conclude' && run.action.confidence >= 70).length
    const dispatchReason = [
      `Autonomous × Conversation: ${speaker.name} の ${selected.action.action} を採用しました。`,
      selected.action.reason,
      concludeCount >= 2 ? '複数エージェントが conclude を提案しています。' : ''
    ].filter(Boolean).join(' ')

    session.debug = {
      sessionId: session.id,
      turn: session.currentTurn,
      executionMode: session.executionMode,
      selectedSpeakerId: speaker.id,
      dispatchReason,
      facilitator: null,
      deliberationState: session.deliberationState,
      convergenceDecision: session.convergenceDecision,
      scores: actionRuns.map((run) => ({
        agentId: run.agent.id,
        runtimeSessionId: run.agent.runtimeSessionId,
        score: run.agent.id === speaker.id ? 100 : clamp(run.action.confidence, 0, 100),
        confidence: clamp(run.action.confidence, 0, 100),
        desiredAction: run.action.action === 'speak' || run.action.action === 'ask'
          ? (run.action.action === 'ask' ? 'question' : 'respond')
          : run.action.action === 'critique'
            ? 'critique'
            : run.action.action === 'conclude'
              ? 'conclude'
              : 'wait',
        reason: run.action.reason
      })),
      workers: actionRuns.map((run) => ({
        workerId: `autonomous:${run.agent.id}`,
        kind: 'autonomous',
        targetAgentId: run.agent.id,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        durationMs: run.finishedAt - run.startedAt
      })),
      agentSessions: session.agents.map((agent) => ({
        agentId: agent.id,
        runtimeSessionId: agent.runtimeSessionId,
        inboxCount: agent.inbox.length,
        outboxCount: agent.outbox.length
      })),
      log: session.log.slice(-8)
    }
  }

  private buildAutonomousActionPrompt(session: MeetingSession, agent: RuntimeAgent): string {
    const transcript = getSafeRecentDialogue(session, 8, 180)
    const lastOtherMessage = getLastOtherMessage(session, agent, 180)
    const selfHistory = getSelfHistoryPrompt(session, agent, 2, 180)

    return [
      getSafeSharedPromptContext(session),
      `You are ${agent.name}. Your stance is "${agent.stance}". Your personality is "${agent.personality}".`,
      formatAgentPerspectiveForPrompt(agent),
      getSafeReasoningGuidance(agent.reasoningEffort),
      `Deliberation state:\n${formatDeliberationStateForPrompt(session.deliberationState)}`,
      lastOtherMessage ? `Most recent message from another agent:\n${lastOtherMessage}` : '',
      selfHistory ? `Your own recent messages:\n${selfHistory}` : '',
      `Recent dialogue:\n${transcript}`,
      'Choose your next autonomous action. Use wait if another agent should speak.',
      'Use critique for a concrete counterpoint, ask for a concrete missing clarification, speak for a normal contribution, and conclude only when the discussion is ready.',
      'Return JSON only. No markdown.',
      '{"agentId":"agent-id","action":"speak|wait|ask|critique|conclude","reason":"short reason","message":"Japanese message, empty only when action is wait","confidence":0-100}'
    ].filter(Boolean).join('\n\n')
  }

  private normalizeAutonomousAction(agent: RuntimeAgent, response: string): AutonomousAction {
    const parsed = extractJson<Partial<AutonomousAction>>(sanitizeMessageContent(response))
    const action = parsed?.action === 'wait' ||
      parsed?.action === 'ask' ||
      parsed?.action === 'critique' ||
      parsed?.action === 'conclude'
      ? parsed.action
      : 'speak'
    const message = typeof parsed?.message === 'string' ? sanitizeMessageContent(parsed.message) : ''

    if (action !== 'wait' && message.length === 0) {
      return {
        agentId: agent.id,
        action: 'wait',
        reason: 'メッセージが空だったため wait として扱いました。',
        message: '',
        confidence: 0
      }
    }

    return {
      agentId: typeof parsed?.agentId === 'string' ? parsed.agentId : agent.id,
      action,
      reason: asString(parsed?.reason, '自律判断の理由は明示されていません。'),
      message,
      confidence: clamp(typeof parsed?.confidence === 'number' ? parsed.confidence : 50, 0, 100)
    }
  }

  private scoreAutonomousAction(session: MeetingSession, agent: RuntimeAgent, action: AutonomousAction): number {
    if (action.action === 'wait' || action.message.trim().length === 0) {
      return 0
    }

    const duplicatePenalty = this.isDuplicateMessage(session, action.message) ? 45 : 0
    const recencyPenalty = getParticipantRecencyPenalty(session, agent.id)
    const actionBoost = action.action === 'conclude'
      ? 24
      : action.action === 'critique'
        ? 18
        : action.action === 'ask'
          ? 14
          : 8
    const state = session.deliberationState
    const verificationBoost = state?.evidenceGaps.length && action.action === 'ask' ? 10 : 0
    const critiqueBoost = state?.disagreements.length && action.action === 'critique' ? 10 : 0

    return clamp(action.confidence + actionBoost + verificationBoost + critiqueBoost - recencyPenalty - duplicatePenalty, 0, 140)
  }

  private isDuplicateMessage(session: MeetingSession, message: string): boolean {
    const normalized = message.replace(/\s+/g, '').slice(0, 160)
    if (normalized.length < 20) {
      return false
    }

    return session.messages.slice(-5).some((entry) => {
      const previous = entry.content.replace(/\s+/g, '').slice(0, 160)
      return previous.includes(normalized.slice(0, 40)) || normalized.includes(previous.slice(0, 40))
    })
  }

  private isAgentRepeatingRecentPoint(session: MeetingSession, agent: RuntimeAgent): boolean {
    const latestOwn = [...session.messages].reverse().find((message) => message.agentId === agent.id)
    const latestOther = [...session.messages].reverse().find((message) => message.agentId !== agent.id)
    if (!latestOwn || !latestOther) {
      return false
    }

    return countKeywordOverlap(latestOwn.content, [latestOther.content]) >= 4
  }

  private async updateDeliberationState(session: MeetingSession): Promise<OrchestratorDebugSnapshot['workers'][number] | null> {
    if (session.messages.length === 0) {
      return null
    }

    const analyst =
      [...session.agents].sort((left, right) => getSynthesisCapabilityScore(right) - getSynthesisCapabilityScore(left))[0] ??
      session.agents[0]
    const previousState = session.deliberationState ?? createInitialDeliberationState(session.topic)
    const prompt = [
      getSafeSharedPromptContext(session),
      'Update the deliberation state for this multi-agent discussion.',
      'Preserve previous unresolved issues unless the latest dialogue clearly resolves them.',
      `Previous deliberation state:\n${JSON.stringify(previousState)}`,
      `Recent dialogue:\n${getSafeRecentDialogue(session, 10, 220)}`,
      'Return JSON only. No markdown.',
      '{"agenda":["topic"],"claims":[{"id":"claim-1","text":"claim","supportLevel":"weak|medium|strong","challengedBy":["agent name"]}],"openIssues":["issue"],"disagreements":["disagreement"],"evidenceGaps":["gap"],"consensus":{"level":0-100,"summary":"summary"},"convergence":{"status":"exploring|debating|needs_verification|ready_to_conclude|blocked","reason":"reason","confidence":0-100,"recommendedNextFocus":"focus or null"}}'
    ].join('\n\n')
    const startedAt = Date.now()
    let finishedAt = startedAt
    try {
      const result = await this.runMetaCli(analyst.provider, analyst.model, analyst.reasoningEffort, prompt)
      finishedAt = Date.now()
      const parsed = normalizeDeliberationState(extractJson<unknown>(sanitizeMessageContent(result.response)), previousState)
      if (parsed) {
        session.deliberationState = parsed
      }
    } catch {
      finishedAt = Date.now()
    }

    return {
      workerId: `deliberation:${analyst.id}:${session.currentTurn}`,
      kind: 'deliberation',
      targetAgentId: analyst.id,
      startedAt,
      finishedAt,
      durationMs: finishedAt - startedAt
    }
  }

  private evaluateConvergence(session: MeetingSession): ConvergenceDecision {
    const state = session.deliberationState
    if (!state) {
      return {
        readyToConclude: false,
        confidence: 0,
        reason: '議論状態がまだ作成されていません。',
        remainingIssues: [],
        nextFocus: null
      }
    }

    const remainingIssues = [...state.openIssues, ...state.evidenceGaps]
    const readyByState = state.convergence.status === 'ready_to_conclude'
    const confidence = clamp(state.convergence.confidence, 0, 100)
    const readyToConclude = readyByState && confidence >= 70 && remainingIssues.length <= 2

    return {
      readyToConclude,
      confidence,
      reason: readyToConclude
        ? state.convergence.reason
        : state.convergence.reason || '未解決論点または根拠不足が残っています。',
      remainingIssues,
      nextFocus: state.convergence.recommendedNextFocus
    }
  }

  private applyTurnAnalysisToDebug(
    session: MeetingSession,
    deliberationWorker: OrchestratorDebugSnapshot['workers'][number] | null
  ): void {
    if (!session.debug) {
      return
    }

    session.debug.deliberationState = session.deliberationState
    session.debug.convergenceDecision = session.convergenceDecision
    if (deliberationWorker) {
      session.debug.workers = [...session.debug.workers, deliberationWorker]
    }
  }

  private async finalizeSession(session: MeetingSession, reason = 'ターン上限に到達したため最終整理を生成しました。'): Promise<void> {
    if (session.finalConclusion) {
      session.status = 'finished'
      return
    }

    const synthesizer =
      [...session.agents].sort((left, right) => getSynthesisCapabilityScore(right) - getSynthesisCapabilityScore(left))[0] ??
      session.agents[0]
    const startedAt = Date.now()
    const result = await this.runCli({
      provider: synthesizer.provider,
      model: synthesizer.model,
      reasoningEffort: synthesizer.reasoningEffort,
      prompt: this.buildFinalConclusionPromptV2(session),
      sessionId: synthesizer.runtimeSessionId ?? undefined
    })
    const finishedAt = Date.now()

    applyResultToAgent(synthesizer, result)
    const sanitizedConclusion = sanitizeMessageContent(result.response)
    const structuredConclusion = normalizeStructuredFinalConclusion(extractJson<unknown>(sanitizedConclusion))
    session.finalConclusionStructured = structuredConclusion
    session.finalConclusion = structuredConclusion
      ? formatStructuredConclusionAsText(structuredConclusion)
      : sanitizedConclusion
    session.status = 'finished'
    session.log.push({
      turn: session.currentTurn,
      kind: 'synthesis',
      summary: summarizeResponse(session.finalConclusion),
      timestamp: Date.now()
    })

    session.debug = {
      sessionId: session.id,
      turn: session.currentTurn,
      executionMode: session.executionMode,
      selectedSpeakerId: null,
      dispatchReason: reason,
      facilitator: synthesizer ? {
        agentId: synthesizer.id,
        runtimeSessionId: synthesizer.runtimeSessionId,
        overview: '議論全体の要約',
        rationale: '終了条件に到達したため総括を作成',
        nextFocus: '最終整理の提示',
        selectedAgentId: null,
        selectedAgentIds: [],
        inviteAgentIds: [],
        interventionPriority: 100,
        shouldIntervene: true,
        parallelDispatch: false,
        unresolvedIssues: session.deliberationState?.openIssues ?? [],
        evidenceGaps: session.deliberationState?.evidenceGaps ?? [],
        readyToConclude: session.convergenceDecision?.readyToConclude ?? true,
        recommendedNextFocus: session.convergenceDecision?.nextFocus ?? null
      } : null,
      deliberationState: session.deliberationState,
      convergenceDecision: session.convergenceDecision,
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
    const transcript = getRecentDialogue(session, 6, 180)
    const lastOtherMessage = getLastOtherMessage(session, speaker, 180)
    const inboxText = getInboxPrompt(session, speaker, 3, 140)

    const parts = [
      getSharedPromptContext(session),
      `あなたは ${speaker.name} です。立場: ${speaker.stance}。性格: ${speaker.personality}。`,
      buildReasoningGuidance(speaker.reasoningEffort)
    ]

    if (lastOtherMessage) {
      parts.push(`直前に相手が述べた内容:\n${lastOtherMessage}`)
    }

    if (session.messages.length > 0) {
      parts.push(`直近の会話ログ:\n${transcript}`)
    }

    if (inboxText) {
      parts.push(`受信メモ:\n${inboxText}`)
    }

    parts.push('会話として自然につながる短い返答を日本語で返してください。')
    parts.push('必ず直前の誰かの発言に反応し、賛成・懸念・補足・質問のどれかを含めてください。')
    parts.push('一般論だけを独立して述べるのは禁止です。相手の名前や「その点」「今の話」など、会話の受けを明示してください。')
    parts.push('2〜4文で十分です。')
    return parts.join('\n\n')
  }

  private buildConversationPromptV2(session: MeetingSession, speaker: RuntimeAgent): string {
    const transcript = getSafeRecentDialogue(session, 6, 180)
    const lastOtherMessage = getLastOtherMessage(session, speaker, 180)
    const inboxText = getInboxPrompt(session, speaker, 3, 140)
    const selfHistory = getSelfHistoryPrompt(session, speaker, 2, 180)
    const counterpartName =
      session.agents.find((entry) => entry.id !== speaker.id && entry.role === 'Participant')?.name ?? '相手'

    const parts = [
      getSafeSharedPromptContext(session),
      `You are ${speaker.name}. Your stance is "${speaker.stance}". Your personality is "${speaker.personality}".`,
      formatAgentPerspectiveForPrompt(speaker),
      getSafeReasoningGuidance(speaker.reasoningEffort)
    ]

    if (selfHistory) {
      parts.push(`Your own recent messages:\n${selfHistory}`)
    }

    if (lastOtherMessage) {
      parts.push(`Most recent message from another agent:\n${lastOtherMessage}`)
    }

    if (session.messages.length > 0) {
      parts.push(`Recent dialogue:\n${transcript}`)
    }

    parts.push(`Deliberation state:\n${formatDeliberationStateForPrompt(session.deliberationState)}`)

    if (inboxText) {
      parts.push(`Messages directly addressed to you:\n${inboxText}`)
    }

    parts.push('Reply in Japanese with one short but concrete conversational turn.')
    parts.push('React to the latest point first, then add one useful agreement, concern, question, or refinement.')
    parts.push('Use only your explicitly configured viewpoint role and the visible dialogue. Do not assume hidden departments, stance labels, or personality labels of the other agent.')
    parts.push('Do not invent extra occupational labels such as planner, designer, engineer, or owner unless those labels were explicitly configured or stated in the dialogue itself.')
    parts.push(`If you refer to another agent, mention the exact agent name such as "${counterpartName}".`)
    parts.push('Use 2 to 4 sentences. Do not output JSON, bullet lists, or stage directions.')
    return parts.join('\n\n')
  }

  stopSession(sessionId?: string): boolean {
    if (!sessionId || !this.sessions.has(sessionId)) {
      return false
    }

    const session = this.sessions.get(sessionId)!
    session.stopRequested = true
    session.status = 'finished'
    return true
  }

  private async runMetaCli(
    provider: AgentCliProvider,
    model: string,
    reasoningEffort: ReasoningEffort,
    prompt: string
  ): Promise<CliExecResult> {
    return this.runCli({
      provider,
      model,
      reasoningEffort,
      prompt
    })
  }

  private async scoreParticipantV2(session: MeetingSession, agent: RuntimeAgent): Promise<ScoreDecision> {
    const transcript = getRecentTranscript(session, 8)
    const inboxText = agent.inbox.slice(-5).map((item) => item.summary).join(' / ')
    const prompt = [
      getSafeSharedPromptContext(session),
      `You are evaluating whether ${agent.name} should speak next.`,
      `Stance: ${agent.stance}`,
      `Personality: ${agent.personality}`,
      formatAgentPerspectiveForPrompt(agent),
      getSafeReasoningGuidance(agent.reasoningEffort),
      `Recent transcript: ${transcript || 'No recent discussion yet.'}`,
      `Deliberation state:\n${formatDeliberationStateForPrompt(session.deliberationState)}`,
      inboxText ? `Direct inbox: ${inboxText}` : '',
      'Return JSON only.',
      '{"score":0-100,"confidence":0-100,"desiredAction":"respond|question|critique|verify|synthesize|conclude|wait","reason":"short reason"}'
    ].filter(Boolean).join('\n\n')

    const result = await this.runMetaCli(agent.provider, agent.model, agent.reasoningEffort, prompt)

    const parsed = extractJson<{ score?: number; confidence?: number; desiredAction?: string; reason?: string }>(result.response)
    return {
      agentId: agent.id,
      runtimeSessionId: agent.runtimeSessionId,
      score: clamp(parsed?.score ?? 40, 0, 100),
      confidence: clamp(parsed?.confidence ?? 50, 0, 100),
      desiredAction: normalizeDesiredAction(parsed?.desiredAction, 'question'),
      reason: parsed?.reason ?? 'Fallback score because the evaluation response was not structured.'
    }
  }

  private scoreParticipantRuleBased(session: MeetingSession, agent: RuntimeAgent): ScoreDecision {
    const participants = session.agents.filter((entry) => entry.role === 'Participant')
    const quietParticipantIds = new Set(getQuietParticipantIds(participants))
    const latestMessage = session.messages[session.messages.length - 1] ?? null
    const messagesSinceOwnTurn = getMessagesSinceAgentSpoke(session, agent.id)
    const mentionCount =
      latestMessage && latestMessage.agentId !== agent.id ? countSubstringOccurrences(latestMessage.content, agent.name) : 0
    const mentionBonus = Math.min(mentionCount, 2) * 16
    const inboxBonus = Math.min(agent.inbox.length, 3) * 12
    const quietBoost = quietParticipantIds.has(agent.id) ? 14 : 0
    const firstTurnBoost = agent.speakCount === 0 ? 12 : 0
    const staleBoost = Number.isFinite(messagesSinceOwnTurn) ? Math.min(messagesSinceOwnTurn, 4) * 4 : 18
    const recencyPenalty = getParticipantRecencyPenalty(session, agent.id)
    const score = clamp(34 + mentionBonus + inboxBonus + quietBoost + firstTurnBoost + staleBoost - recencyPenalty, 0, 100)

    const desiredAction =
      mentionBonus > 0 || inboxBonus > 0
        ? 'question'
      : quietBoost > 0
          ? 'respond'
          : messagesSinceOwnTurn >= 3
            ? 'synthesize'
            : 'respond'

    const reasons: string[] = []
    if (mentionBonus > 0) {
      reasons.push('最新発言で名指しされた')
    }
    if (inboxBonus > 0) {
      reasons.push('未処理の受信メッセージがある')
    }
    if (quietBoost > 0) {
      reasons.push('発言回数が少なめ')
    }
    if (staleBoost >= 12) {
      reasons.push('しばらく発言していない')
    }
    if (reasons.length === 0) {
      reasons.push('直近の発言順を避けつつ均等化を優先')
    }

    return {
      agentId: agent.id,
      runtimeSessionId: agent.runtimeSessionId,
      score,
      confidence: 72,
      desiredAction,
      reason: reasons.join(' / ')
    }
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
      '{"score":0-100,"confidence":0-100,"desiredAction":"respond|question|critique|verify|synthesize|conclude|wait","reason":"短い理由"}'
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
      desiredAction: normalizeDesiredAction(parsed?.desiredAction, 'question'),
      reason: parsed?.reason ?? '発言必要度の理由が不足していたため既定値を使用'
    }
  }

  private async moderateMeetingV2(session: MeetingSession, facilitator: RuntimeAgent): Promise<FacilitatorDecision> {
    const transcript = getSafeRecentDialogue(session, 8, 180)
    const participants = session.agents.filter((agent) => agent.role === 'Participant')
    const participantState = participants
      .map((agent) => getVisibleParticipantState(session, agent))
      .join(' | ')
    const messagesSinceLastFacilitator = getMessagesSinceLastFacilitator(session, facilitator.id)
    const quietParticipantNames = getQuietParticipantIds(participants)
      .map((agentId) => participants.find((agent) => agent.id === agentId)?.name)
      .filter((name): name is string => Boolean(name))
    const speakCountSpread = getSpeakCountSpread(participants)

    const prompt = [
      getSafeSharedPromptContext(session),
      `You are the facilitator ${facilitator.name}.`,
      getSafeReasoningGuidance(facilitator.reasoningEffort),
      `Messages since your last facilitation turn: ${messagesSinceLastFacilitator === Number.POSITIVE_INFINITY ? 'many / not applicable' : messagesSinceLastFacilitator}`,
      `Speaking spread among participants: ${speakCountSpread}`,
      quietParticipantNames.length > 0 ? `Quieter participants right now: ${quietParticipantNames.join(', ')}` : '',
      `Participant state: ${participantState}`,
      `Deliberation state:\n${formatDeliberationStateForPrompt(session.deliberationState)}`,
      `Recent dialogue:\n${transcript}`,
      'Prefer selecting participants to speak. Your own facilitation turn should be rare and should mainly be used for the opening, for unblocking a stalled discussion, or for synthesizing after several participant turns.',
      'Avoid consecutive facilitator turns whenever possible.',
      'When some participants have spoken much less than others, help rebalance the discussion by inviting the quieter participants by name.',
      'Prioritize unresolved issues, evidence gaps, and concrete disagreement over simple turn fairness.',
      'After several participant messages, it is good to briefly summarize direction and then hand off to one or two participants.',
      'Do not infer hidden roles, departments, stance labels, or personality labels of participants. Refer only to agent names and what they have actually said.',
      'Decide who should speak next and whether multiple participants should respond in parallel.',
      'Also score every participant for hand-raise intensity.',
      'Return JSON only.',
      '{"overview":"current state","rationale":"why","nextFocus":"next focus","selectedAgentId":"agent-id or null","selectedAgentIds":["agent-id"],"inviteAgentIds":["agent-id"],"interventionPriority":0-100,"shouldIntervene":true|false,"parallelDispatch":true|false,"unresolvedIssues":["issue"],"evidenceGaps":["gap"],"readyToConclude":true|false,"recommendedNextFocus":"focus or null","participantScores":[{"agentId":"agent-id","score":0-100,"confidence":0-100,"desiredAction":"respond|question|critique|verify|synthesize|conclude|wait","reason":"short reason"}]}'
    ].join('\n\n')

    const result = await this.runMetaCli(facilitator.provider, facilitator.model, facilitator.reasoningEffort, prompt)

    const parsed = extractJson<Partial<FacilitatorDecision>>(result.response)
    const selectedAgentIds = Array.isArray(parsed?.selectedAgentIds) ? parsed.selectedAgentIds.filter(Boolean) : []
    const inviteAgentIds = Array.isArray(parsed?.inviteAgentIds) ? parsed.inviteAgentIds.filter(Boolean) : []
    const participantScores = Array.isArray(parsed?.participantScores)
      ? parsed.participantScores
          .filter((entry): entry is FacilitatorDecision['participantScores'][number] => Boolean(entry && typeof entry === 'object'))
          .map((entry) => ({
            agentId: typeof entry.agentId === 'string' ? entry.agentId : '',
            score: clamp(typeof entry.score === 'number' ? entry.score : 40, 0, 100),
            confidence: clamp(typeof entry.confidence === 'number' ? entry.confidence : 50, 0, 100),
            desiredAction: normalizeDesiredAction(entry.desiredAction, 'question'),
            reason: typeof entry.reason === 'string' ? entry.reason : 'Fallback score because the facilitator did not return a reason.'
          }))
          .filter((entry) => entry.agentId.length > 0)
      : []

    return {
      overview: parsed?.overview ?? 'Current state was not clearly returned.',
      rationale: parsed?.rationale ?? 'No explicit rationale was returned.',
      nextFocus: parsed?.nextFocus ?? 'Ask the next agent to move the discussion forward.',
      selectedAgentId: parsed?.selectedAgentId ?? null,
      selectedAgentIds,
      inviteAgentIds,
      interventionPriority: clamp(parsed?.interventionPriority ?? 40, 0, 100),
      shouldIntervene: Boolean(parsed?.shouldIntervene),
      parallelDispatch: Boolean(parsed?.parallelDispatch) || selectedAgentIds.length > 1,
      unresolvedIssues: asStringArray(parsed?.unresolvedIssues, 8),
      evidenceGaps: asStringArray(parsed?.evidenceGaps, 8),
      readyToConclude: Boolean(parsed?.readyToConclude),
      recommendedNextFocus:
        typeof parsed?.recommendedNextFocus === 'string' && parsed.recommendedNextFocus.trim().length > 0
          ? parsed.recommendedNextFocus.trim()
          : null,
      participantScores
    }
  }

  private async moderateMeeting(session: MeetingSession, facilitator: RuntimeAgent): Promise<FacilitatorDecision> {
    const transcript = getRecentDialogue(session, 8, 180)
    const participantState = session.agents
      .filter((agent) => agent.role === 'Participant')
      .map((agent) => `${agent.name}: 発言${agent.speakCount}回, stance=${agent.stance}, personality=${agent.personality}`)
      .join(' | ')

    const prompt = [
      getSharedPromptContext(session),
      `あなたは会議のファシリテータ ${facilitator.name} です。`,
      buildReasoningGuidance(facilitator.reasoningEffort),
      `参加者の状態: ${participantState}`,
      `直近の議論:\n${transcript}`,
      '会話が続くように、補完関係や対立関係がある参加者を優先して選んでください。',
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
      parallelDispatch: Boolean(parsed?.parallelDispatch) || selectedAgentIds.length > 1,
      unresolvedIssues: [],
      evidenceGaps: [],
      readyToConclude: false,
      recommendedNextFocus: null,
      participantScores: []
    }
  }

  private selectSpeakers(
    session: MeetingSession,
    scores: ScoreDecision[],
    facilitatorDecision: FacilitatorDecision | null,
    facilitator: RuntimeAgent | null
  ): { speakers: RuntimeAgent[]; dispatchReason: string } {
    const participants = session.agents.filter((agent) => agent.role === 'Participant')
    const maxSpeakCount = Math.max(...participants.map((agent) => agent.speakCount), 0)
    const speakCountSpread = getSpeakCountSpread(participants)
    const deliberationIssues = [
      ...(session.deliberationState?.openIssues ?? []),
      ...(session.deliberationState?.evidenceGaps ?? []),
      ...(facilitatorDecision?.unresolvedIssues ?? []),
      ...(facilitatorDecision?.evidenceGaps ?? [])
    ]
    const ranked = participants
      .map((agent) => {
        const score = scores.find((entry) => entry.agentId === agent.id)
        const facilitatorBoost =
          facilitatorDecision?.selectedAgentIds.includes(agent.id) || facilitatorDecision?.selectedAgentId === agent.id ? 12 : 0
        const equityBoost = Math.max(0, maxSpeakCount - agent.speakCount) * 8
        const highHandRaiseBoost = (score?.score ?? 0) >= 80 ? 6 : 0
        const profileText = `${agent.name} ${agent.stance} ${agent.personality} ${score?.reason ?? ''}`
        const issueRelevanceBoost = Math.min(countKeywordOverlap(profileText, deliberationIssues) * 5, 18)
        const evidenceBoost =
          (score?.desiredAction === 'verify' || /データ|根拠|検証|品質|リスク|慎重/i.test(profileText)) &&
          (session.deliberationState?.evidenceGaps.length || facilitatorDecision?.evidenceGaps.length)
            ? 12
            : 0
        const critiqueBoost =
          (score?.desiredAction === 'critique' || /批判|反証|懸念|リスク|慎重/i.test(profileText)) &&
          (session.deliberationState?.disagreements.length || facilitatorDecision?.unresolvedIssues.length)
            ? 10
            : 0
        const synthesizeBoost =
          score?.desiredAction === 'synthesize' && session.deliberationState?.consensus.level && session.deliberationState.consensus.level >= 50
            ? 8
            : 0
        const repetitionPenalty =
          score?.desiredAction === 'respond' && this.isAgentRepeatingRecentPoint(session, agent)
            ? 12
            : 0
        const recencyPenalty = getParticipantRecencyPenalty(session, agent.id)
        return {
          agent,
          baseScore: score?.score ?? 0,
          adjustedScore:
            (score?.score ?? 0) +
            facilitatorBoost +
            equityBoost +
            highHandRaiseBoost +
            issueRelevanceBoost +
            evidenceBoost +
            critiqueBoost +
            synthesizeBoost -
            recencyPenalty -
            repetitionPenalty,
          reason: score?.reason ?? '理由なし'
        }
      })
      .sort((left, right) => right.adjustedScore - left.adjustedScore)

    const topParticipantScore = ranked[0]?.adjustedScore ?? 0
    const messagesSinceLastFacilitator =
      facilitator ? getMessagesSinceLastFacilitator(session, facilitator.id) : Number.POSITIVE_INFINITY
    const facilitatorShouldRebalance = speakCountSpread >= 2
    const facilitatorShouldSummarize = messagesSinceLastFacilitator >= 3 && session.messages.length >= Math.max(participants.length, 2)

    if (
      facilitator &&
      facilitatorDecision?.shouldIntervene &&
      messagesSinceLastFacilitator >= 2 &&
      (
        facilitatorDecision.interventionPriority >= topParticipantScore + 12 ||
        (facilitatorShouldRebalance && facilitatorDecision.interventionPriority >= topParticipantScore - 4) ||
        (facilitatorShouldSummarize && facilitatorDecision.interventionPriority >= topParticipantScore)
      )
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

  private buildMeetingPromptV2(
    session: MeetingSession,
    speaker: RuntimeAgent,
    facilitatorDecision: FacilitatorDecision | null,
    scores: ScoreDecision[]
  ): string {
    const transcript = getSafeRecentDialogue(session, 8, 180)
    const lastOtherMessage = getLastOtherMessage(session, speaker, 180)
    const inboxText = getInboxPrompt(session, speaker, 4, 140)
    const selfHistory = getSelfHistoryPrompt(session, speaker, 2, 180)

    if (speaker.role === 'Facilitator') {
      return [
        getSafeSharedPromptContext(session),
        `You are the facilitator ${speaker.name}.`,
        getSafeReasoningGuidance(speaker.reasoningEffort),
        `Current overview: ${facilitatorDecision?.overview ?? 'No prior overview.'}`,
        `Next focus: ${facilitatorDecision?.nextFocus ?? 'Move the discussion to the next useful point.'}`,
        `Deliberation state:\n${formatDeliberationStateForPrompt(session.deliberationState)}`,
        selfHistory ? `Your own recent messages:\n${selfHistory}` : '',
        `Recent dialogue:\n${transcript}`,
        'Reply in Japanese with one short facilitation turn.',
        'Base your facilitation only on the actual visible dialogue and explicitly configured viewpoint roles. Do not assume hidden departments, stance labels, or personality labels of participants.',
        'Do not invent extra occupational labels such as planner, designer, engineer, or owner unless those labels were explicitly configured or stated in the dialogue itself.',
        'Summarize the current state, point to one or two concrete next angles, and explicitly invite the relevant participant names when useful.',
        'Prefer broad prompts or targeted follow-up based on what they actually said. Avoid speaking again immediately after your own previous facilitation turn unless the discussion is stalled.',
        'Use 2 to 4 sentences. Do not output JSON or bullet lists.'
      ].filter(Boolean).join('\n\n')
    }

    const scoreInfo = scores.find((entry) => entry.agentId === speaker.id)
    return [
      getSafeSharedPromptContext(session),
      `You are ${speaker.name}. Your stance is "${speaker.stance}". Your personality is "${speaker.personality}".`,
      formatAgentPerspectiveForPrompt(speaker),
      getSafeReasoningGuidance(speaker.reasoningEffort),
      selfHistory ? `Your own recent messages:\n${selfHistory}` : '',
      lastOtherMessage ? `Most recent message from another agent:\n${lastOtherMessage}` : '',
      `Recent dialogue:\n${transcript}`,
      `Deliberation state:\n${formatDeliberationStateForPrompt(session.deliberationState)}`,
      facilitatorDecision ? `Facilitator overview: ${facilitatorDecision.overview}\nNext focus: ${facilitatorDecision.nextFocus}` : '',
      inboxText ? `Messages directly addressed to you:\n${inboxText}` : '',
      scoreInfo
        ? `Desired action: ${scoreInfo.desiredAction}\nScoring reason: ${scoreInfo.reason}\nGuidance: ${getSafeDesiredActionGuidance(scoreInfo.desiredAction)}`
        : '',
      'Reply in Japanese with one short conversational turn for the meeting.',
      'React to a specific prior point, mention the target agent name explicitly when responding to someone, and add one concrete refinement, concern, question, or synthesis.',
      'Use only your explicitly configured viewpoint role and the visible dialogue. Do not assume hidden departments, stance labels, or personality labels of the other agents.',
      'Do not invent extra occupational labels such as planner, designer, engineer, or owner unless those labels were explicitly configured or stated in the dialogue itself.',
      'Use 2 to 4 sentences. Do not output JSON or bullet lists.'
    ].filter(Boolean).join('\n\n')
  }

  private buildFinalConclusionPromptV2(session: MeetingSession): string {
    const transcript = getRecentTranscript(session, 20)
    return [
      getSafeSharedPromptContext(session),
      'Create the final organized conclusion in Japanese. Do not produce a chronological transcript.',
      `Agent viewpoints:\n${formatAgentProfilesForPrompt(session.agents)}`,
      `Deliberation state:\n${formatDeliberationStateForPrompt(session.deliberationState)}`,
      session.convergenceDecision
        ? `Convergence decision:\n${JSON.stringify(session.convergenceDecision)}`
        : '',
      'Return JSON only. Do not wrap it in markdown.',
      'Use this exact schema:',
      '{"schemaVersion":1,"title":"短いタイトル","conclusionSummary":"結論の要約","finalAnswer":"最終回答","reasoning":["理由"],"supportingPoints":["根拠・支持点"],"counterArguments":["反対意見・反証"],"unresolvedIssues":["未解決事項"],"risks":["リスク"],"confidence":{"score":0-100,"reason":"信頼度理由"},"nextActions":[{"label":"アクション名","detail":"詳細","priority":"high|medium|low"}]}',
      'If there are no counter arguments, unresolved issues, risks, or next actions, return an empty array for that field.',
      'Reflect the useful differences between configured viewpoints. Summarize what to do next, why, what to watch, and which perspective raised each major concern when it matters.',
      'Merge repeated or half-finished remarks into coherent decisions, reasons, unresolved issues, risks, and next actions. Do not merely enumerate intermediate conversation results.',
      `Discussion log: ${transcript}`
    ].filter(Boolean).join('\n\n')
  }

  private buildMeetingPrompt(
    session: MeetingSession,
    speaker: RuntimeAgent,
    facilitatorDecision: FacilitatorDecision | null,
    scores: ScoreDecision[]
  ): string {
    const transcript = getRecentDialogue(session, 8, 180)
    const lastOtherMessage = getLastOtherMessage(session, speaker, 180)
    const inboxText = getInboxPrompt(session, speaker, 4, 140)

    if (speaker.role === 'Facilitator') {
      return [
        getSharedPromptContext(session),
        `あなたはファシリテータ ${speaker.name} です。`,
        buildReasoningGuidance(speaker.reasoningEffort),
        `現在の整理: ${facilitatorDecision?.overview ?? '未整理'}`,
        `次の焦点: ${facilitatorDecision?.nextFocus ?? '論点を再整理してください'}`,
        `直近の議論:\n${transcript}`,
        '直前の流れを受けた短い進行発話を日本語で返してください。',
        '誰のどの発言を受けた進行なのかが伝わるようにしてください。1〜3文で十分です。'
      ].join('\n\n')
    }

    const scoreInfo = scores.find((entry) => entry.agentId === speaker.id)
    return [
      getSharedPromptContext(session),
      `あなたは ${speaker.name} です。立場: ${speaker.stance}。性格: ${speaker.personality}。`,
      buildReasoningGuidance(speaker.reasoningEffort),
      lastOtherMessage ? `直前の他者発言:\n${lastOtherMessage}` : '',
      `直近の議論:\n${transcript}`,
      facilitatorDecision ? `ファシリテータ整理: ${facilitatorDecision.overview}\n次の焦点: ${facilitatorDecision.nextFocus}` : '',
      inboxText ? `受信メモ:\n${inboxText}` : '',
      scoreInfo
        ? `期待される行動: ${scoreInfo.desiredAction} / 理由: ${scoreInfo.reason}\n補足指示: ${getDesiredActionGuidance(scoreInfo.desiredAction)}`
        : '',
      '会議の流れに自然につながる一発言を日本語で返してください。'
        + ' 必ず直前の発言かファシリテータの整理に反応してください。独白は禁止です。'
        + ' 相手の名前や「その懸念」「今の提案」などの受けを入れてください。2〜4文で十分です。'
    ].filter(Boolean).join('\n\n')
  }

  private recordMessage(
    session: MeetingSession,
    speaker: RuntimeAgent,
    content: string,
    kind: 'message' | 'moderation'
  ): MessageRecord {
    const sanitizedContent = sanitizeMessageContent(content)
    const message: MessageRecord = {
      id: `msg-${Date.now()}-${randomUUID().slice(0, 6)}`,
      agentId: speaker.id,
      content: sanitizedContent,
      summary: summarizeResponse(sanitizedContent),
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
