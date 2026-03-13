import { create } from 'zustand';

// エージェントの役割
export type AgentRole = 'Participant' | 'Facilitator';

// エージェントのデータ構造
export interface AgentProfile {
  id: string;
  name: string;
  role: AgentRole;
  stance: string;        // 例: 建設的、批判的
  personality: string;   // 例: 声が大きい、データ重視
  model: string;         // 使用言語モデル
  // UI用の一時的なステータス状態
  status: 'idle' | 'thinking' | 'speaking' | 'raising_hand';
  handRaiseIntensity: number; // 挙手の強さ (0〜100)
  speakCount: number;         // 発言回数
}

// 1つの発言（メッセージ）のデータ
export interface Message {
  id: string;
  agentId: string;
  content: string;
  summary: string;   // この発言の要約（カラム冒頭に表示）
  timestamp: number;
}

// 全体のストア状態
interface TurtleBrainState {
  // 設定関連
  agents: AgentProfile[];
  topic: string;
  turnLimit: number;
  currentTurn: number;
  environment: 'sandbox' | 'full';
  
  // 対話・議論データ
  messages: Message[];
  sessionStatus: 'idle' | 'running' | 'finished';
  finalConclusion: string | null;

  // アクション操作
  setTopic: (topic: string) => void;
  addAgent: (agent: AgentProfile) => void;
  updateAgent: (id: string, updates: Partial<AgentProfile>) => void;
  removeAgent: (id: string) => void;
  
  startSession: (topic: string) => void;
  stopSession: () => void;
  addMessage: (message: Message) => void;
  resetSession: () => void;
  processNextTurn: () => Promise<void>;
  generateFinalConclusion: () => Promise<void>;
}

// デフォルトのエージェント
const defaultAgents: AgentProfile[] = [
  {
    id: 'agent-1',
    name: 'Agent Alpha',
    role: 'Participant',
    stance: '建設的・アイデア出し',
    personality: '前向き、協調的',
    model: 'gpt-5.4',
    status: 'idle',
    handRaiseIntensity: 0,
    speakCount: 0
  },
  {
    id: 'agent-2',
    name: 'Agent Beta',
    role: 'Participant',
    stance: '批判的・リスク分析',
    personality: '慎重、論理的',
    model: 'gpt-5.4',
    status: 'idle',
    handRaiseIntensity: 0,
    speakCount: 0
  }
];

export const useStore = create<TurtleBrainState>((set, get) => ({
  agents: defaultAgents,
  topic: '',
  turnLimit: 2, // テスト用に短く設定
  currentTurn: 0,
  environment: 'sandbox',
  
  messages: [],
  sessionStatus: 'idle',
  finalConclusion: null,

  setTopic: (topic) => set({ topic }),
  
  addAgent: (agent) => set((state) => ({ 
    agents: [...state.agents, agent] 
  })),
  
  updateAgent: (id, updates) => set((state) => ({
    agents: state.agents.map(a => a.id === id ? { ...a, ...updates } : a)
  })),
  
  removeAgent: (id) => set((state) => ({
    agents: state.agents.filter(a => a.id !== id)
  })),

  startSession: (topic: string) => set({ topic, sessionStatus: 'running', currentTurn: 1, messages: [], finalConclusion: null }),
  stopSession: () => set({ sessionStatus: 'finished' }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  resetSession: () => set({ sessionStatus: 'idle', messages: [], currentTurn: 0, finalConclusion: null }),

  processNextTurn: async () => {
    const state = get();
    if (state.sessionStatus !== 'running') return;
    
    // 規定ターン数に達したら終了
    if (state.currentTurn > state.turnLimit * state.agents.length) {
      set({ sessionStatus: 'finished' });
      // 最終結論の生成を開始する
      get().generateFinalConclusion();
      return;
    }

    // 順番に発言させる（フェーズ2の固定順序）
    const agentIndex = (state.currentTurn - 1) % state.agents.length;
    const currentAgent = state.agents[agentIndex];

    // ステータスを思考中に変更
    set((s) => ({
      agents: s.agents.map(a => a.id === currentAgent.id ? { ...a, status: 'thinking' } : a)
    }));

    try {
      // 直前の発言（相手のもの）を取得
      const lastMessage = state.messages.length > 0 ? state.messages[state.messages.length - 1] : null;
      const lastSpeaker = lastMessage ? state.agents.find(a => a.id === lastMessage.agentId) : null;

      // 履歴の構築（全発言を時系列で並べる）
      const historyText = state.messages.map(m => {
        const ag = state.agents.find(a => a.id === m.agentId);
        return `${ag?.name || 'Unknown'}: ${m.content}`;
      }).join(' --- ');

      let systemPrompt: string;

      if (state.messages.length === 0) {
        // 最初の発言者: テーマについて口火を切る
        systemPrompt = `テーマ「${state.topic}」について、${currentAgent.stance}の立場から意見を述べてください。性格は「${currentAgent.personality}」です。簡潔に2〜3文で回答してください。自己紹介は不要です。`;
      } else {
        // 2ターン目以降: 直前の発言者の内容に具体的に言及しながら応答
        systemPrompt = `テーマ「${state.topic}」について議論中です。あなたは「${currentAgent.stance}」の立場、性格は「${currentAgent.personality}」です。` +
          ` 直前に${lastSpeaker?.name || '相手'}が次のように発言しました:「${lastMessage?.content}」` +
          ` この発言に対して、あなたのスタンスに基づき、相手の意見の良い点や問題点に具体的に言及しながら自分の意見を2〜3文で述べてください。` +
          ` 相手の意見を引用・批判・同意・補足するなど、対話的に応答してください。自己紹介は不要です。` +
          (state.messages.length > 1 ? ` 参考:これまでの議論全体: ${historyText}` : '');
      }

      const res = await fetch('http://localhost:3001/api/agent/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: systemPrompt,
          model: currentAgent.model
        })
      });

      const data = await res.json();
      
      if (data.success) {
        // 発言の要約を生成（最初の50文字 + 省略）
        const summaryText = data.response.length > 60
          ? data.response.substring(0, 60) + '…'
          : data.response;

        set((s) => ({
          messages: [...s.messages, {
            id: `msg-${Date.now()}`,
            agentId: currentAgent.id,
            content: data.response,
            summary: summaryText,
            timestamp: Date.now()
          }],
          currentTurn: s.currentTurn + 1,
          agents: s.agents.map(a => a.id === currentAgent.id 
            ? { ...a, status: 'idle', speakCount: a.speakCount + 1 } 
            : a
          )
        }));
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      console.error('Agent interaction failed:', e);
      // フォールバック
      set((s) => ({
        sessionStatus: 'finished',
        agents: s.agents.map(a => a.id === currentAgent.id ? { ...a, status: 'idle' } : a)
      }));
    }
  },

  generateFinalConclusion: async () => {
    const state = get();
    set({ finalConclusion: '生成中...' });

    try {
      // 各エージェントの発言をエージェント名付きで構造化
      const agentSummaries = state.agents.map(ag => {
        const agMessages = state.messages.filter(m => m.agentId === ag.id);
        const agText = agMessages.map((m, i) => `[${i + 1}回目] ${m.content}`).join(' ');
        return `【${ag.name}（${ag.stance}）】 ${agText}`;
      }).join(' ---- ');

      const systemPrompt = `テーマ「${state.topic}」について、複数のAIエージェントが議論しました。以下の議論内容をもとに、最終結論をまとめてください。` +
        ` 重要: 全てのエージェントの意見を公平かつ十分に汲み取ること。建設的な意見だけでなく、批判的・慎重な意見も同等の重みで扱ってください。` +
        ` 以下の構造で回答してください:` +
        ` 1. 冒頭に3〜4行の「総括サマリー」を書く（テーマに対する全体的な結論を凝縮）` +
        ` 2. 「共通認識」のセクション: 双方の意見が一致している点を箇条書きで整理` +
        ` 3. 「対立軸」のセクション: 意見が分かれたポイントを明確に記述し、それぞれの立場の根拠を公平に提示` +
        ` 4. 「統合的結論」のセクション: 共通認識と対立軸を踏まえた上で、実践的な提言や推奨事項をまとめる` +
        ` 5. 各ポイントは具体的に書き、曖昧な表現は避けてください。` +
        ` ---- 議論内容 ---- ${agentSummaries}`;

      const res = await fetch('http://localhost:3001/api/agent/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: systemPrompt,
          model: 'gpt-5.4' // 結論生成は代表モデルで行う
        })
      });

      const data = await res.json();
      
      if (data.success) {
        set({ finalConclusion: data.response });
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      console.error('Failed to generate final conclusion:', e);
      set({ finalConclusion: '最終結論の生成に失敗しました。' });
    }
  }
}));
