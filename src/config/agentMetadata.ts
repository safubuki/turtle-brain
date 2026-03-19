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
  '新規性重視',
  '批判的検証',
  '中立・バランス',
  '進行管理',
  '品質・リスク管理',
  'ユーザー価値重視',
  'コスト最適化',
  '長期運用重視'
]

export const PERSONALITY_PRESETS = [
  '丁寧・堅実',
  '率直・論理的',
  '高速・実務的',
  '慎重・分析的',
  '大胆・発想型',
  'フレンドリー'
]

export const REASONING_OPTIONS: Array<{
  value: ReasoningEffort
  label: string
  description: string
}> = [
  { value: 'low', label: 'Low', description: '高速に応答する軽めの推論' },
  { value: 'medium', label: 'Medium', description: '標準的な推論強度' },
  { value: 'high', label: 'High', description: '複雑な議論向けに深く考える' },
  { value: 'xhigh', label: 'XHigh', description: '最も重い推論を行う' }
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
        .split(/\s*\/\s*|\s*／\s*|[,\n、]+/)
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
