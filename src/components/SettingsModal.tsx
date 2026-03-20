import { ChevronDown, LoaderCircle, Plus, RefreshCcw, RotateCcw, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { DISCUSSION_STYLE_METADATA, EXECUTION_MODE_METADATA } from '../config/modeMetadata'
import {
  PERSONALITY_PRESETS,
  PERSONALITY_PRIMARY_OPTIONS,
  PROVIDER_LABELS,
  REASONING_OPTIONS,
  ROLE_LABELS,
  STANCE_PRESETS,
  STANCE_PRIMARY_OPTIONS,
  appendSelectableValue,
  ensurePrimaryOption,
  getPrimarySelectableValue,
  parseSelectableValue,
  setPrimarySelectableValue,
  toggleSelectableValue
} from '../config/agentMetadata'
import { useStore, type AgentProfile, type ProviderCatalog, type ReasoningEffort } from '../store/useStore'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface SelectionPanelProps {
  title: string
  presets: readonly string[]
  selectedValues: string[]
  customValue: string
  accentColor: 'cyan' | 'amber'
  onToggle: (value: string) => void
  onClear: () => void
  onClose: () => void
  onCustomChange: (value: string) => void
  onCustomCommit: () => void
}

function createNewAgent(index: number): AgentProfile {
  const nextLetter = String.fromCharCode(64 + Math.min(index, 26))
  return {
    id: `agent-${Date.now()}`,
    name: `エージェント${nextLetter}`,
    role: 'Participant',
    stance: '中立・バランス',
    personality: '丁寧・堅実',
    provider: 'codex',
    model: 'gpt-5.4',
    reasoningEffort: 'medium',
    runtimeSessionId: null,
    rateLimits: null,
    status: 'idle',
    handRaiseIntensity: 0,
    speakCount: 0
  }
}

function getReasoningOptions(agent: AgentProfile, catalog: ProviderCatalog | undefined) {
  const modelInfo = catalog?.models.find((model) => model.id === agent.model)
  const supported = modelInfo?.supportedReasoningEfforts ?? []
  return REASONING_OPTIONS.filter((option) => supported.includes(option.value))
}

function getNextReasoningEffort(
  nextModelId: string,
  currentEffort: ReasoningEffort,
  catalog: ProviderCatalog | undefined
): ReasoningEffort {
  const modelInfo = catalog?.models.find((model) => model.id === nextModelId)
  const supported = modelInfo?.supportedReasoningEfforts ?? []

  if (supported.length === 0 || supported.includes(currentEffort)) {
    return currentEffort
  }

  return modelInfo?.defaultReasoningEffort ?? supported[0] ?? 'medium'
}

function getProviderInitialModel(catalog: ProviderCatalog | undefined, fallback: string): string {
  return catalog?.models[0]?.id ?? fallback
}

function getCatalogStatusLabel(status: 'idle' | 'loading' | 'ready' | 'error'): string {
  switch (status) {
    case 'loading':
      return '取得中'
    case 'ready':
      return '利用可能'
    case 'error':
      return 'フォールバック'
    default:
      return '待機中'
  }
}

function SelectionPanel({
  title,
  presets,
  selectedValues,
  customValue,
  accentColor,
  onToggle,
  onClear,
  onClose,
  onCustomChange,
  onCustomCommit
}: SelectionPanelProps) {
  const selectedClass =
    accentColor === 'amber'
      ? 'border-amber-500/50 bg-amber-500/15 text-amber-200'
      : 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200'

  return (
    <div className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-950/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-200">{title}（複数選択可）</p>
          <p className="mt-1 text-xs text-slate-500">主軸に加えるニュアンスを複数選べます。</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 transition-colors hover:border-slate-500 hover:text-white"
          >
            クリア
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/60 text-slate-400 transition-colors hover:border-slate-500 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="min-h-[56px] rounded-xl border border-slate-700/60 bg-slate-950/40 px-3 py-3">
        {selectedValues.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedValues.map((item) => (
              <span key={item} className={`rounded-full border px-2.5 py-1 text-xs ${selectedClass}`}>
                {item}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">まだ選択されていません。</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {presets.map((preset) => {
          const isSelected = selectedValues.includes(preset)
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onToggle(preset)}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                isSelected
                  ? selectedClass
                  : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-500 hover:text-white'
              }`}
            >
              {preset}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customValue}
          onChange={(event) => onCustomChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              onCustomCommit()
            }
          }}
          placeholder="追加ニュアンス（任意）例: 少し皮肉を交えて"
          className="flex-1 rounded-xl border border-slate-600/60 bg-slate-900/50 px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-500"
        />
        <button
          type="button"
          onClick={onCustomCommit}
          disabled={!customValue.trim()}
          className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-300 transition-colors hover:border-cyan-400 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900/50 disabled:text-slate-500"
        >
          追加
        </button>
      </div>
    </div>
  )
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    agents,
    addAgent,
    updateAgent,
    removeAgent,
    resetAgentsToDefault,
    resetAgentToDefault,
    turnLimit,
    setTurnLimit,
    handRaiseMode,
    setHandRaiseMode,
    environment,
    executionMode,
    setExecutionMode,
    discussionStyle,
    setDiscussionStyle,
    providerCatalogs,
    providerCatalogStatus,
    providerCatalogError,
    refreshProviderCatalogs
  } = useStore()

  const [customInputs, setCustomInputs] = useState<Record<string, string>>({})
  const [openPanel, setOpenPanel] = useState<{ agentId: string; type: 'stance' | 'personality' } | null>(null)

  if (!isOpen) {
    return null
  }

  const isConversationMode = discussionStyle === 'conversation'
  const executionModeInfo = EXECUTION_MODE_METADATA[executionMode]
  const discussionStyleInfo = DISCUSSION_STYLE_METADATA[discussionStyle]
  const getCustomKey = (agentId: string, field: 'stance' | 'personality') => `${agentId}:${field}`
  const setCustomValue = (agentId: string, field: 'stance' | 'personality', value: string) => {
    setCustomInputs((current) => ({ ...current, [getCustomKey(agentId, field)]: value }))
  }
  const clearCustomValue = (agentId: string, field: 'stance' | 'personality') => {
    setCustomInputs((current) => ({ ...current, [getCustomKey(agentId, field)]: '' }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-700/60 bg-slate-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700/60 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-100">設定・エージェント管理</h2>
            <p className="mt-1 text-sm text-slate-400">旧 UI の主軸選択と複数選択パネルを維持した構成です。</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshProviderCatalogs(true)}
              disabled={providerCatalogStatus === 'loading'}
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-700/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {providerCatalogStatus === 'loading' ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
              モデル候補を再取得
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">セッション設定</h3>
              <div className="rounded-full border border-slate-700/60 bg-slate-900/40 px-3 py-1 text-xs text-slate-400">
                CLI モデル同期: {getCatalogStatusLabel(providerCatalogStatus)}
              </div>
            </div>

            {providerCatalogError && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                モデル候補の取得に失敗したため、一部はフォールバック表示です: {providerCatalogError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExecutionMode('orchestration')}
                className={`rounded-xl border px-4 py-3 text-left transition-all ${
                  executionMode === 'orchestration'
                    ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                    : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
                }`}
              >
                <p className="font-semibold">{EXECUTION_MODE_METADATA.orchestration.label}</p>
                <p className="mt-1 text-xs opacity-80">{EXECUTION_MODE_METADATA.orchestration.shortDescription}</p>
              </button>
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-left text-slate-500 opacity-60"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{EXECUTION_MODE_METADATA.autonomous.label}</p>
                  <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] tracking-wider text-slate-500">
                    {EXECUTION_MODE_METADATA.autonomous.badge}
                  </span>
                </div>
                <p className="mt-1 text-xs opacity-80">{EXECUTION_MODE_METADATA.autonomous.shortDescription}</p>
              </button>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-slate-300">
              {executionModeInfo.longDescription}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setOpenPanel(null)
                  setDiscussionStyle('conversation')
                }}
                className={`rounded-xl border px-4 py-3 text-left transition-all ${
                  discussionStyle === 'conversation'
                    ? 'border-cyan-500/50 bg-cyan-500/20 text-cyan-300'
                    : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
                }`}
              >
                <p className="font-semibold">{DISCUSSION_STYLE_METADATA.conversation.label}</p>
                <p className="mt-1 text-xs opacity-80">{DISCUSSION_STYLE_METADATA.conversation.shortDescription}</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenPanel(null)
                  setDiscussionStyle('meeting')
                }}
                className={`rounded-xl border px-4 py-3 text-left transition-all ${
                  discussionStyle === 'meeting'
                    ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
                    : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
                }`}
              >
                <p className="font-semibold">{DISCUSSION_STYLE_METADATA.meeting.label}</p>
                <p className="mt-1 text-xs opacity-80">{DISCUSSION_STYLE_METADATA.meeting.shortDescription}</p>
              </button>
            </div>

            <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3 text-sm text-slate-300">
              {discussionStyleInfo.longDescription}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-400">実行環境</label>
                <select
                  value={environment}
                  disabled
                  className="w-full cursor-not-allowed rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-slate-400 opacity-70"
                >
                  <option value="sandbox">Sandbox</option>
                  <option value="full">Full Access</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-400">ターン数</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={turnLimit}
                  onChange={(event) => setTurnLimit(Number(event.target.value) || 1)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-slate-200 outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {!isConversationMode && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setHandRaiseMode('rule-based')}
                  className={`rounded-xl border px-4 py-3 text-left transition-all ${
                    handRaiseMode === 'rule-based'
                      ? 'border-cyan-500/50 bg-cyan-500/20 text-cyan-300'
                      : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <p className="font-semibold">Rule-based</p>
                  <p className="mt-1 text-xs opacity-80">ルールベースで発言者を決定します。</p>
                </button>
                <button
                  type="button"
                  onClick={() => setHandRaiseMode('ai-evaluation')}
                  className={`rounded-xl border px-4 py-3 text-left transition-all ${
                    handRaiseMode === 'ai-evaluation'
                      ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
                      : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <p className="font-semibold">AI Evaluation</p>
                  <p className="mt-1 text-xs opacity-80">AI が文脈を見て発言者を決定します。</p>
                </button>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
                エージェント設定 ({isConversationMode ? '2名固定' : `${agents.length}名`})
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpenPanel(null)
                    resetAgentsToDefault()
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-700/50 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-amber-500/20 hover:text-amber-300"
                >
                  <RotateCcw size={14} />
                  リセット
                </button>
                {!isConversationMode && (
                  <button
                    type="button"
                    onClick={() => addAgent(createNewAgent(agents.length + 1))}
                    disabled={agents.length >= 6}
                    className="flex items-center gap-1.5 rounded-lg bg-cyan-500/20 px-3 py-1.5 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-500/30 disabled:opacity-50"
                  >
                    <Plus size={16} />
                    追加
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {agents.map((agent) => {
                const isFacilitator = agent.role === 'Facilitator'
                const providerCatalog = providerCatalogs[agent.provider]
                const modelOptions = providerCatalog?.models ?? []
                const fallbackModelOption =
                  modelOptions.length === 0 && agent.model
                    ? [
                        {
                          id: agent.model,
                          name: `${agent.model} (現在値)`
                        }
                      ]
                    : []
                const displayModelOptions = modelOptions.length > 0 ? modelOptions : fallbackModelOption
                const hasCurrentModel = displayModelOptions.some((model) => model.id === agent.model)
                const reasoningOptions = getReasoningOptions(agent, providerCatalog)
                const showReasoning = reasoningOptions.length > 0
                const isStanceOpen = openPanel?.agentId === agent.id && openPanel.type === 'stance'
                const isPersonalityOpen = openPanel?.agentId === agent.id && openPanel.type === 'personality'
                const accentColor = isFacilitator ? 'amber' : 'cyan'
                const stancePrimary = getPrimarySelectableValue(agent.stance, STANCE_PRIMARY_OPTIONS)
                const personalityPrimary = getPrimarySelectableValue(agent.personality, PERSONALITY_PRIMARY_OPTIONS)
                const stanceDisplay = agent.stance || stancePrimary || '未設定'
                const personalityDisplay = agent.personality || personalityPrimary || '未設定'

                return (
                  <div
                    key={agent.id}
                    className={`rounded-2xl border p-4 ${
                      isFacilitator
                        ? 'border-amber-500/30 bg-amber-500/10'
                        : 'border-slate-700/70 bg-slate-900/45'
                    }`}
                  >
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-semibold text-slate-100">{agent.name}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {ROLE_LABELS[agent.role]} ・ {PROVIDER_LABELS[agent.provider]}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenPanel((current) => (current?.agentId === agent.id ? null : current))
                            resetAgentToDefault(agent.id)
                          }}
                          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-amber-300"
                        >
                          <RotateCcw size={14} />
                        </button>
                        {!isConversationMode && agents.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeAgent(agent.id)}
                            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-red-400"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">エージェント名</label>
                        <input
                          type="text"
                          value={agent.name}
                          onChange={(event) => updateAgent(agent.id, { name: event.target.value })}
                          className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-base font-medium text-slate-100 outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">ロール</label>
                        <select
                          value={agent.role}
                          onChange={(event) => updateAgent(agent.id, { role: event.target.value as AgentProfile['role'] })}
                          disabled={isConversationMode}
                          className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="Participant">参加者</option>
                          <option value="Facilitator">ファシリテータ</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">スタンス（意見の方向性）</label>
                        <button
                          type="button"
                          onClick={() => setOpenPanel(isStanceOpen ? null : { agentId: agent.id, type: 'stance' })}
                          className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-left text-base text-slate-100 transition-colors hover:border-cyan-500/50"
                        >
                          <span className="min-w-0 whitespace-normal break-words text-sm leading-6">{stanceDisplay}</span>
                          <ChevronDown size={14} className={`ml-2 shrink-0 text-slate-500 transition-transform ${isStanceOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">性格（パーソナリティ）</label>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenPanel(isPersonalityOpen ? null : { agentId: agent.id, type: 'personality' })
                          }
                          className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-left text-base text-slate-100 transition-colors hover:border-cyan-500/50"
                        >
                          <span className="min-w-0 whitespace-normal break-words text-sm leading-6">{personalityDisplay}</span>
                          <ChevronDown
                            size={14}
                            className={`ml-2 shrink-0 text-slate-500 transition-transform ${isPersonalityOpen ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>
                    </div>

                    {isStanceOpen && (
                      <div className="mt-4 space-y-4 rounded-2xl border border-slate-700/50 bg-slate-900/25 p-4">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-400">スタンス（主軸）</label>
                          <select
                            value={stancePrimary}
                            onChange={(event) => updateAgent(agent.id, { stance: setPrimarySelectableValue(agent.stance, event.target.value) })}
                            className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-cyan-500"
                          >
                            {ensurePrimaryOption(STANCE_PRIMARY_OPTIONS, stancePrimary).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                        <SelectionPanel
                          title="スタンス"
                          presets={STANCE_PRESETS}
                          selectedValues={parseSelectableValue(agent.stance)}
                          customValue={customInputs[getCustomKey(agent.id, 'stance')] ?? ''}
                          accentColor={accentColor}
                          onToggle={(value) => updateAgent(agent.id, { stance: toggleSelectableValue(agent.stance, value) })}
                          onClear={() => updateAgent(agent.id, { stance: '' })}
                          onClose={() => setOpenPanel(null)}
                          onCustomChange={(value) => setCustomValue(agent.id, 'stance', value)}
                          onCustomCommit={() => {
                            const nextValue = customInputs[getCustomKey(agent.id, 'stance')] ?? ''
                            if (!nextValue.trim()) return
                            updateAgent(agent.id, { stance: appendSelectableValue(agent.stance, nextValue) })
                            clearCustomValue(agent.id, 'stance')
                          }}
                        />
                      </div>
                    )}

                    {isPersonalityOpen && (
                      <div className="mt-4 space-y-4 rounded-2xl border border-slate-700/50 bg-slate-900/25 p-4">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-400">性格（主軸）</label>
                          <select
                            value={personalityPrimary}
                            onChange={(event) =>
                              updateAgent(agent.id, {
                                personality: setPrimarySelectableValue(agent.personality, event.target.value)
                              })
                            }
                            className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-cyan-500"
                          >
                            {ensurePrimaryOption(PERSONALITY_PRIMARY_OPTIONS, personalityPrimary).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                        <SelectionPanel
                          title="性格"
                          presets={PERSONALITY_PRESETS}
                          selectedValues={parseSelectableValue(agent.personality)}
                          customValue={customInputs[getCustomKey(agent.id, 'personality')] ?? ''}
                          accentColor={accentColor}
                          onToggle={(value) => updateAgent(agent.id, { personality: toggleSelectableValue(agent.personality, value) })}
                          onClear={() => updateAgent(agent.id, { personality: '' })}
                          onClose={() => setOpenPanel(null)}
                          onCustomChange={(value) => setCustomValue(agent.id, 'personality', value)}
                          onCustomCommit={() => {
                            const nextValue = customInputs[getCustomKey(agent.id, 'personality')] ?? ''
                            if (!nextValue.trim()) return
                            updateAgent(agent.id, { personality: appendSelectableValue(agent.personality, nextValue) })
                            clearCustomValue(agent.id, 'personality')
                          }}
                        />
                      </div>
                    )}

                    <div className="mt-4 grid gap-4 xl:grid-cols-3">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">CLI</label>
                        <select
                          value={agent.provider}
                          onChange={(event) => {
                            const provider = event.target.value as AgentProfile['provider']
                            const nextCatalog = providerCatalogs[provider]
                            const nextModel = getProviderInitialModel(nextCatalog, agent.model)
                            updateAgent(agent.id, {
                              provider,
                              model: nextModel,
                              reasoningEffort: getNextReasoningEffort(nextModel, agent.reasoningEffort, nextCatalog)
                            })
                          }}
                          className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-cyan-500"
                        >
                          {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-400">Model</label>
                        <select
                          value={agent.model}
                          onChange={(event) => {
                            const nextModel = event.target.value
                            updateAgent(agent.id, {
                              model: nextModel,
                              reasoningEffort: getNextReasoningEffort(nextModel, agent.reasoningEffort, providerCatalog)
                            })
                          }}
                          className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-cyan-500"
                        >
                          {!hasCurrentModel && <option value={agent.model}>{agent.model} (現在値)</option>}
                          {displayModelOptions.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-slate-500">取得元: {providerCatalog?.source ?? 'fallback'}</p>
                      </div>
                      {showReasoning && (
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-400">Reasoning</label>
                          <select
                            value={agent.reasoningEffort}
                            onChange={(event) =>
                              updateAgent(agent.id, {
                                reasoningEffort: event.target.value as AgentProfile['reasoningEffort']
                              })
                            }
                            className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-cyan-500"
                          >
                            {reasoningOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label} - {option.description}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                  </div>
                )
              })}
            </div>
          </section>
        </div>
        <div className="flex justify-end border-t border-slate-700/50 px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 font-medium text-white shadow-lg transition-all hover:from-cyan-400 hover:to-blue-500"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  )
}
