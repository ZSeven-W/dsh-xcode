/**
 * macOS & Xcode environment discovery: active developer directory, Xcode
 * version/build, `xcrun mcpbridge` + `xcrun agent` capabilities, running Xcode
 * processes, PID resolution rules, and `.xcworkspace` / `.xcodeproj` /
 * `Package.swift` target detection.
 */

import { execFile } from 'node:child_process'
import { readdir, stat } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface XcodeVersionInfo {
  version: string
  build: string
}

export interface McpBridgeProbe {
  available: boolean
  mcpbridgePath?: string
  agentPath?: string
  supportsSkillsExport: boolean
  supportsPluginPath: boolean
  reason?: string
}

export interface RunningXcodeProcess {
  pid: number
  executablePath: string
  appBundlePath?: string
}

export interface DetectedAppleProject {
  kind: 'xcworkspace' | 'xcodeproj' | 'swiftpm'
  /** Path passed to `open -a Xcode` (the `.xcworkspace`, `.xcodeproj`, or `Package.swift`). */
  openTargetPath: string
  /** Containing project root directory. */
  rootDir: string
  name: string
}

export interface XcodeEnvSnapshot {
  platform: NodeJS.Platform
  supportedPlatform: boolean
  developerDir?: string
  selectedXcodeAppPath?: string
  xcodeVersion?: XcodeVersionInfo
  bridge: McpBridgeProbe
  runningXcodes: RunningXcodeProcess[]
}

export class XcodeError extends Error {
  readonly code: string
  constructor(message: string, code = 'XCODE_ERROR') {
    super(message)
    this.name = 'XcodeError'
    this.code = code
  }
}

async function runCmd(
  file: string,
  args: string[],
  timeoutMs = 8_000,
  signal?: AbortSignal,
): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, {
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
      ...(signal ? { signal } : {}),
    })
    return { stdout: String(stdout), stderr: String(stderr), ok: true }
  } catch (error: any) {
    return {
      stdout: typeof error?.stdout === 'string' ? error.stdout : '',
      stderr: typeof error?.stderr === 'string' ? error.stderr : (error instanceof Error ? error.message : String(error)),
      ok: false,
    }
  }
}

/** Extract `/Applications/Xcode.app` from `/Applications/Xcode.app/Contents/Developer`. */
export function xcodeAppFromDeveloperDir(developerDir: string | undefined): string | undefined {
  if (!developerDir) return undefined
  const normalized = developerDir.replace(/\/+$/u, '')
  const marker = '/Contents/Developer'
  if (normalized.endsWith(marker)) {
    return normalized.slice(0, -marker.length)
  }
  if (normalized.endsWith('.app')) return normalized
  return undefined
}

/** Parse `xcodebuild -version` stdout (`Xcode 26.6\nBuild version 17F113`). */
export function parseXcodebuildVersion(output: string): XcodeVersionInfo | undefined {
  const versionMatch = /^Xcode\s+([^\s\r\n]+)/mu.exec(output)
  if (!versionMatch) return undefined
  const buildMatch = /^Build version\s+([^\s\r\n]+)/mu.exec(output)
  return {
    version: versionMatch[1]!,
    build: buildMatch?.[1] ?? 'unknown',
  }
}

/**
 * Parse `ps -ax -o pid=,comm=` lines to find genuine Xcode IDE processes
 * (`.../Xcode.app/Contents/MacOS/Xcode`), excluding Simulator, git helpers, or
 * XPC services.
 */
export function parseRunningXcodeProcesses(psOutput: string): RunningXcodeProcess[] {
  const results: RunningXcodeProcess[] = []
  for (const rawLine of psOutput.split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line) continue
    const match = /^(\d+)\s+(.+)$/u.exec(line)
    if (!match) continue
    const pid = Number.parseInt(match[1]!, 10)
    const comm = match[2]!.trim()
    if (!Number.isSafeInteger(pid) || pid <= 0) continue
    if (!/\/Contents\/MacOS\/Xcode$/u.test(comm)) continue
    const appIndex = comm.lastIndexOf('/Contents/MacOS/Xcode')
    const appBundlePath = appIndex > 0 ? comm.slice(0, appIndex) : undefined
    results.push({
      pid,
      executablePath: comm,
      ...(appBundlePath ? { appBundlePath } : {}),
    })
  }
  return results
}

/**
 * Resolve which running Xcode PID `mcpbridge` should attach to, matching
 * Apple's own fallback priority with clearer diagnostics.
 */
export function pickXcodePid(options: {
  explicitPid?: number
  envPid?: number
  running: RunningXcodeProcess[]
  selectedAppPath?: string
}): { pid?: number; source?: 'explicit' | 'env' | 'single' | 'xcode-select'; reason?: string } {
  const { explicitPid, envPid, running, selectedAppPath } = options

  if (explicitPid !== undefined && Number.isSafeInteger(explicitPid) && explicitPid > 0) {
    return { pid: explicitPid, source: 'explicit' }
  }
  if (envPid !== undefined && Number.isSafeInteger(envPid) && envPid > 0) {
    return { pid: envPid, source: 'env' }
  }
  if (running.length === 0) {
    return {
      reason: 'No running Xcode process found. Open a project first with `xcode_open_project` (or launch Xcode manually).',
    }
  }
  if (running.length === 1) {
    return { pid: running[0]!.pid, source: 'single' }
  }
  if (selectedAppPath) {
    const normalizedSelected = selectedAppPath.replace(/\/+$/u, '')
    const matches = running.filter(proc => proc.appBundlePath?.replace(/\/+$/u, '') === normalizedSelected)
    if (matches.length === 1) {
      return { pid: matches[0]!.pid, source: 'xcode-select' }
    }
  }
  const candidates = running.map(proc => `${proc.pid} (${proc.appBundlePath ?? proc.executablePath})`).join(', ')
  return {
    reason: `Multiple Xcode processes are running (${candidates}). Pass \`xcodePid\` or configure \`xcodePid\` in cordis.patch.yml to select one.`,
  }
}

export async function inspectXcodeEnvironment(signal?: AbortSignal): Promise<XcodeEnvSnapshot> {
  if (process.platform !== 'darwin') {
    return {
      platform: process.platform,
      supportedPlatform: false,
      bridge: {
        available: false,
        supportsSkillsExport: false,
        supportsPluginPath: false,
        reason: `@zseven-w/dsh-xcode requires macOS with Xcode (current host: ${process.platform}).`,
      },
      runningXcodes: [],
    }
  }

  const envDevDir = process.env.DEVELOPER_DIR?.trim()
  const selectRes = envDevDir
    ? { ok: true, stdout: envDevDir, stderr: '' }
    : await runCmd('xcode-select', ['-p'], 5_000, signal)
  const developerDir = selectRes.ok ? selectRes.stdout.trim() : undefined
  const selectedXcodeAppPath = xcodeAppFromDeveloperDir(developerDir)

  const [versionRes, bridgeFindRes, agentFindRes, psRes] = await Promise.all([
    runCmd('xcodebuild', ['-version'], 8_000, signal),
    runCmd('xcrun', ['--find', 'mcpbridge'], 5_000, signal),
    runCmd('xcrun', ['--find', 'agent'], 5_000, signal),
    runCmd('ps', ['-ax', '-o', 'pid=,comm='], 5_000, signal),
  ])

  const xcodeVersion = versionRes.ok ? parseXcodebuildVersion(versionRes.stdout) : undefined
  const mcpbridgePath = bridgeFindRes.ok ? bridgeFindRes.stdout.trim() : undefined
  const agentPath = agentFindRes.ok ? agentFindRes.stdout.trim() : undefined
  const runningXcodes = psRes.ok ? parseRunningXcodeProcesses(psRes.stdout) : []

  if (!mcpbridgePath) {
    return {
      platform: process.platform,
      supportedPlatform: true,
      ...(developerDir ? { developerDir } : {}),
      ...(selectedXcodeAppPath ? { selectedXcodeAppPath } : {}),
      ...(xcodeVersion ? { xcodeVersion } : {}),
      bridge: {
        available: false,
        supportsSkillsExport: false,
        supportsPluginPath: false,
        reason: developerDir?.includes('CommandLineTools')
          ? 'xcode-select currently points to Command Line Tools (`' + developerDir + '`), not full Xcode. Run `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` with Xcode 26.3+ installed.'
          : 'xcrun could not find `mcpbridge`. Install Xcode 26.3+ and point `xcode-select` to full Xcode.app.',
      },
      runningXcodes,
    }
  }

  const helpRes = await runCmd(mcpbridgePath, ['--help'], 5_000, signal)
  const helpText = `${helpRes.stdout}\n${helpRes.stderr}`
  const supportsSkillsExport = /skills\s+export/iu.test(helpText)
  const supportsPluginPath = /plugin\s+path/iu.test(helpText)

  return {
    platform: process.platform,
    supportedPlatform: true,
    ...(developerDir ? { developerDir } : {}),
    ...(selectedXcodeAppPath ? { selectedXcodeAppPath } : {}),
    ...(xcodeVersion ? { xcodeVersion } : {}),
    bridge: {
      available: true,
      mcpbridgePath,
      ...(agentPath ? { agentPath } : {}),
      supportsSkillsExport,
      supportsPluginPath,
    },
    runningXcodes,
  }
}

/**
 * Locate an `.xcworkspace`, `.xcodeproj`, or `Package.swift` from a direct path
 * or inside a workspace directory (searching root first, then 1 subdirectory deep).
 */
export async function detectAppleProject(targetPath: string): Promise<DetectedAppleProject> {
  const abs = resolve(targetPath)
  let info
  try {
    info = await stat(abs)
  } catch {
    throw new XcodeError(`Path does not exist: ${abs}`, 'PATH_NOT_FOUND')
  }

  const ext = extname(abs).toLowerCase()
  if (ext === '.xcworkspace') {
    if (abs.includes('.xcodeproj/')) {
      const xcodeproj = dirname(abs)
      return {
        kind: 'xcodeproj',
        openTargetPath: xcodeproj,
        rootDir: dirname(xcodeproj),
        name: basename(xcodeproj, '.xcodeproj'),
      }
    }
    return {
      kind: 'xcworkspace',
      openTargetPath: abs,
      rootDir: dirname(abs),
      name: basename(abs, '.xcworkspace'),
    }
  }
  if (ext === '.xcodeproj') {
    return {
      kind: 'xcodeproj',
      openTargetPath: abs,
      rootDir: dirname(abs),
      name: basename(abs, '.xcodeproj'),
    }
  }
  if (basename(abs) === 'Package.swift') {
    const dir = dirname(abs)
    return {
      kind: 'swiftpm',
      openTargetPath: abs,
      rootDir: dir,
      name: basename(dir),
    }
  }

  const searchDir = info.isDirectory() ? abs : dirname(abs)
  const found = await scanDirForProject(searchDir)
  if (found) return found

  // Search one level down (common monorepo layout: `ios/App.xcodeproj`).
  const entries = await readdir(searchDir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'DerivedData' || entry.name === 'build') {
      continue
    }
    const sub = await scanDirForProject(join(searchDir, entry.name))
    if (sub) return sub
  }

  throw new XcodeError(
    `No .xcworkspace, .xcodeproj, or Package.swift found in ${searchDir}. Pass an explicit path to \`projectPath\`.`,
    'NO_APPLE_PROJECT',
  )
}

async function scanDirForProject(dir: string): Promise<DetectedAppleProject | undefined> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const names = entries.map(entry => entry.name).sort((a, b) => a.localeCompare(b))

  const workspace = names.find(name => name.endsWith('.xcworkspace') && !name.startsWith('.'))
  if (workspace) {
    return {
      kind: 'xcworkspace',
      openTargetPath: join(dir, workspace),
      rootDir: dir,
      name: basename(workspace, '.xcworkspace'),
    }
  }

  const project = names.find(name => name.endsWith('.xcodeproj') && !name.startsWith('.'))
  if (project) {
    return {
      kind: 'xcodeproj',
      openTargetPath: join(dir, project),
      rootDir: dir,
      name: basename(project, '.xcodeproj'),
    }
  }

  if (names.includes('Package.swift')) {
    return {
      kind: 'swiftpm',
      openTargetPath: join(dir, 'Package.swift'),
      rootDir: dir,
      name: basename(dir),
    }
  }

  return undefined
}
