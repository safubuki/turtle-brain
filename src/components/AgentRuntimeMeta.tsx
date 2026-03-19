import { PROVIDER_LABELS, formatReasoningEffort } from '../config/agentMetadata'
import { useStore, type AgentProfile, type RateLimitWindow } from '../store/useStore'

function formatRateLimit(window: RateLimitWindow | null): string {
  if (!window) {
    return '--'
  }

  const remaining = window.remaining ?? '?'
  const limit = window.limit ?? '?'
  return `${remaining}/${limit}`
}

interface AgentRuntimeMetaProps {
  agent: Pick<AgentProfile, 'provider' | 'model' | 'reasoningEffort' | 'rateLimits'>
  compact?: boolean
}

export function AgentRuntimeMeta({ agent, compact = false }: AgentRuntimeMetaProps) {
  const providerCatalog = useStore((state) => state.providerCatalogs[agent.provider])
  const modelInfo = providerCatalog?.models.find((entry) => entry.id === agent.model)
  const showReasoning = (modelInfo?.supportedReasoningEfforts?.length ?? 0) > 0
  const baseTextClass = compact ? 'text-[11px]' : 'text-xs'
  const valueTextClass = compact ? 'text-slate-100' : 'text-slate-200'

  return (
    <div className="space-y-2">
      <div className={`grid gap-2 ${compact ? 'grid-cols-1' : showReasoning ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-2">
          <p className={`${baseTextClass} uppercase tracking-wider text-slate-500`}>CLI</p>
          <p className={`mt-1 ${valueTextClass}`}>{PROVIDER_LABELS[agent.provider]}</p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-2">
          <p className={`${baseTextClass} uppercase tracking-wider text-slate-500`}>Model</p>
          <p className={`mt-1 break-all ${valueTextClass}`}>{agent.model}</p>
        </div>
        {showReasoning && (
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-2">
            <p className={`${baseTextClass} uppercase tracking-wider text-slate-500`}>Reasoning</p>
            <p className={`mt-1 ${valueTextClass}`}>{formatReasoningEffort(agent.reasoningEffort)}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-2">
          <p className={`${baseTextClass} uppercase tracking-wider text-slate-500`}>Daily</p>
          <p className={`mt-1 font-mono ${valueTextClass}`}>{formatRateLimit(agent.rateLimits?.daily ?? null)}</p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-2">
          <p className={`${baseTextClass} uppercase tracking-wider text-slate-500`}>Weekly</p>
          <p className={`mt-1 font-mono ${valueTextClass}`}>{formatRateLimit(agent.rateLimits?.weekly ?? null)}</p>
        </div>
      </div>
    </div>
  )
}
