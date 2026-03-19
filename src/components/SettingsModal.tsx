import { LoaderCircle, Plus, RefreshCcw, RotateCcw, Trash2, X } from 'lucide-react'
import { DISCUSSION_STYLE_METADATA, EXECUTION_MODE_METADATA } from '../config/modeMetadata'
import {
  PERSONALITY_PRESETS,
  PROVIDER_LABELS,
  REASONING_OPTIONS,
  ROLE_LABELS,
  STANCE_PRESETS,
  parseSelectableValue,
  serializeSelectableValue,
  toggleSelectableValue
} from '../config/agentMetadata'
import { useStore, type AgentProfile, type ProviderCatalog, type ReasoningEffort } from '../store/useStore'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

function formatRateLimit(remaining: number | null | undefined, limit: number | null | undefined): string {
  if (remaining == null && limit == null) {
    return '--'
  }

  return `${remaining ?? '?'} / ${limit ?? '?'}`
}

function createNewAgent(index: number): AgentProfile {
  return {
    id: `agent-${Date.now()}`,
    name: `新規エージェント ${index}`,
    role: 'Participant',
    stance: '新規性重視 / 中立・バランス',
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

  if (supported.length === 0) {
    return REASONING_OPTIONS
  }

  return REASONING_OPTIONS.filter((option) => supported.includes(option.value))
}

function getNextReasoningEffort(
  nextModelId: string,
  currentEffort: ReasoningEffort,
  catalog: ProviderCatalog | undefined
): ReasoningEffort {
  const modelInfo = catalog?.models.find((model) => model.id === nextModelId)
  const supported = modelInfo?.supportedReasoningEfforts ?? []

  if (supported.length === 0) {
    return currentEffort
  }

  if (supported.includes(currentEffort)) {
    return currentEffort
  }

  return modelInfo?.defaultReasoningEffort ?? supported[0] ?? 'medium'
}

function getProviderInitialModel(catalog: ProviderCatalog | undefined, fallback: string): string {
  return catalog?.models[0]?.id ?? fallback
}

interface SelectionPanelProps {
  label: string
  value: string
  presets: string[]
  onChange: (value: string) => void
}

function SelectionPanel({ label, value, presets, onChange }: SelectionPanelProps) {
  const selectedItems = parseSelectableValue(value)

  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/45 p-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-slate-300">{label}</label>
        <button
          type="button"
          onClick={() => onChange('')}
          className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-400 transition-colors hover:border-slate-500 hover:text-white"
        >
          クリア
        </button>
      </div>

      <div className="mt-3 min-h-[52px] rounded-lg border border-slate-700/60 bg-slate-950/40 px-3 py-2">
        {selectedItems.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedItems.map((item) => (
              <span
                key={item}
                className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-200"
              >
                {item}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs leading-6 text-slate-500">複数選択できます。</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map((preset) => {
          const isSelected = selectedItems.includes(preset)

          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(toggleSelectableValue(value, preset))}
              className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
                isSelected
                  ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200'
                  : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-500 hover:text-white'
              }`}
            >
              {preset}
            </button>
          )
        })}
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

  if (!isOpen) {
    return null
  }

  const isConversationMode = discussionStyle === 'conversation'
  const executionModeInfo = EXECUTION_MODE_METADATA[executionMode]
  const discussionStyleInfo = DISCUSSION_STYLE_METADATA[discussionStyle]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-700/60 bg-slate-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700/60 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-slate-100">エージェント設定</h2>
            <p className="mt-1 text-sm text-slate-400">
              起動時に各 CLI からモデル候補を取得し、ここへ反映します。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshProviderCatalogs(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-700/40 hover:text-white"
            >
              {providerCatalogStatus === 'loading' ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <RefreshCcw size={16} />
              )}
              モデル候補を再取得
            </button>
            <button
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
                CLI モデル同期: {providerCatalogStatus === 'loading' ? '更新中' : providerCatalogStatus === 'ready' ? '同期済み' : '待機中'}
              </div>
            </div>

            {providerCatalogError && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                モデル候補の取得に失敗したため、一部はフォールバック表示です: {providerCatalogError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm text-slate-400">実行モード</label>
              <div className="grid grid-cols-2 gap-3">
                <button
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
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-400">議論スタイル</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDiscussionStyle('conversation')}
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
                  onClick={() => setDiscussionStyle('meeting')}
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
              <div className="space-y-2">
                <label className="text-sm text-slate-400">挙手機構</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setHandRaiseMode('rule-based')}
                    className={`rounded-xl border px-4 py-3 text-left transition-all ${
                      handRaiseMode === 'rule-based'
                        ? 'border-cyan-500/50 bg-cyan-500/20 text-cyan-300'
                        : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <p className="font-semibold">Rule-based</p>
                    <p className="mt-1 text-xs opacity-80">ルールベースで発話順を制御します。</p>
                  </button>

                  <button
                    onClick={() => setHandRaiseMode('ai-evaluation')}
                    className={`rounded-xl border px-4 py-3 text-left transition-all ${
                      handRaiseMode === 'ai-evaluation'
                        ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
                        : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <p className="font-semibold">AI Evaluation</p>
                    <p className="mt-1 text-xs opacity-80">AI が発話優先度を評価します。</p>
                  </button>
                </div>
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
                  onClick={resetAgentsToDefault}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-700/50 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-amber-500/20 hover:text-amber-300"
                >
                  <RotateCcw size={14} />
                  全体を初期化
                </button>

                {!isConversationMode && (
                  <button
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
                const hasCurrentModel = modelOptions.some((model) => model.id === agent.model)
                const reasoningOptions = getReasoningOptions(agent, providerCatalog)

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
                          onClick={() => resetAgentToDefault(agent.id)}
                          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-amber-300"
                        >
                          <RotateCcw size={14} />
                        </button>
                        {!isConversationMode && agents.length > 2 && (
                          <button
                            onClick={() => removeAgent(agent.id)}
                            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-red-400"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
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

                      <div className="grid gap-4 md:grid-cols-2">
                        <SelectionPanel
                          label="スタンス"
                          value={agent.stance}
                          presets={STANCE_PRESETS}
                          onChange={(nextValue) => updateAgent(agent.id, { stance: serializeSelectableValue(parseSelectableValue(nextValue)) })}
                        />

                        <SelectionPanel
                          label="性格"
                          value={agent.personality}
                          presets={PERSONALITY_PRESETS}
                          onChange={(nextValue) =>
                            updateAgent(agent.id, {
                              personality: serializeSelectableValue(parseSelectableValue(nextValue))
                            })
                          }
                        />
                      </div>

                      <div className="grid gap-4 xl:grid-cols-3">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-400">CLI</label>
                          <select
                            value={agent.provider}
                            onChange={(event) => {
                              const provider = event.target.value as AgentProfile['provider']
                              const nextCatalog = providerCatalogs[provider]
                              const nextModel = getProviderInitialModel(nextCatalog, agent.model)
                              const nextReasoning = getNextReasoningEffort(nextModel, agent.reasoningEffort, nextCatalog)

                              updateAgent(agent.id, {
                                provider,
                                model: nextModel,
                                reasoningEffort: nextReasoning
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
                              const nextReasoning = getNextReasoningEffort(nextModel, agent.reasoningEffort, providerCatalog)
                              updateAgent(agent.id, {
                                model: nextModel,
                                reasoningEffort: nextReasoning
                              })
                            }}
                            className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-base text-slate-100 outline-none focus:border-cyan-500"
                          >
                            {!hasCurrentModel && (
                              <option value={agent.model}>{agent.model} (現在値)</option>
                            )}
                            {modelOptions.map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.name}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-slate-500">
                            取得元: {providerCatalog?.source ?? 'fallback'}
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-400">Reasoning</label>
                          <select
                            value={agent.reasoningEffort}
                            onChange={(event) =>
                              updateAgent(agent.id, { reasoningEffort: event.target.value as AgentProfile['reasoningEffort'] })
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
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 px-3 py-2 text-sm text-slate-300">
                        <p className="text-slate-400">Daily Rate Limit</p>
                        <p className="mt-1 font-mono text-slate-100">
                          {formatRateLimit(agent.rateLimits?.daily?.remaining, agent.rateLimits?.daily?.limit)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 px-3 py-2 text-sm text-slate-300">
                        <p className="text-slate-400">Weekly Rate Limit</p>
                        <p className="mt-1 font-mono text-slate-100">
                          {formatRateLimit(agent.rateLimits?.weekly?.remaining, agent.rateLimits?.weekly?.limit)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <div className="flex justify-end border-t border-slate-700/50 px-6 py-5">
          <button
            onClick={onClose}
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 font-medium text-white shadow-lg transition-all hover:from-cyan-400 hover:to-blue-500"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
