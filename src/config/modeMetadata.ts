import type { DiscussionStyle, ExecutionMode } from '../store/useStore'

export const EXECUTION_MODE_METADATA: Record<ExecutionMode, {
  label: string
  shortDescription: string
  longDescription: string
  badge?: string
}> = {
  orchestration: {
    label: 'Orchestration モード',
    shortDescription: '進行と選出を制御しながら安定動作させる標準モード',
    longDescription: 'Orchestration モードは現在の標準モードです。オーケストレーターが進行、選出、診断情報の集約を担当します。'
  },
  autonomous: {
    label: 'Autonomous モード',
    shortDescription: 'Conversation で各エージェントが発言・待機・質問・批判・結論を自律選択',
    longDescription: 'Autonomous モードでは、Conversation スタイルに限り各エージェントが speak / wait / ask / critique / conclude を提案し、サーバーが安全柵つきで採用します。Meeting スタイルでは現時点で Orchestration にフォールバックします。',
    badge: 'Conversation MVP'
  }
}

export const DISCUSSION_STYLE_METADATA: Record<DiscussionStyle, {
  label: string
  shortDescription: string
  longDescription: string
}> = {
  conversation: {
    label: 'Conversation スタイル',
    shortDescription: '2人で交互に聞き合いながら対話する',
    longDescription: 'Conversation スタイルでは2名が交互に応答します。挙手判定やファシリテーターは使わず、相手の発言を受けて会話を深める設定です。'
  },
  meeting: {
    label: 'Meeting スタイル',
    shortDescription: '挙手・進行役・性格差が効く会議向け',
    longDescription: 'Meeting スタイルでは複数エージェントが会議形式で議論します。挙手判定、進行役、スタンスや性格による振る舞いの違いを活かす設定です。'
  }
}
