import type { AgentCliProvider, AgentRole, AgentViewpointRoleId, ReasoningEffort } from '../store/useStore'

export const PROVIDER_LABELS: Record<AgentCliProvider, string> = {
  codex: 'Codex CLI',
  gemini: 'Gemini CLI',
  copilot: 'GitHub Copilot CLI',
  claude: 'Claude Code'
}

export interface ViewpointRolePreset {
  id: AgentViewpointRoleId
  label: string
  category: string
  description: string
  looksAt: string[]
  typicalQuestions: string[]
  defaultStance: string
  defaultPersonality: string
  defaultFocus: string
  defaultAvoid: string
}

export const VIEWPOINT_ROLE_PRESETS: ViewpointRolePreset[] = [
  {
    id: 'executive-business',
    label: '経営・事業責任',
    category: '意思決定',
    description: '事業目的、収益性、投資判断、長期方針から議論を整理します。',
    looksAt: ['事業価値', '投資対効果', '優先順位', '長期リスク'],
    typicalQuestions: ['この判断は事業目的に合うか', '限られた資源をここに使うべきか'],
    defaultStance: '長期視点・コスト重視・合意形成重視',
    defaultPersonality: '俯瞰的・論理的',
    defaultFocus: '事業目的、収益性、投資判断、優先順位、長期方針',
    defaultAvoid: '短期の好みだけでの意思決定、現場・顧客・財務への影響の見落とし'
  },
  {
    id: 'customer-user',
    label: '顧客・利用者',
    category: '価値',
    description: '顧客価値、使いやすさ、受け入れやすさ、利用者の困りごとを見ます。',
    looksAt: ['顧客価値', '使いやすさ', '受容性', '困りごと'],
    typicalQuestions: ['利用者は何に価値を感じるか', '現場で使い続けられるか'],
    defaultStance: 'ユーザー目線・受容的',
    defaultPersonality: '前向き・共感的',
    defaultFocus: '利用者の価値、困りごと、理解しやすさ、導入時の抵抗感',
    defaultAvoid: '利用者の行動実態を見ない判断、使いにくさや負担の見落とし'
  },
  {
    id: 'sales-market',
    label: '営業・市場',
    category: '価値',
    description: '売れるか、説明できるか、競合と比べて強いかを確認します。',
    looksAt: ['市場性', '提案価値', '競合差別化', '説明容易性'],
    typicalQuestions: ['顧客にどう説明するか', '競合より何が強いか'],
    defaultStance: '価値訴求重視・顧客目線',
    defaultPersonality: '率直・前向き',
    defaultFocus: '提案価値、市場性、競合差別化、説明しやすさ',
    defaultAvoid: '機能説明だけでの提案、顧客の購買理由が弱いままの判断'
  },
  {
    id: 'operations',
    label: '現場・業務運用',
    category: '現場',
    description: '現場で本当に回るか、手順・負荷・継続運用の観点で確認します。',
    looksAt: ['現場負荷', '業務手順', '継続運用', '例外対応'],
    typicalQuestions: ['誰がどの手順で運用するか', '繁忙時や例外時にも回るか'],
    defaultStance: '実践派・運用重視',
    defaultPersonality: '堅実・率直',
    defaultFocus: '現場負荷、業務手順、継続運用、例外対応',
    defaultAvoid: '理想的な手順だけでの判断、繁忙時・例外時・担当者負荷の見落とし'
  },
  {
    id: 'project-management',
    label: 'プロジェクト・プロダクト推進',
    category: '推進',
    description: '目的、優先順位、体制、依存関係から、PM/PO視点で前に進めます。',
    looksAt: ['目的', '優先順位', '依存関係', '意思決定'],
    typicalQuestions: ['何を優先して進めるか', '誰がいつ意思決定するか'],
    defaultStance: '優先順位重視・合意形成重視',
    defaultPersonality: '前向き・調整的',
    defaultFocus: '目的、優先順位、スケジュール、担当、依存関係、意思決定',
    defaultAvoid: '目的や優先順位が曖昧なままの進行、担当・期限・依存関係の曖昧さ'
  },
  {
    id: 'research-development',
    label: '研究開発',
    category: '現場・技術',
    description: '新規性、実験仮説、技術探索、将来価値から可能性を見ます。',
    looksAt: ['新規性', '実験可能性', '技術探索', '将来価値'],
    typicalQuestions: ['どんな新しい価値や仮説があるか', '何を検証すれば前に進むか'],
    defaultStance: '探索重視・長期視点',
    defaultPersonality: '創造的・論理的',
    defaultFocus: '新規性、実験仮説、技術探索、将来価値',
    defaultAvoid: '既存手段への早すぎる収束、検証仮説や学習価値の曖昧さ'
  },
  {
    id: 'technical-practice',
    label: '開発担当者',
    category: '現場・技術',
    description: '要件を実装に落とし、リリース・運用・保守できる形にします。',
    looksAt: ['実装計画', '設計', '保守性', 'リリース影響'],
    typicalQuestions: ['どう実装して届けるか', '運用や保守で無理が出ないか'],
    defaultStance: '実装重視・現実解重視',
    defaultPersonality: '論理的・実践的',
    defaultFocus: '仕様理解、設計、実装難易度、保守性、リリース影響',
    defaultAvoid: '仕様や前提が曖昧なままの実装、保守・移行・リリース負荷の見落とし'
  },
  {
    id: 'quality-qms',
    label: '品質・QMS',
    category: '品質・統制',
    description: '品質基準、検証方法、標準化、監査性、不具合予防を確認します。',
    looksAt: ['品質保証', '標準化', '監査性', '不具合予防'],
    typicalQuestions: ['品質基準を満たすか', '再現性と記録は十分か'],
    defaultStance: '品質重視・標準化重視',
    defaultPersonality: '慎重・体系的',
    defaultFocus: '品質基準、検証方法、標準化、監査性、不具合予防',
    defaultAvoid: '属人的な確認だけでの判断、品質基準・記録・再発防止の曖昧さ'
  },
  {
    id: 'finance-accounting',
    label: '財務・経理',
    category: 'スタッフ',
    description: 'コスト、予算、採算、費用対効果、会計上の扱いを見ます。',
    looksAt: ['予算', '採算', '費用対効果', '会計影響'],
    typicalQuestions: ['予算化できるか', '回収期間や継続費用は妥当か'],
    defaultStance: 'コスト重視・データ重視',
    defaultPersonality: '慎重・分析的',
    defaultFocus: '初期費用、継続費用、予算、採算、費用対効果',
    defaultAvoid: '期待値だけでの効果判断、費用・期間・回収根拠の曖昧さ'
  },
  {
    id: 'people-organization',
    label: '人事・組織',
    category: 'スタッフ',
    description: '人員、評価、教育、採用、組織影響、心理的安全性を確認します。',
    looksAt: ['人員', '教育', '評価', '組織影響'],
    typicalQuestions: ['必要な人材と育成は足りるか', '組織や働き方に無理がないか'],
    defaultStance: '受容的・長期視点',
    defaultPersonality: '共感的・俯瞰的',
    defaultFocus: '人員配置、教育、採用、評価、心理的安全性',
    defaultAvoid: '制度や体制だけでの判断、人員負荷・育成・納得感の軽視'
  },
  {
    id: 'legal-compliance-ip',
    label: '法務・コンプライアンス・知財',
    category: 'スタッフ・統制',
    description: '契約、規制、責任範囲、権利、知財リスクを確認します。',
    looksAt: ['契約', '規制', '責任範囲', '知財'],
    typicalQuestions: ['契約・規制に抵触しないか', '権利や責任の所在は明確か'],
    defaultStance: 'リスク分析・保守性重視',
    defaultPersonality: '慎重・論理的',
    defaultFocus: '契約、規制、責任範囲、知財、説明可能性',
    defaultAvoid: '契約・規制・権利関係が曖昧なままの進行'
  },
  {
    id: 'security-risk',
    label: 'セキュリティ・リスク管理',
    category: 'スタッフ・統制',
    description: '情報管理、事故、監査、BCP、悪用可能性を確認します。',
    looksAt: ['情報管理', '監査', '事故対応', 'BCP'],
    typicalQuestions: ['事故や悪用の可能性は何か', '監査や復旧の準備は十分か'],
    defaultStance: 'セキュリティ重視・リスク分析',
    defaultPersonality: '慎重・分析的',
    defaultFocus: '情報管理、権限、監査、事故対応、BCP、悪用可能性',
    defaultAvoid: '根拠のない安全性の楽観視、対策や残余リスクの曖昧さ'
  }
]

export const VIEWPOINT_ROLE_MAP: Record<AgentViewpointRoleId, ViewpointRolePreset> =
  Object.fromEntries(VIEWPOINT_ROLE_PRESETS.map((preset) => [preset.id, preset])) as Record<
    AgentViewpointRoleId,
    ViewpointRolePreset
  >

export function getViewpointRolePreset(id: AgentViewpointRoleId | null | undefined): ViewpointRolePreset | null {
  return id ? VIEWPOINT_ROLE_MAP[id] ?? null : null
}

export function getViewpointRoleLabel(id: AgentViewpointRoleId | null | undefined): string {
  return getViewpointRolePreset(id)?.label ?? '標準'
}

export const ROLE_LABELS: Record<AgentRole, string> = {
  Participant: '参加者',
  Facilitator: 'ファシリテータ'
}

export const STANCE_PRIMARY_OPTIONS = [
  '建設的・共感的',
  '探究的・批判的',
  '中立・バランス',
  '発散・アイデア重視',
  '実務・実装重視',
  '品質・リスク管理',
  'ユーザー価値重視',
  '長期・戦略視点'
] as const

export const PERSONALITY_PRIMARY_OPTIONS = [
  '前向き・協調的',
  '慎重・論理的',
  '高速・実務的',
  '丁寧・堅実',
  '分析的・俯瞰的',
  '率直・情熱的',
  '冷静・寡黙',
  '大胆・直感的'
] as const

export const STANCE_PRESETS = [
  '建設的',
  '批判的',
  '中立',
  'アイデア出し',
  'リスク分析',
  '受容的',
  '同調的',
  '挑戦的',
  'データ重視',
  '実践派',
  'ユーザー目線',
  '長期視点',
  'コスト重視',
  '速度重視',
  '品質重視',
  '新規性重視',
  '保守性重視',
  '運用重視',
  'セキュリティ重視',
  '合意形成重視'
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
  '俯瞰的',
  '丁寧',
  '堅実',
  '率直',
  '実務的',
  '主張強め',
  'ユーモラス'
] as const

export const STANCE_PRIMARY_SELECTIONS: Record<(typeof STANCE_PRIMARY_OPTIONS)[number], readonly string[]> = {
  '建設的・共感的': ['建設的', '受容的'],
  '探究的・批判的': ['批判的', 'データ重視'],
  '中立・バランス': ['中立', '合意形成重視'],
  '発散・アイデア重視': ['アイデア出し', '新規性重視'],
  '実務・実装重視': ['実践派', '速度重視'],
  '品質・リスク管理': ['品質重視', 'リスク分析'],
  'ユーザー価値重視': ['ユーザー目線'],
  '長期・戦略視点': ['長期視点']
}

export const PERSONALITY_PRIMARY_SELECTIONS: Record<(typeof PERSONALITY_PRIMARY_OPTIONS)[number], readonly string[]> = {
  '前向き・協調的': ['前向き', '協調的'],
  '慎重・論理的': ['慎重', '論理的'],
  '高速・実務的': ['実務的'],
  '丁寧・堅実': ['丁寧', '堅実'],
  '分析的・俯瞰的': ['分析的', '俯瞰的'],
  '率直・情熱的': ['率直', '熱血'],
  '冷静・寡黙': ['冷静', '寡黙'],
  '大胆・直感的': ['大胆', '直感的']
}

export const STANCE_VALUE_ALIASES: Record<string, readonly string[]> = {
  ...STANCE_PRIMARY_SELECTIONS,
  発散: ['アイデア出し'],
  アイデア重視: ['アイデア出し', '新規性重視'],
  共感的: ['受容的'],
  探究的: ['批判的', 'データ重視'],
  バランス: ['中立', '合意形成重視'],
  実務: ['実践派'],
  実装重視: ['実践派'],
  品質: ['品質重視'],
  リスク管理: ['リスク分析'],
  ユーザー価値: ['ユーザー目線'],
  戦略視点: ['長期視点']
}

export const PERSONALITY_VALUE_ALIASES: Record<string, readonly string[]> = {
  ...PERSONALITY_PRIMARY_SELECTIONS,
  情熱的: ['熱血'],
  高速: ['実務的'],
  共感的: ['協調的']
}

export const REASONING_OPTIONS: Array<{
  value: ReasoningEffort
  label: string
  description: string
}> = [
  { value: 'low', label: 'Low', description: '短めに推論して速度重視' },
  { value: 'medium', label: 'Medium', description: '標準的な推論強度' },
  { value: 'high', label: 'High', description: '深めに考えて妥当性を重視' },
  { value: 'xhigh', label: 'XHigh', description: '最大級の推論で複雑な議題向け' }
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
        .split(/\s*\/\s*|\s*・\s*|[,+，\n]+/u)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  )
}

export function serializeSelectableValue(values: string[], delimiter = '・'): string {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).join(delimiter)
}

function expandSelectableAliases(currentValue: string, aliases: Record<string, readonly string[]> = {}): string[] {
  const normalized = currentValue.trim()
  if (!normalized) {
    return []
  }

  const direct = aliases[normalized]
  if (direct) {
    return [...direct]
  }

  return parseSelectableValue(normalized).flatMap((value) => aliases[value] ? [...aliases[value]] : [value])
}

export function normalizeSelectableValue(
  currentValue: string,
  presets: readonly string[],
  aliases: Record<string, readonly string[]> = {}
): string {
  const normalized = currentValue.trim()
  if (!normalized) {
    return ''
  }

  const presetSet = new Set(presets)
  const direct = aliases[normalized]
  if (direct) {
    return serializeSelectableValue([...direct])
  }

  const normalizedParts = parseSelectableValue(normalized).flatMap((value) => {
    if (presetSet.has(value)) {
      return [value]
    }

    const mapped = aliases[value]
    if (mapped) {
      return [...mapped]
    }

    return [value]
  })

  return serializeSelectableValue(normalizedParts)
}

export function toggleSelectableValue(currentValue: string, target: string): string {
  const selections = parseSelectableValue(currentValue)
  if (selections.includes(target)) {
    return serializeSelectableValue(selections.filter((value) => value !== target))
  }
  return serializeSelectableValue([...selections, target])
}

export function appendSelectableValue(currentValue: string, extraValue: string): string {
  return serializeSelectableValue([...parseSelectableValue(currentValue), ...parseSelectableValue(extraValue)])
}

export function setPrimarySelectableValue(
  currentValue: string,
  primaryValue: string,
  aliases: Record<string, readonly string[]> = {}
): string {
  const primaryParts = expandSelectableAliases(primaryValue, aliases)
  const rest = parseSelectableValue(currentValue).filter((value) => !primaryParts.includes(value))
  return serializeSelectableValue([...primaryParts, ...rest])
}

export function getPrimarySelectableValue(
  currentValue: string,
  options: readonly string[],
  aliases: Record<string, readonly string[]> = {}
): string {
  const currentParts = expandSelectableAliases(currentValue, aliases)
  if (currentParts.length === 0) {
    return options[0] ?? ''
  }

  const matched = [...options]
    .sort((left, right) => expandSelectableAliases(right, aliases).length - expandSelectableAliases(left, aliases).length)
    .find((option) => {
      const optionParts = expandSelectableAliases(option, aliases)
      return optionParts.every((part) => currentParts.includes(part))
    })

  return matched ?? options[0] ?? ''
}

export function ensurePrimaryOption(options: readonly string[], currentValue: string): string[] {
  const normalized = currentValue.trim()
  if (!normalized || options.includes(normalized)) {
    return [...options]
  }
  return [normalized, ...options]
}
