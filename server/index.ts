import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { hasCopilotSdkRuntime, runCli, type AgentCliProvider, type ReasoningEffort } from './cliRunner'
import { loadInputContext } from './contextLoader'
import { pickFilesDialog, pickFolderDialog } from './nativeDialog'
import { MeetingOrchestrator, type RunTurnRequest } from './orchestrator'
import { getProviderCatalogs } from './providerCatalog'

dotenv.config()

const app = express()
const port = process.env.PORT || 3001
const serverStartedAt = new Date().toISOString()
const backendFeatureMarker = 'copilot-sdk-bridge-v3'

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Turtle Brain Backend is running',
    startedAt: serverStartedAt,
    featureMarker: backendFeatureMarker,
    features: {
      copilotSdkBridge: hasCopilotSdkRuntime()
    }
  })
})

const orchestrator = new MeetingOrchestrator(runCli)

app.get('/api/providers/catalogs', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === '1'
    const catalogs = await getProviderCatalogs(forceRefresh)
    res.json({
      success: true,
      catalogs
    })
  } catch (error) {
    console.error('[API] Error while loading provider catalogs:', error)
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      details: String(error)
    })
  }
})

app.post('/api/system/pick-files', async (_req, res) => {
  try {
    const paths = await pickFilesDialog()
    res.json({
      success: true,
      paths
    })
  } catch (error) {
    console.error('[API] Error while opening file dialog:', error)
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      details: String(error)
    })
  }
})

app.post('/api/system/pick-folder', async (_req, res) => {
  try {
    const paths = await pickFolderDialog()
    res.json({
      success: true,
      paths
    })
  } catch (error) {
    console.error('[API] Error while opening folder dialog:', error)
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      details: String(error)
    })
  }
})

app.post('/api/agent/interact', async (req, res) => {
  try {
    const {
      prompt,
      provider = 'codex',
      model = 'gpt-5.4',
      reasoningEffort = 'medium',
      sessionId,
      inputPaths = []
    } = req.body as {
      prompt: string
      provider?: AgentCliProvider
      model?: string
      reasoningEffort?: ReasoningEffort
      sessionId?: string
      inputPaths?: string[]
    }

    const inputContext = await loadInputContext(inputPaths)
    const mergedPrompt = inputContext.promptBlock ? `${prompt}\n\n${inputContext.promptBlock}` : prompt

    const result = await runCli({
      provider,
      model,
      reasoningEffort,
      prompt: mergedPrompt,
      sessionId
    })

    res.json({
      success: true,
      response: result.response,
      sessionId: result.sessionId,
      rateLimits: result.rateLimits,
      inputWarnings: inputContext.warnings
    })
  } catch (error) {
    console.error('[API] Error during agent interaction:', error)
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      details: String(error)
    })
  }
})

app.post('/api/orchestrator/run-turn', async (req, res) => {
  try {
    const payload = req.body as RunTurnRequest
    const result = await orchestrator.runTurn(payload)
    res.json({ success: true, ...result })
  } catch (error) {
    console.error('[API] Error during orchestration:', error)
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      details: String(error)
    })
  }
})

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})
