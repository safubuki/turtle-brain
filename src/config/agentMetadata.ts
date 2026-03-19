import type { AgentCliProvider, AgentRole, ReasoningEffort } from '../store/useStore'

export const PROVIDER_LABELS: Record<AgentCliProvider, string> = {
  codex: 'Codex CLI',
  gemini: 'Gemini CLI',
  copilot: 'GitHub Copilot CLI'
}

export const ROLE_LABELS: Record<AgentRole, string> = {
  Participant: '参加者',
  Facilitator: 'ファシリテータ'
}

export const STANCE_PRESETS = [
  '技術推進',
  '品質・リスク管理',
  'ユーザー価値重視',
  'コスト最適化',
  '実装速度重視',
  '運用安定性重視',
  'セキュリティ重視',
  'データ・分析重視',
  'ビジネス成果重視',
  '現場実装目線',
  '中立・バランス',
  '長期保守重視',
  '拡張性重視',
  '標準化・整備',
  '革新・実験志向',
  'シンプル化重視',
  '顧客体験重視',
  'チーム生産性重視',
  '法令・監査対応',
  'プロダクト戦略重視'
] as const

export const PERSONALITY_PRESETS = [
  '論理的',
  '感情的',
  '協調的',
  '前向き',
  '慎重',
  '大胆',
  '冷静',
  '熱血',
  '分析的',
  '直感的',
  '寡黙',
  '饒舌',
  '皮肉屋',
  '情熱的',
  '丁寧',
  '厳格',
  '柔軟',
  '主体的',
  '実務的',
  '批判的'
] as const

export const REASONING_OPTIONS: Array<{
  value: ReasoningEffort
  label: string
  description: string
}> = [
  { value: 'low', label: 'Low', description: '軽めに推論して素早く返答' },
  { value: 'medium', label: 'Medium', description: '標準的な推論強度' },
  { value: 'high', label: 'High', description: '深めに考えて回答品質を重視' },
  { value: 'xhigh', label: 'XHigh', description: '最も強い推論で複雑な課題向け' }
]

export function formatAgentRole(role: AgentRole): string {
  return ROLE_LABELS[role]
}

export function formatReasoningEffort(effort: ReasoningEffort): string {
  return REASONING_OPTIONS.find((option) => option.value === effort)?.label ?? effort
}

export function parseSelectableValue(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/\s*\/\s*|\s*・\s*|[,+、\n]+/u)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  )
}

export function serializeSelectableValue(values: string[]): string {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).join(' / ')
}

export function toggleSelectableValue(currentValue: string, target: string): string {
  const selections = parseSelectableValue(currentValue)

  if (selections.includes(target)) {
    return serializeSelectableValue(selections.filter((value) => value !== target))
  }

  return serializeSelectableValue([...selections, target])
}
