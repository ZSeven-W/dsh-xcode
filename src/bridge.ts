/**
 * High-level controller over `xcrun mcpbridge`:
 * - Serializes on-demand session connections and reconnects cleanly if Xcode restarts
 * - Parses `XcodeListWindows` across structured JSON & text outputs
 * - Auto-resolves `tabIdentifier` by matching workspace paths or single-window fallback
 * - Opens `.xcworkspace` / `.xcodeproj` / `Package.swift` in Xcode and waits until ready
 * - Writes `.dsh-xcode/state.json` and `.dsh-xcode/previews/*.png` so the DSH
 *   Right-Sidebar Xcode Workbench tab stays synchronized with agent actions
 */

import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { promisify } from 'node:util'
import {
  detectAppleProject,
  inspectXcodeEnvironment,
  pickXcodePid,
  XcodeError,
  type DetectedAppleProject,
  type XcodeEnvSnapshot,
} from './env.ts'
import {
  McpStdioSession,
  type McpCallNormalizedResult,
  type McpDecodedImage,
  type McpToolSchema,
} from './mcp-stdio.ts'
import { readIosPeer, type IosPeerSnapshot, type XcodePeerWindow } from './peer-registry.ts'

const execFileAsync = promisify(execFile)

export const WORKBENCH_DIR_NAME = '.dsh-xcode'
export const WORKBENCH_STATE_FILE = '.dsh-xcode/state.json'

export interface XcodeWindowInfo extends XcodePeerWindow {
  tabIdentifier: string
  workspacePath?: string
  name?: string
  active?: boolean
}

export interface SavedPreviewRecord {
  id: string
  sourceFilePath: string
  relativeImagePath: string
  absoluteImagePath: string
  mimeType: string
  bytes: number
  createdAt: string
}

export interface DiagnosticSummaryItem {
  severity: 'error' | 'warning' | 'note'
  file?: string
  line?: number
  message: string
}

export interface WorkbenchPersistedState {
  updatedAt: string
  xcodeVersion?: string
  xcodeBuild?: string
  connected: boolean
  xcodePid?: number
  openWindows: XcodeWindowInfo[]
  availableTools: string[]
  exportedSkills: string[]
  iosPeer: IosPeerSnapshot | null
  lastDiagnostics?: {
    checkedAt: string
    target?: string
    items: DiagnosticSummaryItem[]
    rawText: string
  }
  lastBuild?: {
    finishedAt: string
    action: string
    ok: boolean
    summary: string
  }
  previews: SavedPreviewRecord[]
  lastError?: string
}

export interface XcodeBridgeControllerOptions {
  xcodePid?: number
  callTimeoutMs?: number
  /** Test seam for injecting a mock `mcpbridge` command + args. */
  bridgeCommand?: string
  bridgeArgs?: string[]
  /** Test seam for injecting environment inspection. */
  inspectEnv?: (signal?: AbortSignal) => Promise<XcodeEnvSnapshot>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parse `XcodeListWindows` output from either structured JSON (`windows` array
 * or top-level array) or line-oriented text (`tabIdentifier: ... workspacePath: ...`).
 */
export function parseXcodeWindows(result: { text: string; structuredContent?: unknown }): XcodeWindowInfo[] {
  const windows: XcodeWindowInfo[] = []
  const seen = new Set<string>()

  const pushWindow = (candidate: Partial<XcodeWindowInfo>) => {
    const id = candidate.tabIdentifier?.trim()
    if (!id || seen.has(id)) return
    seen.add(id)
    windows.push({
      tabIdentifier: id,
      ...(candidate.workspacePath ? { workspacePath: candidate.workspacePath } : {}),
      ...(candidate.name ? { name: candidate.name } : {}),
      ...(candidate.active !== undefined ? { active: candidate.active } : {}),
    })
  }

  const inspectStructured = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const item of node) inspectStructured(item)
      return
    }
    if (!isRecord(node)) return
    const tabId = typeof node.tabIdentifier === 'string'
      ? node.tabIdentifier
      : typeof node.tabId === 'string'
        ? node.tabId
        : typeof node.identifier === 'string' && ('workspacePath' in node || 'documentPath' in node || 'projectPath' in node)
          ? node.identifier
          : undefined
    const wsPath = typeof node.workspacePath === 'string'
      ? node.workspacePath
      : typeof node.projectPath === 'string'
        ? node.projectPath
        : typeof node.documentPath === 'string'
          ? node.documentPath
          : typeof node.path === 'string'
            ? node.path
            : undefined
    const name = typeof node.name === 'string'
      ? node.name
      : typeof node.title === 'string'
        ? node.title
        : wsPath
          ? basename(wsPath)
          : undefined
    if (tabId) {
      pushWindow({
        tabIdentifier: tabId,
        ...(wsPath ? { workspacePath: wsPath } : {}),
        ...(name ? { name } : {}),
        ...(typeof node.isActive === 'boolean' ? { active: node.isActive } : typeof node.active === 'boolean' ? { active: node.active } : {}),
      })
    }
    for (const val of Object.values(node)) {
      if (typeof val === 'object' && val !== null) inspectStructured(val)
    }
  }

  if (result.structuredContent !== undefined) {
    inspectStructured(result.structuredContent)
  }

  if (windows.length === 0 && result.text.trim()) {
    try {
      inspectStructured(JSON.parse(result.text))
    } catch {
      // Fallback: parse human-readable text blocks emitted by XcodeListWindows.
      // Matches patterns like `tabIdentifier: windowtab1, workspacePath: /path/to/App.xcodeproj`
      // or multiline blocks containing tabIdentifier + workspacePath.
      const lines = result.text.split(/\r?\n/u)
      let currentTab: string | undefined
      let currentPath: string | undefined
      let currentName: string | undefined
      const flush = () => {
        if (currentTab) {
          pushWindow({
            tabIdentifier: currentTab,
            ...(currentPath ? { workspacePath: currentPath } : {}),
            ...(currentName ? { name: currentName } : currentPath ? { name: basename(currentPath) } : {}),
          })
        }
        currentTab = undefined
        currentPath = undefined
        currentName = undefined
      }
      for (const line of lines) {
        const tabMatch = /tabIdentifier["'\s:=]+([A-Za-z0-9_.:-]+)/iu.exec(line)
        const pathMatch = /(?:workspacePath|projectPath|documentPath|path)["'\s:=]+([^\r\n,"'}]+)/iu.exec(line)
        const nameMatch = /(?:windowName|title|name)["'\s:=]+([^\r\n,"'}]+)/iu.exec(line)
        if (tabMatch) {
          if (currentTab && currentTab !== tabMatch[1]) flush()
          currentTab = tabMatch[1]!.trim()
        }
        if (pathMatch) currentPath = pathMatch[1]!.trim()
        if (nameMatch) currentName = nameMatch[1]!.trim()
        if (currentTab && currentPath && line.includes(',')) flush()
      }
      flush()
    }
  }

  return windows
}

/** Extract structured error/warning items from Xcode diagnostics text or JSON. */
export function extractDiagnosticItems(result: { text: string; structuredContent?: unknown }): DiagnosticSummaryItem[] {
  const items: DiagnosticSummaryItem[] = []

  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const el of node) walk(el)
      return
    }
    if (!isRecord(node)) return
    const msg = typeof node.message === 'string'
      ? node.message
      : typeof node.title === 'string' && ('severity' in node || 'line' in node || 'filePath' in node)
        ? node.title
        : undefined
    if (msg) {
      const rawSev = String(node.severity ?? node.kind ?? node.type ?? 'error').toLowerCase()
      const severity: DiagnosticSummaryItem['severity'] = rawSev.includes('warn')
        ? 'warning'
        : rawSev.includes('note') || rawSev.includes('remark')
          ? 'note'
          : 'error'
      const file = typeof node.filePath === 'string'
        ? node.filePath
        : typeof node.file === 'string'
          ? node.file
          : typeof node.path === 'string'
            ? node.path
            : undefined
      const line = typeof node.line === 'number'
        ? node.line
        : typeof node.lineNumber === 'number'
          ? node.lineNumber
          : undefined
      items.push({
        severity,
        ...(file ? { file } : {}),
        ...(line !== undefined ? { line } : {}),
        message: msg,
      })
    }
    for (const val of Object.values(node)) {
      if (typeof val === 'object' && val !== null) walk(val)
    }
  }

  if (result.structuredContent !== undefined) walk(result.structuredContent)

  if (items.length === 0 && result.text) {
    // Parse standard Swift/Clang diagnostic lines: `/path/File.swift:42:13: error: cannot find 'x' in scope`
    for (const rawLine of result.text.split(/\r?\n/u)) {
      const m = /^(.+?):(\d+)(?::\d+)?:\s*(error|warning|note):\s*(.+)$/iu.exec(rawLine.trim())
      if (!m) continue
      const sev = m[3]!.toLowerCase() as DiagnosticSummaryItem['severity']
      items.push({
        severity: sev,
        file: m[1]!.trim(),
        line: Number.parseInt(m[2]!, 10),
        message: m[4]!.trim(),
      })
    }
  }

  return items.slice(0, 100)
}

function normalizePathForMatch(p: string): string {
  return resolve(p).replace(/\/+$/u, '').toLowerCase()
}

export class XcodeBridgeController {
  private readonly configuredPid?: number
  private readonly callTimeoutMs: number
  private readonly bridgeCommand?: string
  private readonly bridgeArgs?: string[]
  private readonly inspectEnvFn: (signal?: AbortSignal) => Promise<XcodeEnvSnapshot>

  private session: McpStdioSession | null = null
  private sessionPid: number | undefined
  private connecting: Promise<McpStdioSession> | null = null
  private lastWindows: XcodeWindowInfo[] = []
  private lastTools: McpToolSchema[] = []
  private lastEnv: XcodeEnvSnapshot | null = null
  private exportedSkillsList: string[] = []
  private previewsHistory: SavedPreviewRecord[] = []
  private lastDiagnosticsState: WorkbenchPersistedState['lastDiagnostics']
  private lastBuildState: WorkbenchPersistedState['lastBuild']
  private lastErrorText: string | undefined

  constructor(options: XcodeBridgeControllerOptions = {}) {
    this.configuredPid = options.xcodePid
    this.callTimeoutMs = options.callTimeoutMs ?? 180_000
    this.bridgeCommand = options.bridgeCommand
    this.bridgeArgs = options.bridgeArgs
    this.inspectEnvFn = options.inspectEnv ?? inspectXcodeEnvironment
  }

  setExportedSkillNames(names: string[]): void {
    this.exportedSkillsList = [...names]
  }

  peerSnapshot() {
    return {
      version: '0.1.0-rc.1',
      connected: this.session?.isAlive === true,
      mcpbridgeAvailable: this.lastEnv?.bridge.available ?? (process.platform === 'darwin'),
      ...(this.lastEnv?.xcodeVersion?.version ? { xcodeVersion: this.lastEnv.xcodeVersion.version } : {}),
      ...(this.lastEnv?.xcodeVersion?.build ? { xcodeBuild: this.lastEnv.xcodeVersion.build } : {}),
      ...(this.sessionPid !== undefined ? { xcodePid: this.sessionPid } : {}),
      openWindows: this.lastWindows.map(w => ({
        tabIdentifier: w.tabIdentifier,
        ...(w.workspacePath ? { workspacePath: w.workspacePath } : {}),
        ...(w.name ? { name: w.name } : {}),
      })),
    }
  }

  private resolveEnvPid(): number | undefined {
    const raw = process.env.DSHPLUGIN_XCODE_PID ?? process.env.MCP_XCODE_PID
    if (!raw) return undefined
    const parsed = Number.parseInt(raw, 10)
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
  }

  async ensureSession(options: { xcodePid?: number; signal?: AbortSignal } = {}): Promise<McpStdioSession> {
    const env = await this.inspectEnvFn(options.signal)
    this.lastEnv = env

    if (!this.bridgeCommand) {
      if (!env.supportedPlatform || !env.bridge.available) {
        throw new XcodeError(env.bridge.reason ?? 'Xcode mcpbridge is unavailable on this machine.', 'BRIDGE_UNAVAILABLE')
      }
    }

    const picked = this.bridgeCommand
      ? { pid: options.xcodePid ?? this.configuredPid ?? 1, source: 'explicit' as const }
      : pickXcodePid({
          explicitPid: options.xcodePid ?? this.configuredPid,
          envPid: this.resolveEnvPid(),
          running: env.runningXcodes,
          selectedAppPath: env.selectedXcodeAppPath,
        })

    if (picked.pid === undefined) {
      throw new XcodeError(picked.reason ?? 'No running Xcode process found.', 'XCODE_NOT_RUNNING')
    }

    if (this.session?.isAlive && this.sessionPid === picked.pid) {
      return this.session
    }

    if (this.connecting) {
      return this.connecting
    }

    const connectTask = (async () => {
      if (this.session) {
        await this.session.close().catch(() => {})
        this.session = null
      }
      const next = new McpStdioSession({
        ...(this.bridgeCommand ? { command: this.bridgeCommand } : {}),
        ...(this.bridgeArgs ? { args: this.bridgeArgs } : {}),
        ...(this.bridgeCommand ? {} : { xcodePid: picked.pid }),
        defaultCallTimeoutMs: this.callTimeoutMs,
        onClose: (reason: string) => {
          if (this.session === next) {
            this.session = null
            this.lastErrorText = reason
          }
        },
      })
      await next.connect(options.signal)
      const tools = await next.listTools({ signal: options.signal })
      this.session = next
      this.sessionPid = picked.pid
      this.lastTools = tools
      this.lastErrorText = undefined
      return next
    })()

    this.connecting = connectTask
    try {
      return await connectTask
    } finally {
      this.connecting = null
    }
  }

  async status(options: { connectIfRunning?: boolean; cwd?: string; signal?: AbortSignal } = {}) {
    const env = await this.inspectEnvFn(options.signal)
    this.lastEnv = env
    const iosPeer = readIosPeer()

    const canConnect = options.connectIfRunning !== false
      && (Boolean(this.bridgeCommand) || (env.supportedPlatform && env.bridge.available && env.runningXcodes.length > 0))

    let connectionError: string | undefined
    if (canConnect) {
      try {
        const session = await this.ensureSession({ signal: options.signal })
        this.lastTools = await session.listTools({ signal: options.signal })
        if (this.lastTools.some(t => t.name === 'XcodeListWindows')) {
          const winRes = await session.callTool('XcodeListWindows', {}, { timeoutMs: 15_000, signal: options.signal })
          this.lastWindows = parseXcodeWindows(winRes)
        }
      } catch (err) {
        connectionError = err instanceof Error ? err.message : String(err)
        this.lastErrorText = connectionError
      }
    }

    const connected = this.session?.isAlive === true
    const snapshot = {
      platform: env.platform,
      supportedPlatform: env.supportedPlatform,
      ...(env.developerDir ? { developerDir: env.developerDir } : {}),
      ...(env.selectedXcodeAppPath ? { selectedXcodeAppPath: env.selectedXcodeAppPath } : {}),
      ...(env.xcodeVersion ? { xcodeVersion: env.xcodeVersion } : {}),
      bridge: env.bridge,
      runningXcodes: env.runningXcodes,
      connected,
      ...(this.sessionPid !== undefined ? { xcodePid: this.sessionPid } : {}),
      openWindows: this.lastWindows,
      availableTools: this.lastTools.map(t => t.name),
      exportedSkills: this.exportedSkillsList,
      iosPeer,
      ...(connectionError ? { connectionError } : {}),
      setupHint: !connected
        ? 'Open your project in Xcode (`xcode_open_project`) and enable Xcode → Settings → Intelligence → Model Context Protocol → Allow External Agents.'
        : undefined,
    }

    if (options.cwd) {
      await this.persistWorkbenchState(options.cwd).catch(() => {})
    }

    return snapshot
  }

  async listWindows(options: { xcodePid?: number; signal?: AbortSignal } = {}): Promise<XcodeWindowInfo[]> {
    const session = await this.ensureSession(options)
    const res = await session.callTool('XcodeListWindows', {}, { timeoutMs: 15_000, signal: options.signal })
    const parsed = parseXcodeWindows(res)
    this.lastWindows = parsed
    return parsed
  }

  /**
   * Resolve a `tabIdentifier` automatically when the caller omits it:
   * 1. Explicit `tabIdentifier` wins immediately.
   * 2. Match `projectPath` (or containing rootDir) against `openWindows`.
   * 3. Single open window wins automatically.
   * 4. Active window wins if marked active; otherwise error listing candidates.
   */
  async resolveTabIdentifier(options: {
    tabIdentifier?: string
    projectPath?: string
    xcodePid?: number
    signal?: AbortSignal
  }): Promise<string> {
    if (options.tabIdentifier && options.tabIdentifier.trim() !== '') {
      return options.tabIdentifier.trim()
    }

    const windows = await this.listWindows({ xcodePid: options.xcodePid, signal: options.signal })
    if (windows.length === 0) {
      throw new XcodeError(
        'Xcode is running, but no open project window was reported by `XcodeListWindows`. '
        + 'Call `xcode_open_project` to open an `.xcworkspace`, `.xcodeproj`, or `Package.swift` first.',
        'NO_OPEN_XCODE_WINDOW',
      )
    }

    if (options.projectPath && options.projectPath.trim() !== '') {
      const targetNorm = normalizePathForMatch(options.projectPath)
      const targetBase = basename(targetNorm)
      const exactOrContained = windows.find(win => {
        if (!win.workspacePath) return false
        const winNorm = normalizePathForMatch(win.workspacePath)
        const winDir = dirname(winNorm)
        return (
          winNorm === targetNorm
          || targetNorm.startsWith(`${winNorm}/`)
          || targetNorm.startsWith(`${winDir}/`)
          || winNorm.startsWith(`${targetNorm}/`)
        )
      })
      if (exactOrContained) return exactOrContained.tabIdentifier

      const byName = windows.find(win => win.name?.toLowerCase() === targetBase)
      if (byName) return byName.tabIdentifier
    }

    if (windows.length === 1) {
      return windows[0]!.tabIdentifier
    }

    const active = windows.find(w => w.active === true)
    if (active) return active.tabIdentifier

    const choices = windows
      .map(w => `${w.tabIdentifier} (${w.workspacePath ?? w.name ?? 'untitled'})`)
      .join(', ')
    throw new XcodeError(
      `Multiple Xcode windows are open (${choices}). Pass \`tabIdentifier\` or \`projectPath\` to disambiguate.`,
      'AMBIGUOUS_TAB_IDENTIFIER',
    )
  }

  async openProject(options: {
    projectPath?: string
    cwd: string
    waitSeconds?: number
    signal?: AbortSignal
  }): Promise<{
    detected: DetectedAppleProject
    connected: boolean
    xcodePid?: number
    tabIdentifier?: string
    openWindows: XcodeWindowInfo[]
    note?: string
  }> {
    const searchTarget = options.projectPath?.trim()
      ? resolve(options.cwd, options.projectPath.trim())
      : options.cwd
    const detected = await detectAppleProject(searchTarget)

    if (!this.bridgeCommand) {
      const env = await this.inspectEnvFn(options.signal)
      this.lastEnv = env
      if (!env.supportedPlatform || !env.bridge.available) {
        throw new XcodeError(env.bridge.reason ?? 'Xcode is not available on this host.', 'BRIDGE_UNAVAILABLE')
      }
      const appTarget = env.selectedXcodeAppPath ?? 'Xcode'
      await execFileAsync('open', ['-a', appTarget, detected.openTargetPath], {
        timeout: 10_000,
        ...(options.signal ? { signal: options.signal } : {}),
      })
    }

    const maxWaitMs = Math.min(60_000, Math.max(2_000, (options.waitSeconds ?? 20) * 1000))
    const deadline = Date.now() + maxWaitMs
    let lastErr: string | undefined

    while (Date.now() < deadline) {
      if (options.signal?.aborted) throw new XcodeError('xcode_open_project canceled', 'ABORTED')
      try {
        const windows = await this.listWindows({ signal: options.signal })
        if (windows.length > 0) {
          let tabId: string | undefined
          try {
            tabId = await this.resolveTabIdentifier({
              projectPath: detected.openTargetPath,
              signal: options.signal,
            })
          } catch {
            tabId = windows[0]?.tabIdentifier
          }
          await this.persistWorkbenchState(options.cwd).catch(() => {})
          return {
            detected,
            connected: true,
            ...(this.sessionPid !== undefined ? { xcodePid: this.sessionPid } : {}),
            ...(tabId ? { tabIdentifier: tabId } : {}),
            openWindows: windows,
          }
        }
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err)
      }
      await new Promise(r => setTimeout(r, this.bridgeCommand ? 50 : 1200))
    }

    await this.persistWorkbenchState(options.cwd).catch(() => {})
    return {
      detected,
      connected: false,
      ...(this.sessionPid !== undefined ? { xcodePid: this.sessionPid } : {}),
      openWindows: this.lastWindows,
      note: lastErr
        ?? 'Opened project in Xcode, waiting for MCP bridge authorization. Check Xcode for an external-agent permission prompt (Settings → Intelligence → Allow External Agents).',
    }
  }

  async diagnostics(options: {
    filePath?: string
    projectPath?: string
    tabIdentifier?: string
    severity?: string
    pattern?: string
    cwd: string
    signal?: AbortSignal
  }) {
    const session = await this.ensureSession({ signal: options.signal })
    const tools = await session.listTools({ signal: options.signal })
    const tabIdentifier = await this.resolveTabIdentifier({
      tabIdentifier: options.tabIdentifier,
      projectPath: options.projectPath ?? options.filePath ?? options.cwd,
      signal: options.signal,
    })

    let res: McpCallNormalizedResult
    let mode: 'file' | 'navigator' | 'build-log'
    if (options.filePath && tools.some(t => t.name === 'XcodeRefreshCodeIssuesInFile')) {
      mode = 'file'
      const absFile = resolve(options.cwd, options.filePath)
      res = await session.callTool(
        'XcodeRefreshCodeIssuesInFile',
        { tabIdentifier, filePath: absFile },
        { timeoutMs: 45_000, signal: options.signal },
      )
    } else if (tools.some(t => t.name === 'XcodeListNavigatorIssues')) {
      mode = 'navigator'
      res = await session.callTool(
        'XcodeListNavigatorIssues',
        {
          tabIdentifier,
          ...(options.severity ? { severity: options.severity } : {}),
          ...(options.pattern ? { pattern: options.pattern } : {}),
        },
        { timeoutMs: 30_000, signal: options.signal },
      )
    } else {
      mode = 'build-log'
      res = await session.callTool(
        'GetBuildLog',
        {
          tabIdentifier,
          ...(options.severity ? { severity: options.severity } : {}),
          ...(options.pattern ? { pattern: options.pattern } : {}),
        },
        { timeoutMs: 30_000, signal: options.signal },
      )
    }

    const items = extractDiagnosticItems(res)
    this.lastDiagnosticsState = {
      checkedAt: new Date().toISOString(),
      ...(options.filePath ? { target: options.filePath } : {}),
      items,
      rawText: res.text.slice(0, 8_000),
    }
    await this.persistWorkbenchState(options.cwd).catch(() => {})

    return {
      mode,
      tabIdentifier,
      issueCount: items.length,
      items,
      ...(res.structuredContent !== undefined ? { structured: res.structuredContent } : {}),
      text: res.text,
    }
  }

  async buildOrTest(options: {
    action: 'build' | 'build_log' | 'list_tests' | 'run_all_tests' | 'run_some_tests'
    tabIdentifier?: string
    projectPath?: string
    tests?: unknown[]
    severity?: string
    pattern?: string
    cwd: string
    signal?: AbortSignal
  }) {
    const session = await this.ensureSession({ signal: options.signal })
    const tabIdentifier = await this.resolveTabIdentifier({
      tabIdentifier: options.tabIdentifier,
      projectPath: options.projectPath ?? options.cwd,
      signal: options.signal,
    })

    const toolMap: Record<typeof options.action, string> = {
      build: 'BuildProject',
      build_log: 'GetBuildLog',
      list_tests: 'GetTestList',
      run_all_tests: 'RunAllTests',
      run_some_tests: 'RunSomeTests',
    }
    const rawTool = toolMap[options.action]
    const callArgs: Record<string, unknown> = { tabIdentifier }
    if (options.action === 'run_some_tests' && Array.isArray(options.tests)) {
      callArgs.tests = options.tests
    }
    if (options.action === 'build_log') {
      if (options.severity) callArgs.severity = options.severity
      if (options.pattern) callArgs.pattern = options.pattern
    }

    const res = await session.callTool(rawTool, callArgs, {
      timeoutMs: this.callTimeoutMs,
      signal: options.signal,
    })

    const issues = extractDiagnosticItems(res)
    const hasErrors = issues.some(i => i.severity === 'error') || /\bBUILD FAILED\b/iu.test(res.text)
    this.lastBuildState = {
      finishedAt: new Date().toISOString(),
      action: options.action,
      ok: !hasErrors,
      summary: res.text.slice(0, 600) || (res.structuredContent ? JSON.stringify(res.structuredContent).slice(0, 600) : 'Completed'),
    }
    await this.persistWorkbenchState(options.cwd).catch(() => {})

    return {
      action: options.action,
      tool: rawTool,
      tabIdentifier,
      ok: !hasErrors,
      issueCount: issues.length,
      issues: issues.slice(0, 50),
      ...(res.structuredContent !== undefined ? { structured: res.structuredContent } : {}),
      text: res.text,
    }
  }

  async renderPreview(options: {
    sourceFilePath: string
    previewDefinitionIndexInFile?: number
    tabIdentifier?: string
    projectPath?: string
    cwd: string
    signal?: AbortSignal
  }): Promise<{
    tabIdentifier: string
    sourceFilePath: string
    savedPreviews: SavedPreviewRecord[]
    images: McpDecodedImage[]
    text: string
    structured?: unknown
  }> {
    const session = await this.ensureSession({ signal: options.signal })
    const absSource = resolve(options.cwd, options.sourceFilePath)
    const tabIdentifier = await this.resolveTabIdentifier({
      tabIdentifier: options.tabIdentifier,
      projectPath: options.projectPath ?? absSource,
      signal: options.signal,
    })

    const args: Record<string, unknown> = {
      tabIdentifier,
      sourceFilePath: absSource,
    }
    if (options.previewDefinitionIndexInFile !== undefined) {
      args.previewDefinitionIndexInFile = options.previewDefinitionIndexInFile
    }

    const res = await session.callTool('RenderPreview', args, {
      timeoutMs: Math.max(120_000, this.callTimeoutMs),
      signal: options.signal,
    })

    const previewsDir = join(options.cwd, WORKBENCH_DIR_NAME, 'previews')
    await mkdir(previewsDir, { recursive: true })
    const saved: SavedPreviewRecord[] = []
    const stamp = Date.now()
    const baseSlug = basename(absSource).replace(/[^A-Za-z0-9._-]+/gu, '_')

    for (const [idx, img] of res.images.entries()) {
      const ext = img.mimeType === 'image/jpeg' ? 'jpg' : img.mimeType === 'image/webp' ? 'webp' : 'png'
      const fileName = `${stamp}-${idx}-${baseSlug}.${ext}`
      const absOut = join(previewsDir, fileName)
      await writeFile(absOut, img.bytes)
      const relOut = relative(options.cwd, absOut).split('\\').join('/')
      const rec: SavedPreviewRecord = {
        id: `${stamp}-${idx}`,
        sourceFilePath: absSource,
        relativeImagePath: relOut,
        absoluteImagePath: absOut,
        mimeType: img.mimeType,
        bytes: img.bytes.length,
        createdAt: new Date().toISOString(),
      }
      saved.push(rec)
    }

    if (saved.length > 0) {
      this.previewsHistory = [...saved, ...this.previewsHistory].slice(0, 12)
    }
    await this.persistWorkbenchState(options.cwd).catch(() => {})

    return {
      tabIdentifier,
      sourceFilePath: absSource,
      savedPreviews: saved,
      images: res.images,
      text: res.text,
      ...(res.structuredContent !== undefined ? { structured: res.structuredContent } : {}),
    }
  }

  async searchDocs(options: {
    query: string
    frameworks?: string[]
    signal?: AbortSignal
  }) {
    const session = await this.ensureSession({ signal: options.signal })
    const args: Record<string, unknown> = { query: options.query }
    if (options.frameworks && options.frameworks.length > 0) {
      args.frameworks = options.frameworks
    }
    const res = await session.callTool('DocumentationSearch', args, {
      timeoutMs: 30_000,
      signal: options.signal,
    })
    return {
      query: options.query,
      ...(res.structuredContent !== undefined ? { structured: res.structuredContent } : {}),
      text: res.text,
    }
  }

  async listOrCallRawTool(options: {
    action: 'list' | 'call'
    toolName?: string
    arguments?: Record<string, unknown>
    cwd?: string
    signal?: AbortSignal
  }) {
    const session = await this.ensureSession({ signal: options.signal })
    if (options.action === 'list') {
      const tools = await session.listTools({ refresh: true, signal: options.signal })
      this.lastTools = tools
      if (options.cwd) await this.persistWorkbenchState(options.cwd).catch(() => {})
      return {
        count: tools.length,
        tools: tools.map(t => ({
          name: t.name,
          description: t.description ?? '',
          inputSchema: t.inputSchema,
        })),
      }
    }

    if (!options.toolName || options.toolName.trim() === '') {
      throw new XcodeError('`toolName` is required when `action` is "call".', 'MISSING_TOOL_NAME')
    }

    const res = await session.callTool(options.toolName.trim(), options.arguments ?? {}, {
      timeoutMs: this.callTimeoutMs,
      signal: options.signal,
    })
    if (options.cwd) await this.persistWorkbenchState(options.cwd).catch(() => {})
    return res
  }

  async persistWorkbenchState(cwd: string): Promise<WorkbenchPersistedState> {
    const dir = join(cwd, WORKBENCH_DIR_NAME)
    await mkdir(dir, { recursive: true })
    const state: WorkbenchPersistedState = {
      updatedAt: new Date().toISOString(),
      ...(this.lastEnv?.xcodeVersion?.version ? { xcodeVersion: this.lastEnv.xcodeVersion.version } : {}),
      ...(this.lastEnv?.xcodeVersion?.build ? { xcodeBuild: this.lastEnv.xcodeVersion.build } : {}),
      connected: this.session?.isAlive === true,
      ...(this.sessionPid !== undefined ? { xcodePid: this.sessionPid } : {}),
      openWindows: this.lastWindows,
      availableTools: this.lastTools.map(t => t.name),
      exportedSkills: this.exportedSkillsList,
      iosPeer: readIosPeer(),
      ...(this.lastDiagnosticsState ? { lastDiagnostics: this.lastDiagnosticsState } : {}),
      ...(this.lastBuildState ? { lastBuild: this.lastBuildState } : {}),
      previews: this.previewsHistory,
      ...(this.lastErrorText ? { lastError: this.lastErrorText } : {}),
    }
    await writeFile(join(cwd, WORKBENCH_STATE_FILE), JSON.stringify(state, null, 2))
    return state
  }

  async dispose(): Promise<void> {
    if (this.session) {
      await this.session.close().catch(() => {})
      this.session = null
    }
  }
}
