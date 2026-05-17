# Turtle Brain 実装計画書 All版

更新日: 2026-05-16

統合対象日:

- 2026-03-13
- 2026-05-16
- 2026-05-17

## 1. この統合版の目的

この文書は、2026-03-13 時点の既存実装計画を前段に保持しつつ、2026-05-16 時点で追加した議論収束基盤・構造化結論・Autonomous 最小実装の仕様を後段へ統合したものです。

意図は次の 3 点です。

- 0313 時点で整理した到達点と課題を失わない
- 0516 で追加した仕様を単独メモではなく実装計画へ接続する
- 今後はこのファイルを、実装順序と判断基準の一次ソースとして扱えるようにする

---

## Part I. 2026-03-13 時点の実装計画

このパートは、旧 2026-03-13 単体計画書の内容を、前段の基礎計画として残したものです。文意は維持しつつ、この統合版の中へ再配置しています。

## 2. 2026-03-13 時点の目的

本計画書は、現時点の Turtle Brain の到達点、未実装機能、改善課題、今後の実装順序を整理するためのドキュメントです。

特に以下を明確にします。

- いま何が動いているか
- 何が未実装か
- 何を先に安定化すべきか
- Autonomous モードをどう段階的に実装するか
- UX / 会議サマリ / 内部状態可視化をどう改善するか

## 3. 2026-03-13 時点の到達点

### 3.1 実装済みの主要機能

- React + Vite フロントエンドと Express + TypeScript バックエンドの基本構成
- 複数エージェント設定 UI
- エージェント個別リセット、全体リセット
- 実行モードとディスカッションスタイルの分離
  - Orchestration モード
  - Autonomous モードは未実装表示のみ
  - Conversation スタイル
  - Meeting スタイル
- 各エージェントの semi-resident sessionId 継続
- サーバ側オーケストレータによるターン制御
- Meeting 開始時のファシリテーター初手発言
- 内部状態パネル
  - dispatch reason
  - facilitator reasoning
  - score worker / moderation worker / speech worker
  - session / mailbox 情報
- Markdown ダウンロード
  - 総括
  - 各エージェントの発言ダイジェスト
  - 各エージェントの詳細発言
  - 時系列ログ

### 3.2 2026-03-13 時点の中心ファイル

- [../src/App.tsx](../src/App.tsx)
- [../src/store/useStore.ts](../src/store/useStore.ts)
- [../src/components/SettingsModal.tsx](../src/components/SettingsModal.tsx)
- [../src/config/modeMetadata.ts](../src/config/modeMetadata.ts)
- [../server/index.ts](../server/index.ts)
- [../server/orchestrator.ts](../server/orchestrator.ts)

## 4. 2026-03-13 時点の課題整理

### 4.1 プロダクト設計上の未完了項目

- Autonomous モードが UI 表示のみで、実処理が未実装
- 実行モードごとの責務定義がまだ仕様書レベルでは固まっていない
- Conversation スタイルと Meeting スタイルの差分が主に orchestration 側に埋め込まれている
- サマリ生成が自由文ベースで、構造化 JSON ではないため表示安定性に限界がある

### 4.2 UX 上の改善余地

- 発言参照リンクはヒューリスティックであり、誤検出・取りこぼしがある
- カラム UI の情報量が増えてきており、密度管理が必要
- 内部状態パネルは可視化されたが、初心者にはまだ読み解きづらい
- 最終結論の重要度と補足の区別が弱い

### 4.3 技術的負債・安定性課題

- backend 起動周りは安定化余地あり
  - コンテキスト上では `npm run dev` / `npm --prefix server run dev` / `npx ts-node index.ts` が失敗した履歴がある
- orchestrator の状態はサーバメモリ上のみで、再起動に弱い
- structured summary / structured debug の schema が未確立
- 自動テストが十分ではない

## 5. 2026-03-13 時点の実装方針

今後は以下の優先順位で進める。

1. 安定化
2. 仕様の明文化
3. Autonomous モードの最小実装
4. サマリと議事録の構造化
5. 詳細可視化と分析機能の強化

理由:

- まず基盤が不安定な状態で Autonomous を足すとデバッグ不能になる
- 次に UI をいくら磨いても、出力構造が曖昧だと限界がある
- そのため、先に安定化と構造化を進め、その上で新モードを追加する

## 6. 2026-03-13 時点のフェーズ別計画

### Phase 0: 仕様固定と現状安定化

目的:

- 今の Orchestration モードを壊さずに土台を固める

作業項目:

- 実行モードとディスカッションスタイルの責務を仕様化
- backend 起動手順の再整理
- `npm run dev` と server 単体起動の失敗原因を再確認
- 主要 API の入出力型をドキュメント化
- `RunTurnRequest` / `RunTurnResponse` の明文化

完了条件:

- 開発者がモード概念を誤解しない
- 起動手順が README と実際の挙動で一致する
- Orchestration モードで build と基本動作確認が安定する

対象候補:

- [../README.md](../README.md)
- [../server/index.ts](../server/index.ts)
- [../server/orchestrator.ts](../server/orchestrator.ts)
- [../src/store/useStore.ts](../src/store/useStore.ts)

### Phase 1: Orchestration モード改善

目的:

- 現行モードの体験品質を上げる

作業項目:

- 参照リンク検出の改善
- 発話順可視化の改善
- 内部状態パネルの用語整理
- 発言強度の意味説明追加
- Message 単位の metadata 拡張
  - global turn index
  - local turn index
  - kind
  - references

完了条件:

- 発言の前後関係が UI 上で追いやすい
- ファシリテーター発言と参加者発言の差が明確
- 内部状態が初心者にも解釈しやすい

対象候補:

- [../src/App.tsx](../src/App.tsx)
- [../src/store/useStore.ts](../src/store/useStore.ts)
- [../server/orchestrator.ts](../server/orchestrator.ts)

### Phase 2: 議事録・サマリ構造化

目的:

- Markdown 出力と最終結論表示を安定させる

作業項目:

- 最終結論を自由文ではなく JSON 形式で返すように変更
- summary schema を定義
  - overview
  - commonGrounds
  - openIssues
  - actionItems
- 各エージェントの digest も生成ルールを改善
  - 単純切り出しから構造化要約へ移行
- Markdown exporter を schema ベースに再構築

完了条件:

- 「途中で切れたダイジェスト」がなくなる
- 最終結論の表示崩れがなくなる
- Markdown がそのまま議事録として読める品質になる

対象候補:

- [../server/orchestrator.ts](../server/orchestrator.ts)
- [../src/App.tsx](../src/App.tsx)

### Phase 3: Autonomous モード最小実装

目的:

- UI 上だけ存在している Autonomous モードを最小限動かす

最小仕様:

- ファシリテーターまたは中央オーケストレータの介入を減らす
- 各エージェントが前回までの会話と inbox をもとに自律判断する
- 停止条件を明示的に持つ
  - 規定ターン到達
  - 収束判定
  - 無限ループ防止ガード

作業項目:

- executionMode に応じたサーバ分岐を追加
- Autonomous runner を追加
- 自律会話の終了条件設計
- 安全策の実装
  - 最大ターン
  - 最大連続自己参照
  - 空応答・重複応答ガード

完了条件:

- Autonomous × Conversation が動作する
- 少なくとも UI 上で mode 切替の意味が実装に反映される

対象候補:

- [../server/index.ts](../server/index.ts)
- [../server/orchestrator.ts](../server/orchestrator.ts)
- [../src/store/useStore.ts](../src/store/useStore.ts)
- [../src/components/SettingsModal.tsx](../src/components/SettingsModal.tsx)

### Phase 4: Autonomous × Meeting

目的:

- 複数エージェントの完全自律会議を成立させる

作業項目:

- facilitator 依存を減らした自律会議進行の設計
- エージェント間の role negotiation
- 合意形成・収束判定の追加
- 議論発散時の制御
- worker / mailbox の扱いを Autonomous 前提で見直し

完了条件:

- Autonomous × Meeting が破綻せず一定ターン継続する
- 収束または停止の理由が UI に表示される

注意:

- このフェーズは最もリスクが高い
- Phase 0〜3 完了前に手をつけない

### Phase 5: 永続化と再開機能

目的:

- セッション再開と履歴管理を可能にする

作業項目:

- サーバメモリ外へのセッション保存
- セッション一覧
- 再開 UI
- 議事録再表示

候補実装:

- file-based persistence
- SQLite

完了条件:

- サーバ再起動後も会議履歴を参照できる
- 少なくとも最終結論とログが復元できる

### Phase 6: テストと運用整備

目的:

- 継続改修に耐える状態へ持っていく

作業項目:

- orchestrator の単体テスト追加
- summary parser / exporter のテスト追加
- UI の主要表示ロジックのテスト追加
- エラー時のフォールバック動作確認
- 開発用デバッグ手順書の作成

完了条件:

- 主要ロジックがテストで守られる
- 次回改修時のデグレが減る

## 7. 2026-03-13 時点の優先度付きバックログ

### 最優先

- Autonomous モード仕様の明文化
- backend 起動安定化
- summary の構造化

### 高優先

- 発言参照リンクの精度改善
- 内部状態パネルの読みやすさ改善
- Markdown 出力の議事録品質向上

### 中優先

- セッション永続化
- Autonomous × Meeting
- JSON schema ベースの UI 表示

### 低優先

- 高度な分析ダッシュボード
- 発言クラスタリング
- モード別のテーマテンプレート

## 8. 2026-03-13 時点の再開順

外出後に再開するなら、以下の順が最も安全です。

1. Phase 0 の仕様固定
2. server 起動失敗の整理
3. summary の JSON 化
4. Autonomous × Conversation の最小実装

## 9. 2026-03-13 時点の引き継ぎメモ

次回はまず以下を確認する。

- [../src/store/useStore.ts](../src/store/useStore.ts) の `executionMode` / `discussionStyle`
- [../server/orchestrator.ts](../server/orchestrator.ts) の `runConversationTurn` / `runMeetingTurn` / `finalizeSession`
- [../src/App.tsx](../src/App.tsx) の内部状態パネルと Markdown 出力
- 現在 Autonomous モードは UI 表示のみで、サーバ分岐は未実装

## 10. 2026-03-13 時点の補足メモ

- いまのプロダクトは「擬似マルチエージェント」ではなく、すでに server-side orchestration まで進んでいる
- ただし完全自律モードはまだ本体未実装で、次の大きな節目になる
- 今後の改善は UI 微修正よりも、構造化出力とモード別アーキテクチャの分離が重要

---

## Part II. 2026-05-16 追加仕様: 議論収束基盤・構造化結論・Autonomous 最小実装

## 11. 2026-05-16 追加仕様の目的

この追加仕様は、Turtle Brain を単なる「複数AIが会話するアプリ」から、**複数AIが論点・反証・根拠不足・合意状態を管理しながら、結論へ収束するアプリ** に進化させるためのものです。

今回の主目的は次の 5 点です。

1. 現状どのような仕組みで動いているかを再整理する
2. 現状の弱点を、議論品質の観点で明文化する
3. 今後追加すべき仕様を型と責務で定義する
4. 実装順序を安全に再構成する
5. Cloud Agent / Copilot Agent に渡せる実装指示を整備する

## 12. 現状の仕組みの再整理

### 12.1 全体構成

Turtle Brain は、React + Vite のフロントエンドと Express + TypeScript のバックエンドで構成されます。

現在の基本フローは次のとおりです。

```text
ユーザーが議論開始
  ↓
src/store/useStore.ts が /api/orchestrator/run-turn へ POST
  ↓
server/index.ts が MeetingOrchestrator.runTurn(payload) を呼ぶ
  ↓
server/orchestrator.ts が session を取得または作成
  ↓
discussionStyle に応じて Conversation / Meeting を実行
  ↓
各エージェントの CLI に prompt を渡す
  ↓
返答を messages に記録
  ↓
Debug snapshot を生成してフロントへ返す
  ↓
ターン上限到達時に finalConclusion を生成
```

### 12.2 Conversation スタイル

Conversation スタイルでは、基本的に 2 人のエージェントが交互に発話します。

現在の特徴:

- 直前の発話者と異なる参加者を選ぶ
- 各エージェントの CLI sessionId を継続できる
- 相手の直近発言、最近の会話、自分の過去発言、inbox を prompt に入れる
- 2〜4 文程度の自然な返答を促す
- 挙手やファシリテーター判定は使わない

現状の Conversation は、自然な掛け合いとしては成立しています。ただし、「答えが十分に妥当になったか」「もう結論に進むべきか」は判断していません。

### 12.3 Meeting スタイル

Meeting スタイルでは、ファシリテーターと参加者が存在し、より会議形式で進みます。

現在の特徴:

- 初回はファシリテーターが論点整理を行う
- 2 回目以降はファシリテーターまたはスコアリングにより発話者を選ぶ
- `handRaiseMode` により AI評価またはルールベース評価を使う
- 複数話者を同時に選ぶこともできる
- Debug に facilitator 判断、発話スコア、worker 実行時間、agent session 情報を返す

Meeting は「会議を回す」機能としては成立しています。ただし現状の話者選定は、発言回数の公平性、スコア、ファシリテーター指名が中心であり、「未解決論点を解消するために誰を呼ぶべきか」までは十分に管理していません。

### 12.4 最終結論生成

現在は、ターン上限に到達すると、合成能力が高いエージェントを選び、直近ログをもとに最終結論を生成します。

現在の最終結論は自由文であり、プロンプト上は以下の 5 セクションを出すよう指示しています。

1. 結論サマリー
2. 詳細な解説
3. 共通認識
4. 残課題
5. 次のアクション

フロントエンドは、この自由文を正規表現で見出し分割して表示しています。この方式はシンプルですが、AI 出力の揺れに弱く、番号、見出し、Markdown 装飾、コロン、改行が少し変わるだけで UI 表示が崩れる可能性があります。

### 12.5 Diagnostics / Debug

現在の Diagnostics では、以下を確認できます。

- オーケストレーション sessionId
- 各エージェントの CLI sessionId
- 最新ディスパッチ理由
- ファシリテーター判断
- 発話スコア
- worker 実行時間
- mailbox 状態
- 最新ログ

これは良い土台です。今後はここに、議論状態、未解決論点、根拠不足、収束判定、最終結論の信頼度を追加します。

## 13. 2026-05-16 時点の主要課題

### 13.1 Autonomous モードが未実装

UI 上は Autonomous モードが存在しますが、現在は disabled であり、実処理は存在しません。

ただし、すぐに完全な Autonomous Meeting を作るべきではありません。先に、議論状態、構造化結論、収束判定を入れないと、Autonomous は単なる「AIが勝手に話し続けるモード」になりやすいです。

### 13.2 executionMode がバックエンド契約に入っていない

フロント側には `executionMode` の概念があります。しかし、現状の `/api/orchestrator/run-turn` payload では `executionMode` 自体をバックエンドに送っていません。

そのため、バックエンドは `discussionStyle` の `conversation | meeting` でしか分岐できません。まずは `executionMode` を `RunTurnRequest` に追加し、サーバ側で認識できるようにする必要があります。

### 13.3 議論状態モデルがない

現在は `messages` と `log` はありますが、以下を構造的に持っていません。

- 現在の論点
- 主張一覧
- 反対意見
- 未解決事項
- 根拠不足
- 合意レベル
- 収束状態
- 次に検証すべき論点

このため、「会話が続いた」ことは分かっても、「答えが改善した」ことを測りにくい状態です。

### 13.4 終了条件が固定ターン中心

現在の終了条件は、基本的に `turnLimit × agent数` に依存しています。これは安全ですが、以下の問題があります。

- 早く結論に到達しても無駄に会話する
- 逆に未解決論点が多くてもターン上限で終わる
- 収束理由が明示されない
- 「まだ議論すべきか」が UI で分からない

### 13.5 最終結論が自由文

自由文の最終結論は読みやすい一方、UI、Markdown export、再利用、比較、テストに弱いです。今後は JSON schema を導入し、UI は schema ベースで表示する前提に切り替えます。

## 14. 2026-05-16 時点の目標仕様

### 14.1 ゴール

- 議論中に論点状態を更新できる
- 根拠不足や反対意見を検出できる
- 固定ターンではなく収束判定で終了できる
- 最終結論を構造化 JSON として安定表示できる
- Autonomous × Conversation の最小実装が動く
- 既存 Orchestration Conversation / Meeting を壊さない

### 14.2 非ゴール

- Autonomous × Meeting の完全実装
- エージェント同士の完全な自由交渉
- UI 全面刷新
- 永続化の本格実装
- LLM 出力の完全保証
- 複雑な RAG や外部検索統合

## 15. 用語定義

### 15.1 executionMode

実行主体・制御方法を表します。

```ts
type ExecutionMode = 'orchestration' | 'autonomous'
```

- `orchestration`: サーバ側オーケストレータが進行、話者選定、終了判定を主導する
- `autonomous`: 各エージェントが自律的に「話す / 待つ / 質問する / 批判する / 結論に進む」を判断する。ただしサーバ側の安全柵は残す

### 15.2 discussionStyle

議論の形を表します。

```ts
type DiscussionStyle = 'conversation' | 'meeting'
```

- `conversation`: 少人数の自然な対話
- `meeting`: ファシリテーター、複数参加者、スコアリングを使う会議形式

### 15.3 関係

`executionMode` と `discussionStyle` は別軸です。

```text
Orchestration × Conversation: 現在の交互会話
Orchestration × Meeting: 現在の会議モード
Autonomous × Conversation: 次に実装する最小自律モード
Autonomous × Meeting: 将来フェーズ
```

## 16. 追加するデータ仕様

### 16.1 RunTurnRequest の拡張

```ts
export type ExecutionMode = 'orchestration' | 'autonomous'

export interface RunTurnRequest {
  sessionId?: string
  topic: string
  inputPaths?: string[]
  executionMode?: ExecutionMode
  discussionStyle: DiscussionStyle
  handRaiseMode?: HandRaiseMode
  turnLimit: number
  agents: AgentProfileInput[]
}
```

ルール:

- `executionMode` 未指定時は `orchestration`
- 既存クライアント互換のため optional にする
- `autonomous` が未対応の組み合わせでは安全に fallback する

### 16.2 MeetingSession の拡張

```ts
interface MeetingSession {
  id: string
  topic: string
  inputPaths: string[]
  inputContextPrompt: string
  inputContextWarnings: string[]
  executionMode: ExecutionMode
  discussionStyle: DiscussionStyle
  handRaiseMode: HandRaiseMode
  turnLimit: number
  currentTurn: number
  status: 'idle' | 'running' | 'finished'
  agents: RuntimeAgent[]
  messages: MessageRecord[]
  finalConclusion: string | null
  finalConclusionStructured: StructuredFinalConclusion | null
  deliberationState: DeliberationState | null
  debug: OrchestratorDebugSnapshot | null
  log: OrchestratorDebugSnapshot['log']
  stopRequested: boolean
}
```

### 16.3 StructuredFinalConclusion

最終結論は、自由文ではなく構造化 JSON を正とします。

```ts
interface StructuredFinalConclusion {
  schemaVersion: 1
  title: string
  conclusionSummary: string
  finalAnswer: string
  reasoning: string[]
  supportingPoints: string[]
  counterArguments: string[]
  unresolvedIssues: string[]
  risks: string[]
  confidence: {
    score: number
    reason: string
  }
  nextActions: Array<{
    label: string
    detail: string
    priority: 'high' | 'medium' | 'low'
  }>
}
```

ルール:

- `finalConclusionStructured` が parse できたら UI はそれを優先する
- parse 失敗時のみ `finalConclusion` の自由文 fallback を使う
- 既存 `finalConclusion: string | null` は後方互換のため残す

### 16.4 DeliberationState

議論の内部状態を保持します。

```ts
type ConvergenceStatus =
  | 'exploring'
  | 'debating'
  | 'needs_verification'
  | 'ready_to_conclude'
  | 'blocked'

interface DeliberationState {
  agenda: string[]
  claims: Array<{
    id: string
    text: string
    supportLevel: 'weak' | 'medium' | 'strong'
    challengedBy: string[]
  }>
  openIssues: string[]
  disagreements: string[]
  evidenceGaps: string[]
  consensus: {
    level: number
    summary: string
  }
  convergence: {
    status: ConvergenceStatus
    reason: string
    confidence: number
    recommendedNextFocus: string | null
  }
}
```

使い方:

- 各ターン後に更新する
- Meeting prompt / Final conclusion prompt に含める
- Debug UI に要約表示する
- 話者選定や終了判定に利用する

### 16.5 ConvergenceDecision

収束判定を表します。

```ts
interface ConvergenceDecision {
  readyToConclude: boolean
  confidence: number
  reason: string
  remainingIssues: string[]
  nextFocus: string | null
}
```

終了条件:

```text
readyToConclude === true && confidence >= 70
または
currentTurn > totalTurns
または
stopRequested === true
```

### 16.6 AutonomousAction

Autonomous × Conversation で各エージェントに返させる行動です。

```ts
type AutonomousActionType =
  | 'speak'
  | 'wait'
  | 'ask'
  | 'critique'
  | 'conclude'

interface AutonomousAction {
  agentId: string
  action: AutonomousActionType
  reason: string
  message: string
  confidence: number
}
```

ルール:

- `message` は `action !== 'wait'` のとき必須
- `conclude` が複数または高信頼度で出た場合、収束判定へ進める
- 空応答、重複応答、自己ループはサーバ側で抑止する

## 17. 2026-05-16 フェーズ別実装計画

### Phase 1: executionMode を API 契約へ通す

目的:

- UI 上の実行モードをバックエンドが認識できるようにする

対象ファイル:

- [../server/orchestrator.ts](../server/orchestrator.ts)
- [../server/index.ts](../server/index.ts)
- [../src/store/useStore.ts](../src/store/useStore.ts)
- [../src/config/modeMetadata.ts](../src/config/modeMetadata.ts)
- [../src/components/SettingsModal.tsx](../src/components/SettingsModal.tsx)

作業:

1. `server/orchestrator.ts` に `ExecutionMode` を追加する
2. `RunTurnRequest` に `executionMode?: ExecutionMode` を追加する
3. `MeetingSession` に `executionMode` を追加する
4. `createSession` で `input.executionMode ?? 'orchestration'` を保存する
5. `src/store/useStore.ts` の request body に `executionMode: state.executionMode` を追加する
6. Debug または response に `executionMode` を含める
7. Autonomous はまだ有効化しなくてよい

受け入れ条件:

- 既存 Orchestration × Conversation が壊れない
- 既存 Orchestration × Meeting が壊れない
- `/api/orchestrator/run-turn` の payload に `executionMode` が含まれる
- TypeScript check が通る

### Phase 2: 構造化最終結論

目的:

- 自由文パース依存を減らし、UI と Markdown 出力を安定させる

対象ファイル:

- [../server/orchestrator.ts](../server/orchestrator.ts)
- [../src/App.tsx](../src/App.tsx)
- 必要に応じて [../src/store/useStore.ts](../src/store/useStore.ts)

作業:

1. `StructuredFinalConclusion` 型を追加する
2. `RunTurnResponse` に `finalConclusionStructured` を追加する
3. `buildFinalConclusionPromptV2` を JSON-only 出力へ変更する
4. `extractJson` で parse する
5. parse 成功時は `finalConclusionStructured` に保存する
6. parse 失敗時は従来どおり `finalConclusion` に自由文を入れる
7. UI は structured があれば structured 表示を優先する
8. 従来の `parseConclusionSections` は fallback として残す

受け入れ条件:

- 結論、根拠、反対意見、未解決事項、リスク、次アクションが安定表示される
- AI の見出し揺れで表示崩れしない
- 既存の最終結論表示 fallback が残る

### Phase 3: DeliberationState の追加

目的:

- 議論がどこまで進んだか、何が未解決かを構造的に保持する

対象ファイル:

- [../server/orchestrator.ts](../server/orchestrator.ts)
- [../src/App.tsx](../src/App.tsx)

作業:

1. `DeliberationState` 型を追加する
2. `MeetingSession` に `deliberationState` を追加する
3. `updateDeliberationState(session)` を追加する
4. 各ターン終了後に `updateDeliberationState` を呼ぶ
5. JSON parse 失敗時は前回状態を保持する
6. Debug に `deliberationState` の要約を追加する
7. UI の Diagnostics に以下を表示する
   - openIssues
   - evidenceGaps
   - disagreements
   - consensus level
   - convergence status
   - recommendedNextFocus

受け入れ条件:

- Debug で未解決論点と根拠不足が見える
- 最終結論 prompt に deliberationState が入る
- 既存ターン進行が壊れない

### Phase 4: 収束判定

目的:

- 固定ターンだけでなく、議論の状態に応じて終了できるようにする

対象ファイル:

- [../server/orchestrator.ts](../server/orchestrator.ts)

作業:

1. `evaluateConvergence(session)` を追加する
2. 各ターン後に収束判定を行う
3. `readyToConclude && confidence >= 70` なら finalize する
4. `remainingIssues` がある場合は次ターンの prompt に反映する
5. Debug に終了理由を表示する

受け入れ条件:

- ターン上限前でも結論に進める
- 終了理由が Debug に出る
- turnLimit は安全柵として残る

### Phase 5: Orchestration の話者選定を論点解消寄りにする

目的:

- 単なる公平性ではなく、「未解決論点を解消するための発話者選定」に近づける

対象ファイル:

- [../server/orchestrator.ts](../server/orchestrator.ts)

作業:

1. `ScoreDecision.desiredAction` に以下を許容する
   - `respond`
   - `question`
   - `critique`
   - `verify`
   - `synthesize`
   - `conclude`
   - `wait`
2. facilitator decision に以下を追加する
   - `unresolvedIssues`
   - `evidenceGaps`
   - `readyToConclude`
   - `recommendedNextFocus`
3. `selectSpeakers` の adjustedScore に以下を加える
   - 未解決論点に関係するエージェントを加点
   - 根拠不足を補える発言を加点
   - 同じ論点の繰り返しを減点
4. 発言回数補正は残すが、主目的にはしない

受け入れ条件:

- 批判が必要な時に critique 系の発言が出る
- 根拠不足時に verify 系の発言が出る
- 合意済み論点を無駄に繰り返しにくくなる

### Phase 6: Autonomous × Conversation 最小実装

目的:

- Autonomous モードをまず Conversation に限定して動かす

対象ファイル:

- [../server/orchestrator.ts](../server/orchestrator.ts)
- [../src/components/SettingsModal.tsx](../src/components/SettingsModal.tsx)
- [../src/config/modeMetadata.ts](../src/config/modeMetadata.ts)
- [../src/store/useStore.ts](../src/store/useStore.ts)

作業:

1. Autonomous ボタンを有効化する
2. ただし、Meeting ではまだ fallback する
3. `runAutonomousConversationTurn(session)` を追加する
4. 各エージェントに `AutonomousAction` JSON を返させる
5. サーバが action を集約して、話者または終了を決める
6. 以下の安全柵を入れる
   - 最大ターン
   - 空応答ガード
   - 重複応答ガード
   - 同一エージェント連続発話ガード
   - 同じ論点の反復ガード
7. `conclude` action が強い場合は `evaluateConvergence` を呼ぶ

受け入れ条件:

- Autonomous × Conversation が UI から選択できる
- 各エージェントが speak / wait / ask / critique / conclude を選べる
- 無限ループしない
- 既存 Orchestration に影響しない

### Phase 7: テストとスクリプト整備

目的:

- Cloud Agent や今後の改修で壊れにくくする

対象ファイル:

- [../package.json](../package.json)
- [../server/package.json](../server/package.json)
- [../server/orchestrator.ts](../server/orchestrator.ts)
- 必要に応じて test ファイル追加

作業:

1. root に以下を追加する
   - `lint:app`
   - `typecheck:app`
2. server に以下を追加する
   - `typecheck`
   - 可能なら `test`
3. JSON parse fallback のテスト
4. structured conclusion のテスト
5. convergence 判定のテスト
6. selectSpeakers の主要パターンテスト

受け入れ条件:

- `npm run build` が通る
- `npm run lint:app` が通る
- `npm --prefix server run typecheck` が通る
- テスト導入した場合はテストが通る
- input 配下など本体外の lint ノイズで失敗しない

## 18. Cloud Agent / Copilot Agent への実装指示

以下をそのまま Cloud Agent / Copilot Agent に渡してよい。

```md
# Turtle Brain 改修指示

## 目的

Turtle Brain を、単に複数AIが会話するアプリから、論点・反証・根拠不足・合意状態を管理しながら結論へ収束するアプリへ進化させる。

## 最優先

既存の Orchestration × Conversation / Orchestration × Meeting を壊さないこと。
Autonomous Meeting の完全実装は今回やらない。

## 実装順

1. executionMode を RunTurnRequest / MeetingSession / frontend payload に追加
2. finalConclusionStructured を追加し、最終結論を JSON schema 化
3. DeliberationState を追加し、各ターン後に議論状態を更新
4. convergence 判定を追加し、必要なら turnLimit 前に finalize
5. selectSpeakers を未解決論点・根拠不足・反証重視に改善
6. Autonomous × Conversation の最小実装
7. typecheck / lint / test スクリプト整備

## 追加型

ExecutionMode, StructuredFinalConclusion, DeliberationState, ConvergenceDecision, AutonomousAction を追加する。

## 後方互換

- finalConclusion: string | null は残す
- structured parse 失敗時は従来表示へ fallback
- executionMode 未指定時は orchestration
- Autonomous × Meeting は現時点では Orchestration Meeting へ fallback

## UI

- Diagnostics に executionMode, deliberationState, convergence を表示
- 最終結論は structured があれば structured 表示を優先
- 従来の parseConclusionSections は fallback として残す

## 完了条件

- 既存モードが壊れない
- structured conclusion が表示される
- Debug で openIssues / evidenceGaps / convergence が確認できる
- Autonomous × Conversation が選択・実行できる
- build / typecheck / lint が通る
```

## 19. 実装時の注意点

### 19.1 既存挙動を壊さない

今回の改修は中核に触るため、まず後方互換を優先する。

- 既存 `finalConclusion` は削除しない
- 既存 `discussionStyle` 分岐は維持する
- Autonomous は段階的に有効化する
- parse 失敗時は落とさず fallback する

### 19.2 LLM JSON は必ず壊れる前提で扱う

AI に JSON-only を指示しても、実際には壊れることがある。

そのため:

- `extractJson` を使う
- schema validation する
- 欠損値は default を入れる
- parse 失敗時は既存状態を保持する
- UI は null を許容する

### 19.3 収束判定を強くしすぎない

初期実装では、収束判定は控えめにする。

推奨:

```text
readyToConclude === true
かつ confidence >= 70
かつ openIssues が少ない
```

また、必ず turnLimit による終了も残す。

### 19.4 Autonomous は「完全放任」にしない

Autonomous は、各エージェントに自由に話させる機能ではない。

正しい方向性:

```text
エージェントが行動を提案する
  ↓
サーバが安全柵で集約する
  ↓
議論状態を更新する
  ↓
収束判定する
```

## 20. 推奨 PR 分割

### PR 1: executionMode API 契約化

- 型追加
- payload 追加
- session 保持
- Debug 表示

### PR 2: structured final conclusion

- StructuredFinalConclusion
- JSON prompt
- parse fallback
- UI 表示

### PR 3: deliberation state

- DeliberationState
- updateDeliberationState
- Diagnostics 表示

### PR 4: convergence

- evaluateConvergence
- turnLimit 前 finalize
- 終了理由 Debug

### PR 5: speaker selection improvement

- desiredAction 拡張
- unresolved issue based scoring
- critique / verify 強化

### PR 6: autonomous conversation MVP

- Autonomous 有効化
- AutonomousAction
- runAutonomousConversationTurn
- safety guards

### PR 7: test and scripts

- lint/typecheck scripts
- server typecheck
- parser/convergence tests

## 21. 最終的な完成イメージ

完成後の Turtle Brain は、以下のように動作する。

```text
ユーザーがテーマを入力
  ↓
AI たちが議論
  ↓
Turtle Brain が論点・主張・反論・根拠不足を内部管理
  ↓
必要なら批判役や検証役を呼ぶ
  ↓
合意度と未解決事項を見ながら収束判定
  ↓
十分なら turnLimit 前でも結論生成
  ↓
最終結論は JSON schema ベースで安定表示
  ↓
Markdown export も構造化された議事録になる
```

これにより、Turtle Brain は「会話ログ生成アプリ」ではなく、**AI 同士の議論を制御し、答えの品質を上げていく思考オーケストレーター** になる。

---

## Part III. 統合後の推奨ロードマップ

## 22. 統合後の最優先

0313 の安定化方針と 0516 の議論品質向上仕様を接続すると、優先度は次の順になります。

1. executionMode を API 契約へ通す
2. structured final conclusion を導入する
3. deliberationState を導入する
4. convergence 判定を導入する
5. speaker selection を論点解消寄りへ改善する
6. Autonomous × Conversation MVP を実装する
7. その後に永続化、Autonomous × Meeting、分析強化へ進む

## 23. 0313 計画との接続

- 旧 Phase 0 の「仕様固定と現状安定化」は、0516 の Phase 1 を先頭に据えることで具体化される
- 旧 Phase 2 の「議事録・サマリ構造化」は、0516 の Phase 2 で schema と fallback を持つ形に強化される
- 旧 Phase 3 の「Autonomous モード最小実装」は、0516 の Phase 6 によって安全柵付き MVP として具体化される
- 旧 Phase 4 の「Autonomous × Meeting」は、deliberationState と convergence が入った後ろへ送るのが妥当
- 旧 Phase 5 の「永続化と再開機能」は、会話品質の基盤整備後でも順序を落としすぎないようにする
- 旧 Phase 6 の「テストと運用整備」は、0516 の Phase 7 で先行着手し、以後継続的に広げる

## 24. 次回着手順

今後このリポジトリで再開する際は、以下の順で進めるのが安全です。

1. [../src/store/useStore.ts](../src/store/useStore.ts) と [../server/orchestrator.ts](../server/orchestrator.ts) に `executionMode` を通す
2. [../server/orchestrator.ts](../server/orchestrator.ts) の最終結論生成を JSON schema 化する
3. [../src/App.tsx](../src/App.tsx) の結論表示を structured 優先 + fallback 維持へ切り替える
4. DeliberationState と convergence を Diagnostics に反映する
5. Autonomous × Conversation MVP を安全柵付きで有効化する

## 25. 運用メモ

- 今後は 0313 単独文書ではなく、この `implementation-plan-all.md` を最新の統合計画として参照する
- 2026-05-16 の仕様追加は、0313 の課題を上書きするものではなく、具体的な実装順へ落とし込む補強として扱う
- 2026-05-16 単体仕様書の内容は、この統合版と `orchestration-autonomous-guide.md` に統合済みとする
---

## Part IV. 2026-05-17 追加仕様: 視点ロール簡易設定

## 26. 目的

スタンス・性格の詳細設定は維持しつつ、ユーザーが会社組織上の代表的な立場を選ぶだけで、多角的な会話を開始できるようにする。

従来は「どのスタンスと性格を組み合わせれば公平な議論になるか」をユーザーが設計する必要があった。2026-05-17 追加仕様では、まず「視点ロール」を選び、必要な場合だけスタンス・性格・重視観点を細かく編集する二段構えにする。

## 27. 視点ロール標準プリセット

標準プリセットは次の 10 個とする。職種や役職を過度に細分化せず、会社組織でよく必要になる大きな視点として扱う。

| ID | 表示名 | 主に見るもの |
|---|---|---|
| `executive-business` | 経営・事業責任 | 事業価値、投資対効果、優先順位、長期リスク |
| `operations` | 現場・業務運用 | 現場負荷、業務手順、継続運用、例外対応 |
| `project-management` | プロジェクト推進 | 計画、依存関係、体制、進捗管理 |
| `customer-user` | 顧客・利用者 | 顧客価値、使いやすさ、受容性、困りごと |
| `sales-market` | 営業・市場 | 市場性、提案価値、競合差別化、説明容易性 |
| `technical-practice` | 技術・専門実務 | 実現可能性、品質、保守性、技術負債 |
| `finance-accounting` | 財務・経理 | 予算、採算、費用対効果、会計影響 |
| `people-organization` | 人事・組織 | 人員、教育、評価、組織影響 |
| `legal-compliance-ip` | 法務・コンプライアンス・知財 | 契約、規制、責任範囲、知財 |
| `security-risk` | セキュリティ・リスク管理 | 情報管理、監査、事故対応、BCP |

## 28. UI 仕様

- エージェント設定に `視点ロール` を追加する
- 視点ロールを選ぶと、そのロールの説明、見る観点、標準スタンス、標準性格、重視する観点、避ける振る舞いを適用する
- 標準プリセット自体は固定する
- ユーザーはエージェント単位で `重視する観点` と `避ける振る舞い` を編集できる
- 既存の `スタンス` と `性格` は詳細設定として残す
- ロール未指定の場合は、特定部門に寄せない標準的な参加者として扱う

## 29. プロンプト仕様

各エージェントのプロンプトへ次を追加する。

- Viewpoint role
- Primary viewpoint focus
- Avoid over-biasing toward

会話中の他エージェントについては、明示的に設定された視点ロールと実際の発言のみを参照する。隠れた職種・部門・人格を推測しない。

最終結論生成では、エージェント一覧と視点ロールを渡し、主要な懸念・推奨アクション・未解決論点を視点差分が分かる形で整理する。

## 30. 実装計画

1. `AgentProfile` / `AgentProfileInput` に `viewpointRoleId`, `viewpointFocus`, `viewpointAvoid` を追加する
2. 標準プリセットを `agentMetadata.ts` に定義する
3. 保存済み設定の後方互換のため、旧エージェントには空の視点ロールを補完する
4. 設定画面に視点ロール選択、説明、編集欄を追加する
5. サイドバーとエクスポート内容に視点ロールを表示する
6. Orchestration / Autonomous / Meeting / Final Conclusion のプロンプトに視点情報を渡す
7. `typecheck`, `lint`, `server test`, `build` で回帰確認する
