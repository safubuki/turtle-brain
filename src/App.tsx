import { useState, useEffect } from 'react'
import { Settings, MessageSquarePlus, BrainCircuit, Activity, User, Play, Square, Download, X, Eye } from 'lucide-react'
import { useStore } from './store/useStore'
import { SettingsModal } from './components/SettingsModal'

function App() {
  const { 
    agents, topic, sessionStatus, startSession, stopSession, messages, currentTurn, processNextTurn, finalConclusion, sessionMode, sessionError, clearSessionError
  } = useStore()

  const sessionModeLabel = sessionMode === 'conversation' ? 'Conversation モード' : 'Meeting モード'
  const sessionModeDescription = sessionMode === 'conversation'
    ? '2名が交互に意見を返し合う対話向け'
    : '挙手と進行役を使う多人数の会議向け'
  const sessionModePanelClass = sessionMode === 'conversation'
    ? 'border-cyan-500/20 bg-cyan-500/10'
    : 'border-amber-500/20 bg-amber-500/10'
  const sessionModeLabelClass = sessionMode === 'conversation' ? 'text-cyan-400' : 'text-amber-400'

  const [localTopic, setLocalTopic] = useState(topic)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [summaryModal, setSummaryModal] = useState<{ agentName: string; content: string } | null>(null)

  // 議論ループの制御
  useEffect(() => {
    if (sessionStatus === 'running') {
      processNextTurn();
    }
  }, [sessionStatus, currentTurn, processNextTurn]);

  const handleStart = () => {
    if (!localTopic.trim()) return;
    startSession(localTopic);
  }

  // MDファイルのダウンロード
  const handleDownloadMd = () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    
    let md = `# Turtle Brain 議論レポート\n\n`;
    md += `**テーマ:** ${topic}\n`;
    md += `**日時:** ${dateStr}\n`;
    md += `**参加エージェント:** ${agents.map(a => `${a.name}（${a.stance}）`).join('、')}\n\n`;
    md += `---\n\n`;

    // 各エージェントの発言
    md += `## 議論内容\n\n`;
    agents.forEach(agent => {
      const agentMsgs = messages.filter(m => m.agentId === agent.id);
      md += `### ${agent.name}（${agent.stance}・${agent.personality}）\n\n`;
      agentMsgs.forEach((msg, idx) => {
        md += `#### ${idx + 1}回目の発言\n\n`;
        md += `${msg.content}\n\n`;
      });
    });

    // 時系列の対話ログ
    md += `---\n\n## 対話ログ（時系列）\n\n`;
    messages.forEach((msg, idx) => {
      const ag = agents.find(a => a.id === msg.agentId);
      md += `**${idx + 1}. ${ag?.name || 'Unknown'}:**\n`;
      md += `${msg.content}\n\n`;
    });

    // 最終結論
    if (finalConclusion && finalConclusion !== '生成中...') {
      md += `---\n\n## 最終結論\n\n`;
      md += `${finalConclusion}\n`;
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `turtle-brain-${dateStr}-${topic.substring(0, 20)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen w-full flex bg-slate-900 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] overflow-hidden">
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
      {/* サマリーモーダル */}
      {summaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSummaryModal(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-lg font-bold text-cyan-400">{summaryModal.agentName} の最新の主張</h3>
              <button onClick={() => setSummaryModal(null)} className="p-1 hover:bg-slate-700 rounded-lg transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto max-h-[60vh]">
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{summaryModal.content}</p>
            </div>
          </div>
        </div>
      )}

      {/* --------------------
          Sidebar (左カラム)
          -------------------- */}
      <aside className="w-80 glass-panel border-r border-slate-700/50 flex flex-col z-20 shrink-0">
        <div className="p-6 border-b border-slate-700/50 flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 rounded-lg text-cyan-400">
            <BrainCircuit size={28} />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Turtle Brain
          </h1>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-6">
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Actions
            </h2>
            <button 
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium transition-all shadow-lg shadow-cyan-500/20"
            >
              <MessageSquarePlus size={18} />
              新規セッション
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-700/50 hover:bg-slate-800 text-slate-300 font-medium transition-all"
            >
              <Settings size={18} />
              設定・エージェント管理
            </button>
          </div>

          <div className="space-y-4">
            <div className={`rounded-xl border p-3 ${sessionModePanelClass}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${sessionModeLabelClass}`}>Session Mode</p>
              <p className="mt-2 text-sm font-medium text-slate-200">{sessionModeLabel}</p>
              <p className="mt-1 text-xs text-slate-400">{sessionModeDescription}</p>
            </div>

            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              参加エージェント ({agents.length}名)
            </h2>
            <div className="space-y-2">
              {agents.map(a => (
                <div key={a.id} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className="flex items-start gap-2">
                    <User size={16} className={a.role === 'Facilitator' ? 'text-amber-400' : 'text-cyan-400'} />
                    <div>
                      <p className="text-sm font-medium text-slate-200">{a.name}</p>
                      <p className="text-xs text-slate-500">{a.role}</p>
                      <p className="mt-1 text-xs text-slate-400">スタンス: {a.stance}</p>
                      <p className="mt-1 text-xs text-slate-400">性格: {a.personality}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>


      {/* --------------------
          Main Area (右部メイン)
          -------------------- */}
      <main className="flex-1 flex flex-col h-full relative z-0 min-w-0">
        
        {/* 背景のグロー効果 */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

        {/* トップヘッダー: テーマ入力＆コントロール */}
        <header className="px-8 py-6 glass-panel border-b border-slate-700/50 relative z-10 shrink-0">
          <div className="max-w-6xl mx-auto flex gap-4 items-center">
            <input 
              type="text" 
              value={localTopic}
              onChange={(e) => setLocalTopic(e.target.value)}
              disabled={sessionStatus === 'running'}
              placeholder="話し合うテーマを入力してください（例: ソフトウェア開発におけるAIの役割）"
              className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-6 py-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all font-medium text-lg shadow-inner disabled:opacity-50"
            />
            {sessionStatus !== 'running' ? (
              <button 
                onClick={handleStart}
                disabled={!localTopic.trim()}
                className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2 shrink-0"
              >
                <Play size={20} fill="currentColor" />
                議論開始
              </button>
            ) : (
              <button 
                onClick={stopSession}
                className="px-8 py-4 bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 font-bold rounded-xl transition-all flex items-center gap-2 shrink-0"
              >
                <Square size={20} fill="currentColor" />
                停止
              </button>
            )}
          </div>
          {sessionError && (
            <div className="max-w-6xl mx-auto mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-start justify-between gap-4">
              <p>{sessionError}</p>
              <button
                onClick={clearSessionError}
                className="shrink-0 rounded-lg border border-red-400/20 px-3 py-1 text-xs font-medium text-red-200 hover:bg-red-500/10"
              >
                閉じる
              </button>
            </div>
          )}
        </header>

        {/* ダッシュボード領域：エージェントごとのカラム */}
        <div className="flex-1 p-6 overflow-hidden relative z-10 flex flex-col gap-6">
          {sessionStatus === 'idle' && messages.length === 0 ? (
            <div className="flex-1 w-full flex items-center justify-center border-2 border-dashed border-slate-700/50 rounded-2xl bg-slate-800/30 backdrop-blur-sm">
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                  <BrainCircuit size={32} />
                </div>
                <div>
                  <p className="text-xl font-medium text-slate-300">テーマを入力して議論を開始しましょう</p>
                  <p className="text-slate-500 mt-2">参加予定のエージェント: {agents.length}名</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex gap-4 pb-2 overflow-x-auto overflow-y-hidden">
              {agents.map(agent => {
                const isFacilitator = agent.role === 'Facilitator';
                const accentColor = isFacilitator ? 'amber' : 'cyan';
                const agentMessages = messages.filter(m => m.agentId === agent.id);
                const latestMsg = agentMessages.length > 0 ? agentMessages[agentMessages.length - 1] : null;
                return (
                <div key={agent.id} className={`flex-1 min-w-[280px] max-w-[400px] h-full flex flex-col glass-panel rounded-2xl overflow-hidden shrink-0 ${
                  isFacilitator ? 'border border-amber-500/30' : ''
                }`}>
                  
                  {/* エージェントヘッダー */}
                  <div className={`p-4 border-b border-slate-700/50 ${
                    isFacilitator ? 'bg-amber-900/20' : 'bg-slate-800/80'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          agent.role === 'Facilitator' ? 'bg-amber-500/20 text-amber-400' : 'bg-cyan-500/20 text-cyan-400'
                        }`}>
                          <User size={16} />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-200 leading-tight">{agent.name}</h3>
                          <span className="text-sm text-slate-400">{agent.role}</span>
                        </div>
                      </div>
                      
                      {/* ステータスインジケーター */}
                      {sessionStatus === 'running' && (
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-700/50 text-sm font-medium text-slate-300 border border-slate-600/50`}>
                          <Activity size={12} className={
                            agent.status === 'thinking' ? `text-${accentColor}-400 animate-pulse` :
                            agent.status === 'raising_hand' ? 'text-yellow-400 animate-pulse' :
                            'text-slate-500'
                          } />
                          {agent.status === 'thinking' ? '思考中...' :
                           agent.status === 'raising_hand' ? '挙手判定...' :
                           '待機中'}
                        </div>
                      )}
                    </div>
                    
                    {/* プロパティ（スタンス・性格等） */}
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2.5 py-1.5 rounded bg-slate-900/50 border border-slate-700/50 text-xs font-medium text-slate-300">
                        {agent.stance}
                      </span>
                      <span className="px-2.5 py-1.5 rounded bg-slate-900/50 border border-slate-700/50 text-xs font-medium text-slate-300">
                        {agent.personality}
                      </span>
                      {agent.speakCount > 0 && (
                        <span className="px-2.5 py-1.5 rounded bg-cyan-900/30 border border-cyan-700/50 text-xs font-medium text-cyan-300">
                          発言: {agent.speakCount}回
                        </span>
                      )}
                    </div>

                    {/* 挙手強度バー */}
                    <div className="mt-3 h-11">
                      <div className={`h-full rounded-lg border border-slate-700/40 bg-slate-900/20 px-3 py-2 transition-opacity ${sessionStatus === 'running' ? 'opacity-100' : 'opacity-55'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-400">挙手強度</span>
                          <span className="text-xs text-slate-300 font-mono">{sessionStatus === 'running' ? agent.handRaiseIntensity : '--'}</span>
                        </div>
                        <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              agent.handRaiseIntensity > 70 ? `bg-${accentColor}-400` :
                              agent.handRaiseIntensity > 40 ? `bg-${accentColor}-500/70` :
                              'bg-slate-500'
                            }`}
                            style={{ width: sessionStatus === 'running' ? `${agent.handRaiseIntensity}%` : '0%' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 議論サマリー（クリックでモーダル表示） */}
                  <button
                    onClick={() => latestMsg && setSummaryModal({ agentName: agent.name, content: latestMsg.content })}
                    disabled={!latestMsg}
                    className="w-full h-24 text-left px-4 py-3 bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border-b border-slate-700/50 hover:from-cyan-900/30 hover:to-blue-900/30 transition-colors group disabled:cursor-default disabled:hover:from-cyan-900/20 disabled:hover:to-blue-900/20"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">現在の主張</p>
                      <Eye size={14} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
                    </div>
                    <p className="text-sm text-slate-200 leading-6 line-clamp-2">
                      {latestMsg ? latestMsg.summary : 'まだ発言はありません。議論が始まるとここに現在の主張が表示されます。'}
                    </p>
                  </button>

                  {/* チャットログエリア */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {agentMessages.map((msg, idx) => (
                      <div key={msg.id} className={`border rounded-xl p-3 ${
                        isFacilitator 
                          ? 'bg-amber-900/10 border-amber-700/30' 
                          : 'bg-slate-700/30 border-slate-600/30'
                      }`}>
                        <p className={`text-xs mb-2 font-medium ${
                          isFacilitator ? 'text-amber-500' : 'text-slate-500'
                        }`}>
                          {isFacilitator ? '介入' : `${idx + 1}回目の発言`}
                        </p>
                        <p className="text-base text-slate-200 leading-7 whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      </div>
                    ))}
                    {/* 思考中・挙手判定中の演出 */}
                    {(agent.status === 'thinking' || agent.status === 'raising_hand') && (
                      <div className="flex gap-1 items-center px-4 py-3 opacity-50">
                        <div className={`w-2 h-2 rounded-full bg-${accentColor}-400 animate-bounce`} />
                        <div className={`w-2 h-2 rounded-full bg-${accentColor}-400 animate-bounce delay-75`} />
                        <div className={`w-2 h-2 rounded-full bg-${accentColor}-400 animate-bounce delay-150`} />
                      </div>
                    )}
                  </div>
                </div>
              );
              })}
            </div>
          )}

          {/* 最終結論エリア */}
          {finalConclusion && (
            <div className="shrink-0 p-6 glass-panel rounded-2xl border-t-4 border-cyan-500 bg-slate-800/80 mb-2 max-h-96 overflow-y-auto w-full shadow-2xl shadow-cyan-900/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
                  <BrainCircuit size={24} />
                  最終結論
                </h3>
                {finalConclusion !== '生成中...' && (
                  <button
                    onClick={handleDownloadMd}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 text-sm font-medium transition-colors"
                  >
                    <Download size={16} />
                    MDダウンロード
                  </button>
                )}
              </div>
              <div className="text-slate-200 whitespace-pre-wrap text-sm leading-relaxed">
                {finalConclusion}
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}

export default App

