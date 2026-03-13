import { useState } from 'react';
import { X, Plus, Trash2, ChevronDown, RotateCcw } from 'lucide-react';
import { useStore, type AgentProfile } from '../store/useStore';

// スタンスのプリセット一覧
const STANCE_PRESETS = [
  { label: '建設的', description: '前向きな提案を中心に' },
  { label: '批判的', description: 'リスクや問題を指摘' },
  { label: '中立', description: '客観的に分析' },
  { label: 'アイデア出し', description: '創造的な発想' },
  { label: 'リスク分析', description: '潜在的な問題を洗い出し' },
  { label: '受容的', description: '他者の意見を受け入れる' },
  { label: '同調的', description: '合意形成を重視' },
  { label: '挑戦的', description: '現状打破を提案' },
  { label: 'データ重視', description: '数値やエビデンスに基づく' },
  { label: '実践派', description: '実行可能性を重視' },
  { label: 'ユーザー目線', description: 'エンドユーザーの視点' },
  { label: '長期視点', description: '将来を見据えた意見' },
];

// 性格のプリセット一覧
const PERSONALITY_PRESETS = [
  { label: '論理的', description: '筋道立てて話す' },
  { label: '感情的', description: '情熱や共感で語る' },
  { label: '協調的', description: '周囲と合わせる' },
  { label: '前向き', description: 'ポジティブな姿勢' },
  { label: '慎重', description: '石橋を叩いて渡る' },
  { label: '大胆', description: '思い切った主張' },
  { label: '冷静', description: '落ち着いた判断' },
  { label: '熱血', description: '強い意志で主張' },
  { label: '分析的', description: '詳細を掘り下げる' },
  { label: '直感的', description: '第六感を信じる' },
  { label: '寡黙', description: '少ない言葉で核心を突く' },
  { label: '饒舌', description: '豊富な例えで説明' },
  { label: '皮肉屋', description: '鋭い指摘とユーモア' },
  { label: '俯瞰的', description: '全体像を見る' },
];

interface PresetPanelProps {
  title: string;
  presets: { label: string; description: string }[];
  selectedValues: string[];
  onToggle: (label: string) => void;
  onClose: () => void;
  customValue: string;
  onCustomChange: (value: string) => void;
  accentColor: 'cyan' | 'amber';
}

function PresetPanel({ title, presets, selectedValues, onToggle, onClose, customValue, onCustomChange, accentColor }: PresetPanelProps) {
  const colorClasses = accentColor === 'amber' 
    ? { selected: 'bg-amber-500/20 border-amber-500/50 text-amber-300', hover: 'hover:border-amber-500/30' }
    : { selected: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300', hover: 'hover:border-cyan-500/30' };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400 font-medium">{title}（複数選択可）</p>
        <button
          type="button"
          onClick={onClose}
          aria-label={`${title}パネルを閉じる`}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 bg-slate-900/60 text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200"
        >
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {presets.map(preset => {
          const isSelected = selectedValues.includes(preset.label);
          return (
            <button
              key={preset.label}
              onClick={() => onToggle(preset.label)}
              title={preset.description}
              className={`flex h-11 w-full items-center justify-center rounded-lg border px-3 text-center text-sm font-semibold leading-tight transition-all ${
                isSelected
                  ? colorClasses.selected
                  : `bg-slate-900/50 border-slate-700 text-slate-400 ${colorClasses.hover}`
              }`}
            >
              <span className="px-1">{preset.label}</span>
            </button>
          );
        })}
      </div>
      <input
        type="text"
        value={customValue}
        onChange={(e) => onCustomChange(e.target.value)}
        placeholder="追加ニュアンス（任意）例: 少し皮肉を交えて"
        className="w-full bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-3 text-sm text-slate-200 focus:border-cyan-500 outline-none placeholder:text-sm placeholder:text-slate-500"
      />
    </div>
  );
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { agents, addAgent, updateAgent, removeAgent, resetAgentsToDefault, resetAgentToDefault, turnLimit, setTurnLimit, handRaiseMode, setHandRaiseMode, environment, sessionMode, setSessionMode } = useStore();
  const isConversationMode = sessionMode === 'conversation';
  const sessionModeDescription = isConversationMode
    ? '対話モードでは2名が交互に応答します。挙手判定やファシリテーターは使わず、相手の発言を受けて会話を深める設定です。'
    : 'Meeting モードでは複数エージェントが会議形式で議論します。挙手判定、進行役、スタンスや性格による振る舞いの違いを活かす設定です。';
  
  // プリセットパネルの開閉状態（agentId => 'stance' | 'personality' | null）
  const [openPanel, setOpenPanel] = useState<{ agentId: string; type: 'stance' | 'personality' } | null>(null);

  const handleAddAgent = () => {
    if (isConversationMode) return;

    const newAgent: AgentProfile = {
      id: `agent-${Date.now()}`,
      name: `New Agent ${agents.length + 1}`,
      role: 'Participant',
      stance: 'バランス重視',
      personality: 'フラット',
      model: 'gpt-5.4',
      runtimeSessionId: null,
      status: 'idle',
      handRaiseIntensity: 0,
      speakCount: 0
    };
    addAgent(newAgent);
  };

  const handleSessionModeChange = (mode: 'conversation' | 'meeting') => {
    setOpenPanel(null);
    setSessionMode(mode);
  };

  // プリセットのトグル処理
  const handlePresetToggle = (agentId: string, field: 'stance' | 'personality', label: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;
    
    const currentValue = agent[field];
    const currentParts = currentValue.split('・').map(s => s.trim()).filter(Boolean);
    
    if (currentParts.includes(label)) {
      // 既に選択済み → 削除
      const newParts = currentParts.filter(p => p !== label);
      updateAgent(agentId, { [field]: newParts.join('・') || '未設定' });
    } else {
      // 新規追加
      const newParts = [...currentParts.filter(p => p !== '未設定'), label];
      updateAgent(agentId, { [field]: newParts.join('・') });
    }
  };

  // 現在のフィールド値から選択中のプリセットを抽出
  const getSelectedPresets = (value: string): string[] => {
    return value.split('・').map(s => s.trim()).filter(Boolean);
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
            <div className="space-y-2">
              <label className="text-sm text-slate-400">セッションモード</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleSessionModeChange('conversation')}
                  className={`rounded-xl border px-4 py-3 text-left transition-all ${
                    isConversationMode
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <p className="font-semibold">Conversation モード</p>
                  <p className="mt-1 text-xs opacity-75">2人で交互に聞き合いながら対話する</p>
                </button>
                <button
                  onClick={() => handleSessionModeChange('meeting')}
                  className={`rounded-xl border px-4 py-3 text-left transition-all ${
                    sessionMode === 'meeting'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <p className="font-semibold">Meeting モード</p>
                  <p className="mt-1 text-xs opacity-75">挙手・進行役・性格差が効く会議向け</p>
                </button>
              </div>
              <div className={`rounded-xl border px-4 py-3 text-sm ${
                isConversationMode
                  ? 'border-cyan-500/20 bg-cyan-500/10 text-slate-300'
                  : 'border-amber-500/20 bg-amber-500/10 text-slate-300'
              }`}>
                {sessionModeDescription}
              </div>
            </div>
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
                <label className="text-sm text-slate-400">ターン数（各エージェントの平均発言回数）</label>
                <input 
                  type="number" 
                  min={1}
                  max={10}
                  value={turnLimit}
                  onChange={(e) => setTurnLimit(Number(e.target.value) || 1)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            
            {isConversationMode ? null : (
              <div className="space-y-2">
                <label className="text-sm text-slate-400">挙手判定方式（発言者の決定方法）</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setHandRaiseMode('rule-based')}
                    className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                      handRaiseMode === 'rule-based'
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                        : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <p className="font-semibold">📐 ルールベース</p>
                    <p className="text-[10px] mt-1 opacity-70">高速・発言バランスと文脈で判定</p>
                  </button>
                  <button
                    onClick={() => setHandRaiseMode('ai-evaluation')}
                    className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                      handRaiseMode === 'ai-evaluation'
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <p className="font-semibold">🧠 AI評価</p>
                    <p className="text-[10px] mt-1 opacity-70">自然だが時間がかかる</p>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* エージェント管理 */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider">Agents Config ({isConversationMode ? '2名固定' : `${agents.length}名`})</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={resetAgentsToDefault}
                  title="現在のモードの推奨構成に戻す"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 text-slate-400 hover:bg-amber-500/20 hover:text-amber-400 rounded-lg text-sm font-medium transition-colors"
                >
                  <RotateCcw size={14} /> リセット
                </button>
                {!isConversationMode && (
                  <button 
                    onClick={handleAddAgent}
                    disabled={agents.length >= 6}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Plus size={16} /> 追加
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {agents.map((agent) => {
                const isFacilitator = agent.role === 'Facilitator';
                const isStanceOpen = openPanel?.agentId === agent.id && openPanel.type === 'stance';
                const isPersonalityOpen = openPanel?.agentId === agent.id && openPanel.type === 'personality';
                
                return (
                  <div key={agent.id} className={`p-4 rounded-xl border relative group ${
                    isFacilitator 
                      ? 'bg-amber-900/10 border-amber-700/30' 
                      : 'bg-slate-900/50 border-slate-700'
                  }`}>
                    <div className="absolute top-4 right-4 flex items-center gap-1">
                      <button 
                        onClick={() => resetAgentToDefault(agent.id)}
                        title="このエージェントの設定を初期値に戻す"
                        className="text-slate-500 hover:text-amber-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        <RotateCcw size={14} />
                      </button>
                      {!isConversationMode && agents.length > 2 && (
                        <button 
                          onClick={() => removeAgent(agent.id)}
                          className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mr-8">
                      <div className="space-y-1.5">
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
                          disabled={isConversationMode}
                          className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 outline-none disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="Participant">参加者 (Participant)</option>
                          <option value="Facilitator">ファシリテーター (司会進行)</option>
                        </select>
                      </div>
                      
                      {/* スタンス */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-500">スタンス (意見の方向性)</label>
                        <button
                          onClick={() => setOpenPanel(isStanceOpen ? null : { agentId: agent.id, type: 'stance' })}
                          className="w-full flex items-center justify-between bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 hover:border-cyan-500/50 transition-colors text-left"
                        >
                          <span className="truncate">{agent.stance}</span>
                          <ChevronDown size={14} className={`text-slate-500 transition-transform shrink-0 ml-1 ${isStanceOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>

                      {/* 性格 */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-500">性格 (パーソナリティ)</label>
                        <button
                          onClick={() => setOpenPanel(isPersonalityOpen ? null : { agentId: agent.id, type: 'personality' })}
                          className="w-full flex items-center justify-between bg-slate-800 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 hover:border-cyan-500/50 transition-colors text-left"
                        >
                          <span className="truncate">{agent.personality}</span>
                          <ChevronDown size={14} className={`text-slate-500 transition-transform shrink-0 ml-1 ${isPersonalityOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* スタンス プリセットパネル */}
                    {isStanceOpen && (
                      <div className="mt-3 pt-3 border-t border-slate-700/50">
                        <PresetPanel
                          title="スタンス"
                          presets={STANCE_PRESETS}
                          selectedValues={getSelectedPresets(agent.stance)}
                          onToggle={(label) => handlePresetToggle(agent.id, 'stance', label)}
                          onClose={() => setOpenPanel(null)}
                          customValue=""
                          onCustomChange={(val) => {
                            if (val) {
                              const current = agent.stance === '未設定' ? '' : agent.stance;
                              updateAgent(agent.id, { stance: current ? `${current}・${val}` : val });
                            }
                          }}
                          accentColor={isFacilitator ? 'amber' : 'cyan'}
                        />
                      </div>
                    )}

                    {/* 性格 プリセットパネル */}
                    {isPersonalityOpen && (
                      <div className="mt-3 pt-3 border-t border-slate-700/50">
                        <PresetPanel
                          title="性格"
                          presets={PERSONALITY_PRESETS}
                          selectedValues={getSelectedPresets(agent.personality)}
                          onToggle={(label) => handlePresetToggle(agent.id, 'personality', label)}
                          onClose={() => setOpenPanel(null)}
                          customValue=""
                          onCustomChange={(val) => {
                            if (val) {
                              const current = agent.personality === '未設定' ? '' : agent.personality;
                              updateAgent(agent.id, { personality: current ? `${current}・${val}` : val });
                            }
                          }}
                          accentColor={isFacilitator ? 'amber' : 'cyan'}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
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
