import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export type AgentCliProvider = 'codex' | 'gemini' | 'copilot'
export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh'

export interface RateLimitWindow {
  remaining: number | null
  limit: number | null
  resetAt: string | null
}

export interface AgentRateLimits {
  daily: RateLimitWindow | null
  weekly: RateLimitWindow | null
  source: string | null
}

export interface CliExecResult {
  response: string
  sessionId: string | null
  rateLimits: AgentRateLimits | null
}

export interface CliRunOptions {
  provider: AgentCliProvider
  model: string
  reasoningEffort: ReasoningEffort
  prompt: string
  sessionId?: string
}

function getCliCommandPath(provider: AgentCliProvider): string {
  const appData = process.env.APPDATA ?? ''
  const npmBin = path.join(appData, 'npm')

  switch (provider) {
    case 'codex':
      return process.platform === 'win32' ? path.join(npmBin, 'codex.cmd') : 'codex'
    case 'gemini':
      return process.platform === 'win32' ? path.join(npmBin, 'gemini.cmd') : 'gemini'
    case 'copilot':
      return process.platform === 'win32' ? path.join(npmBin, 'copilot.cmd') : 'copilot'
    default:
      return provider
  }
}

function normalizeRateLimitWindow(value: unknown): RateLimitWindow | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const windowLike = value as Record<string, unknown>
  const remaining = typeof windowLike.remaining === 'number'
    ? windowLike.remaining
    : typeof windowLike.remainingAmount === 'number'
      ? windowLike.remainingAmount
      : null
  const limit = typeof windowLike.limit === 'number'
    ? windowLike.limit
    : typeof windowLike.max === 'number'
      ? windowLike.max
      : null
  const resetAt = typeof windowLike.resetAt === 'string'
    ? windowLike.resetAt
    : typeof windowLike.resetTime === 'string'
      ? windowLike.resetTime
      : null

  if (remaining === null && limit === null && resetAt === null) {
    return null
  }

  return { remaining, limit, resetAt }
}

function extractRateLimits(value: unknown, source: string): AgentRateLimits | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const directDaily = normalizeRateLimitWindow(record.daily)
  const directWeekly = normalizeRateLimitWindow(record.weekly)
  if (directDaily || directWeekly) {
    return {
      daily: directDaily,
      weekly: directWeekly,
      source
    }
  }

  for (const nested of Object.values(record)) {
    const found = extractRateLimits(nested, source)
    if (found) {
      return found
    }
  }

  return null
}

function extractJsonObjects(stdout: string): unknown[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        return []
      }
    })
}

function parseGeminiOutput(stdout: string): CliExecResult {
  try {
    const parsed = JSON.parse(stdout) as Record<string, unknown>
    return {
      response: typeof parsed.response === 'string' ? parsed.response.trim() : stdout.trim(),
      sessionId: typeof parsed.session_id === 'string' ? parsed.session_id : null,
      rateLimits: extractRateLimits(parsed, 'gemini')
    }
  } catch {
    return {
      response: stdout.trim(),
      sessionId: null,
      rateLimits: null
    }
  }
}

function parseCopilotOutput(stdout: string): CliExecResult {
  const parsedObjects = extractJsonObjects(stdout)
  const responseCandidate = [...parsedObjects]
    .reverse()
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const record = item as Record<string, unknown>
      const values = ['response', 'content', 'message', 'output', 'text']
        .map((key) => record[key])
        .find((entry) => typeof entry === 'string')
      return typeof values === 'string' ? values : null
    })
    .find(Boolean)

  const sessionCandidate = [...parsedObjects]
    .reverse()
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const record = item as Record<string, unknown>
      const values = ['session_id', 'sessionId', 'conversationId', 'id']
        .map((key) => record[key])
        .find((entry) => typeof entry === 'string')
      return typeof values === 'string' ? values : null
    })
    .find(Boolean)

  const rateLimits = parsedObjects
    .map((entry) => extractRateLimits(entry, 'copilot'))
    .find(Boolean) ?? null

  return {
    response: responseCandidate?.trim() || stdout.trim(),
    sessionId: sessionCandidate ?? null,
    rateLimits
  }
}

function parseCodexOutput(stdout: string, fallbackSessionId?: string): { sessionId: string | null; rateLimits: AgentRateLimits | null } {
  const parsedObjects = extractJsonObjects(stdout)
  const threadStarted = parsedObjects.find((entry) => {
    if (!entry || typeof entry !== 'object') {
      return false
    }

    return (entry as Record<string, unknown>).type === 'thread.started'
  }) as Record<string, unknown> | undefined

  const rateLimits = parsedObjects
    .map((entry) => extractRateLimits(entry, 'codex'))
    .find(Boolean) ?? null

  return {
    sessionId: typeof threadStarted?.thread_id === 'string' ? threadStarted.thread_id : fallbackSessionId ?? null,
    rateLimits
  }
}

function buildPromptPrefix(provider: AgentCliProvider, reasoningEffort: ReasoningEffort): string {
  const providerLabel =
    provider === 'codex' ? 'Codex CLI' :
    provider === 'gemini' ? 'Gemini CLI' :
    'GitHub Copilot CLI'

  return [
    `You are running inside ${providerLabel}.`,
    `Reasoning effort preference: ${reasoningEffort}.`,
    'This task is a discussion task only.',
    'Do not modify files, do not run shell commands, and do not browse the web unless strictly required to answer.',
    'Respond in Japanese.'
  ].join('\n')
}

function buildCommand(provider: AgentCliProvider, options: CliRunOptions, outputFilePath?: string): { command: string; args: string[] } {
  const command = getCliCommandPath(provider)
  const prompt = `${buildPromptPrefix(provider, options.reasoningEffort)}\n\n${options.prompt}`

  switch (provider) {
    case 'codex': {
      const args = options.sessionId
        ? ['exec', '--json', 'resume', options.sessionId, '-m', options.model, '-o', outputFilePath ?? '', prompt]
        : ['exec', '--json', '-m', options.model, '-o', outputFilePath ?? '', prompt]
      return { command, args }
    }
    case 'gemini': {
      const args = ['-p', prompt, '--output-format', 'json', '-m', options.model]
      if (options.sessionId) {
        args.push('--resume', options.sessionId)
      }
      return { command, args }
    }
    case 'copilot': {
      const args = [
        '-p',
        prompt,
        '--output-format',
        'json',
        '--model',
        options.model,
        '--reasoning-effort',
        options.reasoningEffort,
        '--allow-all-tools',
        '--no-ask-user',
        '--no-alt-screen',
        '--no-color'
      ]
      if (options.sessionId) {
        args.push(`--resume=${options.sessionId}`)
      }
      return { command, args }
    }
  }
}

export function runCli(options: CliRunOptions): Promise<CliExecResult> {
  return new Promise((resolve, reject) => {
    const tmpOutFile = options.provider === 'codex'
      ? path.join(os.tmpdir(), `turtle-brain-codex-${Date.now()}.txt`)
      : undefined

    const { command, args } = buildCommand(options.provider, options, tmpOutFile)
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      if (tmpOutFile) {
        try {
          const response = fs.readFileSync(tmpOutFile, 'utf-8').trim()
          fs.unlinkSync(tmpOutFile)
          if (code !== 0) {
            reject(new Error(`${options.provider} exited with code ${code}. stderr: ${stderr}`))
            return
          }

          const codexMeta = parseCodexOutput(stdout, options.sessionId)
          resolve({
            response,
            sessionId: codexMeta.sessionId,
            rateLimits: codexMeta.rateLimits
          })
          return
        } catch (error) {
          try {
            fs.unlinkSync(tmpOutFile)
          } catch {
            // no-op
          }

          reject(new Error(`Codex output read failed: ${String(error)}`))
          return
        }
      }

      if (code !== 0) {
        reject(new Error(`${options.provider} exited with code ${code}. stderr: ${stderr || stdout}`))
        return
      }

      const trimmedStdout = stdout.trim()
      if (!trimmedStdout) {
        reject(new Error(`${options.provider} returned an empty response`))
        return
      }

      if (options.provider === 'gemini') {
        resolve(parseGeminiOutput(trimmedStdout))
        return
      }

      resolve(parseCopilotOutput(trimmedStdout))
    })

    child.on('error', (error) => {
      if (tmpOutFile) {
        try {
          fs.unlinkSync(tmpOutFile)
        } catch {
          // no-op
        }
      }
      reject(error)
    })
  })
}
