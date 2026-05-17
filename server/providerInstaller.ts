import { spawn } from 'child_process'
import { existsSync } from 'fs'
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
