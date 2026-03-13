import { X, Plus, Trash2 } from 'lucide-react';
import { useStore, type AgentProfile } from '../store/useStore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { agents, addAgent, updateAgent, removeAgent, turnLimit, environment } = useStore();

  const handleAddAgent = () => {
    const newAgent: AgentProfile = {
      id: `agent-${Date.now()}`,
      name: `New Agent ${agents.length + 1}`,
      role: 'Participant',
      stance: 'バランス重視',
      personality: 'フラット',
      model: 'Codex (gpt-5.4)',
      status: 'idle',
      handRaiseIntensity: 0,
      speakCount: 0
    };
    addAgent(newAgent);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700/50 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <h2 className="text-xl font-bold text-slate-100">設定・エージェント管理</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* 会議環境設定 */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider">Session Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-400">実行環境</label>
                <select 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                  defaultValue={environment}
                >
                  <option value="sandbox">Sandbox (安全推奨)</option>
                  <option value="full">Full Access (権限あり)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-400">ターン数（議論の往復回数）</label>
                <input 
                  type="number" 
                  defaultValue={turnLimit}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </section>

          {/* エージェント管理 */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider">Agents Config ({agents.length}名)</h3>
              <button 
                onClick={handleAddAgent}
                disabled={agents.length >= 4}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Plus size={16} /> 追加
              </button>
            </div>

            <div className="space-y-4">
              {agents.map((agent) => (
                <div key={agent.id} className="p-4 rounded-xl bg-slate-900/50 border border-slate-700 relative group">
                  {agents.length > 2 && (
                    <button 
                      onClick={() => removeAgent(agent.id)}
                      className="absolute top-4 right-4 text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 mr-8">
                    <div className="space-y-1.5col-span-1">
                      <label className="text-xs text-slate-500">エージェント名</label>
                      <input 
                        type="text" 
                        value={agent.name}
                        onChange={(e) => updateAgent(agent.id, { name: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-500">ロール</label>
                      <select
                        value={agent.role}
                        onChange={(e) => updateAgent(agent.id, { role: e.target.value as 'Participant' | 'Facilitator' })}
                        className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 outline-none"
                      >
                        <option value="Participant">参加者 (Participant)</option>
                        <option value="Facilitator">ファシリテーター (司会進行)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-500">スタンス (意見の方向性)</label>
                      <input 
                        type="text" 
                        value={agent.stance}
                        onChange={(e) => updateAgent(agent.id, { stance: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 outline-none"
                        placeholder="例: 批判的、受容的..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-500">性格 (パーソナリティ)</label>
                      <input 
                        type="text" 
                        value={agent.personality}
                        onChange={(e) => updateAgent(agent.id, { personality: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 outline-none"
                        placeholder="例: 論理的、声が大きい..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-slate-700/50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-xl transition-all shadow-lg"
          >
            完了
          </button>
        </div>

      </div>
    </div>
  );
}
