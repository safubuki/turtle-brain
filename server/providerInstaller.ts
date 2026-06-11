import { spawn } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import https from 'https'
import path from 'path'
import type { AgentCliProvider } from './cliRunner'

export interface ProviderInstallSpec {
  provider: AgentCliProvider
  label: string
  command: string
  args: string[]
  displayCommand: string
}

export interface ProviderInstallRuntimeStatus {
  nodeVersion: string | null
  npmCommand: string
  npmVersion: string | null
  npmAvailable: boolean
}

export interface ProviderVersionStatus {
  installedVersion: string | null
  latestVersion: string | null
  // null = 判定不能(未インストール、またはレジストリへ到達できない場合)
  updateAvailable: boolean | null
}

export type ProviderVersionStatusMap = Record<AgentCliProvider, ProviderVersionStatus>

function dedupeStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))]
}

function getCandidateNpmRoots(): string[] {
  const pathRoots =
    process.env.PATH?.split(path.delimiter)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .filter((entry) => /[\\/]npm$/i.test(entry) || /appdata[\\/]roaming[\\/]npm/i.test(entry)) ?? []

  return dedupeStrings([
    path.dirname(process.execPath),
    process.env.APPDATA ? path.join(process.env.APPDATA, 'npm') : null,
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Roaming', 'npm') : null,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'nodejs') : null,
    process.env.NPM_CONFIG_PREFIX || null,
    process.env.npm_config_prefix || null,
    ...pathRoots
  ])
}

function getNpmCommandName(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm'
}

function getNpmCommand(): string {
  const commandName = getNpmCommandName()

  if (process.platform !== 'win32') {
    return commandName
  }

  for (const root of getCandidateNpmRoots()) {
    const candidate = path.join(root, commandName)
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return commandName
}

function getNpmDisplayCommand(): string {
  return 'npm'
}

function getNpmCliScriptPath(): string | null {
  const candidates = getCandidateNpmRoots().map((root) => path.join(root, 'node_modules', 'npm', 'bin', 'npm-cli.js'))
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

function getNpmExecution(): { command: string; argsPrefix: string[]; displayCommand: string } {
  const npmCliScriptPath = getNpmCliScriptPath()
  if (npmCliScriptPath) {
    return {
      command: process.execPath,
      argsPrefix: [npmCliScriptPath],
      displayCommand: getNpmDisplayCommand()
    }
  }

  return {
    command: getNpmCommand(),
    argsPrefix: [],
    displayCommand: getNpmDisplayCommand()
  }
}

async function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const useWindowsShell = process.platform === 'win32' && /\.cmd$/i.test(command)
    const child = spawn(command, args, {
      windowsHide: true,
      shell: useWindowsShell
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `${command} ${args.join(' ')} failed with code ${code}`))
        return
      }

      resolve(stdout.trim() || stderr.trim())
    })
  })
}

const NPM_PACKAGE_BY_PROVIDER: Record<AgentCliProvider, string> = {
  codex: '@openai/codex',
  gemini: '@google/gemini-cli',
  copilot: '@github/copilot',
  // Claude Code はネイティブインストーラ配布だが、バージョンは npm パッケージと同期している。
  claude: '@anthropic-ai/claude-code'
}

const VERSION_CACHE_TTL_MS = 10 * 60 * 1000
let cachedVersionStatuses: { fetchedAt: number; versions: ProviderVersionStatusMap } | null = null

export function clearProviderVersionCache(): void {
  cachedVersionStatuses = null
}

function readInstalledNpmVersion(packageName: string): string | null {
  for (const root of getCandidateNpmRoots()) {
    const packageJsonPath = path.join(root, 'node_modules', ...packageName.split('/'), 'package.json')
    if (!existsSync(packageJsonPath)) {
      continue
    }

    try {
      const parsed = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: unknown }
      if (typeof parsed.version === 'string' && parsed.version.trim()) {
        return parsed.version.trim()
      }
    } catch {
      // 壊れた package.json は無視して次の候補を見る。
    }
  }

  return null
}

async function getClaudeInstalledVersion(): Promise<string | null> {
  const npmVersion = readInstalledNpmVersion(NPM_PACKAGE_BY_PROVIDER.claude)
  if (npmVersion) {
    return npmVersion
  }

  const home = process.env.USERPROFILE ?? process.env.HOME
  const candidates = [
    home ? path.join(home, '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude') : null,
    'claude'
  ].filter((candidate): candidate is string => Boolean(candidate))

  for (const candidate of candidates) {
    if (candidate !== 'claude' && !existsSync(candidate)) {
      continue
    }

    try {
      const output = await runCommand(candidate, ['--version'])
      const match = output.match(/\d+\.\d+\.\d+/)
      if (match) {
        return match[0]
      }
    } catch {
      // 次の候補へ。
    }
  }

  return null
}

function fetchLatestNpmVersion(packageName: string, timeoutMs = 8000): Promise<string | null> {
  const url = `https://registry.npmjs.org/${packageName.replace('/', '%2F')}/latest`

  return new Promise((resolve) => {
    const request = https.get(url, { timeout: timeoutMs }, (response) => {
      if (response.statusCode !== 200) {
        response.resume()
        resolve(null)
        return
      }

      let data = ''
      response.on('data', (chunk: Buffer) => {
        data += chunk.toString()
      })
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data) as { version?: unknown }
          resolve(typeof parsed.version === 'string' ? parsed.version : null)
        } catch {
          resolve(null)
        }
      })
    })

    request.on('timeout', () => request.destroy())
    request.on('error', () => resolve(null))
  })
}

function isVersionNewer(latest: string, installed: string): boolean {
  const parse = (value: string): number[] =>
    value.split(/[.+-]/, 3).map((part) => Number.parseInt(part, 10) || 0)

  const [latestMajor, latestMinor, latestPatch] = parse(latest)
  const [installedMajor, installedMinor, installedPatch] = parse(installed)

  if (latestMajor !== installedMajor) {
    return latestMajor > installedMajor
  }
  if (latestMinor !== installedMinor) {
    return latestMinor > installedMinor
  }
  return latestPatch > installedPatch
}

async function getProviderVersionStatus(provider: AgentCliProvider): Promise<ProviderVersionStatus> {
  const [installedVersion, latestVersion] = await Promise.all([
    provider === 'claude'
      ? getClaudeInstalledVersion()
      : Promise.resolve(readInstalledNpmVersion(NPM_PACKAGE_BY_PROVIDER[provider])),
    fetchLatestNpmVersion(NPM_PACKAGE_BY_PROVIDER[provider])
  ])

  return {
    installedVersion,
    latestVersion,
    updateAvailable:
      installedVersion && latestVersion ? isVersionNewer(latestVersion, installedVersion) : null
  }
}

export async function getProviderVersionStatuses(forceRefresh = false): Promise<ProviderVersionStatusMap> {
  if (!forceRefresh && cachedVersionStatuses && Date.now() - cachedVersionStatuses.fetchedAt < VERSION_CACHE_TTL_MS) {
    return cachedVersionStatuses.versions
  }

  const providers: AgentCliProvider[] = ['codex', 'gemini', 'copilot', 'claude']
  const statuses = await Promise.all(providers.map((provider) => getProviderVersionStatus(provider)))

  const versions = Object.fromEntries(
    providers.map((provider, index) => [provider, statuses[index]])
  ) as ProviderVersionStatusMap

  cachedVersionStatuses = {
    fetchedAt: Date.now(),
    versions
  }

  return versions
}

export async function getProviderInstallRuntimeStatus(): Promise<ProviderInstallRuntimeStatus> {
  const npmExecution = getNpmExecution()
  let npmVersion: string | null = null

  try {
    npmVersion = await runCommand(npmExecution.command, [...npmExecution.argsPrefix, '--version'])
  } catch {
    npmVersion = null
  }

  return {
    nodeVersion: process.version ?? null,
    npmCommand: npmExecution.displayCommand,
    npmVersion,
    npmAvailable: Boolean(npmVersion)
  }
}

export function getProviderInstallSpec(provider: AgentCliProvider): ProviderInstallSpec {
  const npmExecution = getNpmExecution()

  switch (provider) {
    case 'codex':
      return {
        provider,
        label: 'Codex CLI',
        command: npmExecution.command,
        args: [...npmExecution.argsPrefix, 'install', '-g', '@openai/codex'],
        displayCommand: `${npmExecution.displayCommand} install -g @openai/codex`
      }
    case 'gemini':
      return {
        provider,
        label: 'Gemini CLI',
        command: npmExecution.command,
        args: [...npmExecution.argsPrefix, 'install', '-g', '@google/gemini-cli'],
        displayCommand: `${npmExecution.displayCommand} install -g @google/gemini-cli`
      }
    case 'copilot':
      return {
        provider,
        label: 'GitHub Copilot CLI',
        command: npmExecution.command,
        args: [...npmExecution.argsPrefix, 'install', '-g', '@github/copilot'],
        displayCommand: `${npmExecution.displayCommand} install -g @github/copilot`
      }
    case 'claude':
      return {
        provider,
        label: 'Claude Code',
        command: process.platform === 'win32' ? 'powershell.exe' : 'sh',
        args: process.platform === 'win32'
          ? [
              '-NoProfile',
              '-ExecutionPolicy',
              'Bypass',
              '-Command',
              'curl.exe -fsSL https://claude.ai/install.cmd -o install.cmd; .\\install.cmd; Remove-Item -Force install.cmd'
            ]
          : ['-c', 'curl -fsSL https://claude.ai/install.sh | sh'],
        displayCommand: process.platform === 'win32'
          ? 'curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd'
          : 'curl -fsSL https://claude.ai/install.sh | sh'
      }
  }
}

export async function installProviderCli(provider: AgentCliProvider): Promise<{
  spec: ProviderInstallSpec
  stdout: string
  stderr: string
}> {
  const spec = getProviderInstallSpec(provider)
  const runtimeStatus = await getProviderInstallRuntimeStatus()

  if (provider !== 'claude' && !runtimeStatus.npmAvailable) {
    throw new Error('NODE_SETUP_REQUIRED')
  }

  return new Promise((resolve, reject) => {
    const useWindowsShell = process.platform === 'win32' && /\.cmd$/i.test(spec.command)
    const child = spawn(spec.command, spec.args, {
      windowsHide: true,
      shell: useWindowsShell,
      env: {
        ...process.env,
        npm_config_ignore_scripts: 'false'
      }
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `${spec.displayCommand} failed with code ${code}`))
        return
      }

      resolve({
        spec,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      })
    })
  })
}

export async function updateProviderCli(provider: AgentCliProvider): Promise<{
  spec: ProviderInstallSpec
  stdout: string
  stderr: string
}> {
  return installProviderCli(provider)
}
