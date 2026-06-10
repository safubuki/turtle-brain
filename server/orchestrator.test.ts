import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CliExecResult, CliRunOptions } from './cliRunner'
import { MeetingOrchestrator, type AgentProfileInput, type RunTurnRequest } from './orchestrator'

function createAgent(id: string, name: string): AgentProfileInput {
  return {
    id,
    name,
    role: 'Participant',
    stance: id === 'agent-1' ? 'アイデア出し重視' : '検証重視',
    personality: id === 'agent-1' ? '率直' : '慎重',
    viewpointRoleId: id === 'agent-1' ? 'executive-business' : 'customer-user',
    viewpointFocus: id === 'agent-1'
      ? '事業価値と意思決定の優先順位を重視する。'
      : '利用者価値と受け入れやすさを重視する。',
    viewpointAvoid: id === 'agent-1'
      ? '細部の実装論だけに寄りすぎない。'
      : '提供側の都合だけで判断しない。',
    avatarPreset: null,
    avatarCustomDataUrl: null,
    avatarCustomName: null,
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

function createBaseRequest(overrides: Partial<RunTurnRequest> = {}): RunTurnRequest {
  return {
    topic: '新機能の優先順位を決める',
    executionMode: 'orchestration',
    discussionStyle: 'conversation',
    handRaiseMode: 'rule-based',
    turnLimit: 1,
    agents: [createAgent('agent-1', 'エージェントA'), createAgent('agent-2', 'エージェントB')],
    ...overrides
  }
}

function createFakeRunner(): (options: CliRunOptions) => Promise<CliExecResult> {
  return async ({ prompt, provider }) => {
    if (prompt.includes('Update the deliberation state')) {
      return {
        response: JSON.stringify({
          agenda: ['優先順位'],
          claims: [{
            id: 'claim-1',
            text: '低リスクで価値が高い機能を優先する',
            supportLevel: 'strong',
            challengedBy: []
          }],
          openIssues: [],
          disagreements: [],
          evidenceGaps: [],
          consensus: {
            level: 86,
            summary: '価値と実装リスクのバランスで合意している'
          },
          convergence: {
            status: 'ready_to_conclude',
            reason: '主要論点が整理され、残課題がない',
            confidence: 82,
            recommendedNextFocus: null
          }
        }),
        sessionId: `meta-${provider}`,
        rateLimits: null
      }
    }

    if (prompt.includes('Use this exact schema')) {
      return {
        response: JSON.stringify({
          schemaVersion: 1,
          title: '優先順位の結論',
          conclusionSummary: '価値が高く低リスクな機能を先に進める。',
          finalAnswer: '次の実装では、価値が明確で検証負荷の低い機能を優先するのが妥当です。',
          reasoning: ['合意度が高く、残る根拠不足がないため。'],
          supportingPoints: ['実装リスクとユーザー価値の釣り合いがよい。'],
          counterArguments: [],
          unresolvedIssues: [],
          risks: ['過度に小さい改善だけに寄る可能性。'],
          confidence: {
            score: 82,
            reason: '議論状態が収束済みで残課題が少ないため。'
          },
          nextActions: [{
            label: '候補を確定',
            detail: '価値とリスクで候補機能を並べ替える。',
            priority: 'high'
          }]
        }),
        sessionId: 'synthesis-session',
        rateLimits: null
      }
    }

    if (prompt.includes('Choose your next autonomous action')) {
      return {
        response: JSON.stringify({
          agentId: 'agent-1',
          action: 'ask',
          reason: '根拠を明確にするため。',
          message: 'エージェントAとして、まず価値が高いと判断する根拠を確認したいです。',
          confidence: 78
        }),
        sessionId: 'autonomous-session',
        rateLimits: null
      }
    }

    return {
      response: 'その観点に賛成です。まず価値と実装リスクを並べて、最小の候補から検証しましょう。',
      sessionId: 'conversation-session',
      rateLimits: null
    }
  }
}

test('収束時に構造化された最終整理を返す', async () => {
  const orchestrator = new MeetingOrchestrator(createFakeRunner())
  const firstTurn = await orchestrator.runTurn(createBaseRequest())

  const finalTurn = await orchestrator.runTurn(createBaseRequest({
    sessionId: firstTurn.sessionId
  }))

  assert.equal(finalTurn.sessionStatus, 'finished')
  assert.equal(finalTurn.finalConclusionStructured?.schemaVersion, 1)
  assert.equal(finalTurn.finalConclusionStructured?.confidence.score, 82)
  assert.match(finalTurn.finalConclusion ?? '', /価値が高く低リスク/)
  assert.equal(finalTurn.debug?.convergenceDecision?.readyToConclude, true)
})

test('議論状態分析はバックグラウンド実行され、次ターンの debug に worker が引き継がれる', async () => {
  const orchestrator = new MeetingOrchestrator(createFakeRunner())
  const firstTurn = await orchestrator.runTurn(createBaseRequest({ turnLimit: 3 }))

  // 発話直後に応答が返るため、同一ターンの debug には deliberation worker は含まれない。
  assert.equal(firstTurn.debug?.workers.some((worker) => worker.kind === 'deliberation'), false)

  const secondTurn = await orchestrator.runTurn(createBaseRequest({
    turnLimit: 3,
    sessionId: firstTurn.sessionId
  }))

  // 前ターンの分析結果(議論状態と worker 実行記録)は次ターンに反映される。
  assert.equal(secondTurn.debug?.workers.some((worker) => worker.kind === 'deliberation'), true)
  assert.equal(secondTurn.debug?.deliberationState?.convergence.status, 'ready_to_conclude')
})

test('Autonomous Conversation は action を集約して発話を採用する', async () => {
  const orchestrator = new MeetingOrchestrator(createFakeRunner())
  const response = await orchestrator.runTurn(createBaseRequest({
    executionMode: 'autonomous',
    turnLimit: 3
  }))

  assert.equal(response.sessionStatus, 'running')
  assert.equal(response.debug?.executionMode, 'autonomous')
  assert.match(response.debug?.dispatchReason ?? '', /Autonomous × Conversation/)
  assert.equal(response.debug?.workers.some((worker) => worker.kind === 'autonomous'), true)
  assert.equal(response.messages.length, 1)
})
