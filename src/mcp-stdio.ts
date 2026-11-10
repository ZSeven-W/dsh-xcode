/**
 * Zero-dependency STDIO JSON-RPC 2.0 Model Context Protocol client tailored for
 * `xcrun mcpbridge`.
 *
 * Key design choices:
 * 1. Environment scrubbing: strips `*KEY*`, `*SECRET*`, `*TOKEN*`, `*PASSWORD*`,
 *    and `DSH_*` variables before spawning `mcpbridge`, while retaining macOS
 *    XPC/developer variables (`HOME`, `USER`, `TMPDIR`, `PATH`, `DEVELOPER_DIR`).
 * 2. Xcode 26 `structuredContent` compatibility: `mcpbridge` advertises
 *    `outputSchema` on tools like `XcodeListWindows` while placing JSON inside
 *    `content[0].text` and omitting `structuredContent` — which causes strict
 *    MCP SDK clients to reject valid responses. We normalize JSON text payloads
 *    into `structuredContent` automatically without failing.
 * 3. Canonical base64 image extraction: decodes MCP `image` blocks (`RenderPreview`)
 *    into verified `Buffer`s and strips multi-megabyte base64 strings from raw
 *    JSON text so model context stays compact.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline'
import { XcodeError } from './env.ts'

const DEFAULT_PROTOCOL_VERSION = '2025-06-18'
const HANDSHAKE_TIMEOUT_MS = 20_000
const DEFAULT_CALL_TIMEOUT_MS = 120_000
const MAX_LINE_BYTES = 64 * 1024 * 1024
const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_IMAGES_PER_RESULT = 6
const SENSITIVE_ENV_PATTERN = /KEY|PASSWORD|SECRET|TOKEN/iu
const CANONICAL_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u

export interface McpToolSchema {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
}

export interface McpDecodedImage {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
  bytes: Buffer
}

export interface McpCallNormalizedResult {
  tool: string
  text: string
  structuredContent?: unknown
  images: McpDecodedImage[]
  rawContent: unknown[]
}

export interface McpStdioSessionOptions {
  command?: string
  args?: string[]
  xcodePid?: number
  sessionId?: string
  handshakeTimeoutMs?: number
  defaultCallTimeoutMs?: number
  extraEnv?: Record<string, string>
  onToolsChanged?: () => void
  onClose?: (reason: string) => void
}

interface PendingRequest {
  method: string
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: NodeJS.Timeout
  cleanupAbort?: () => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Scrub sensitive & DSH-internal env vars while preserving macOS XPC essentials. */
export function scrubEnvForMcpBridge(
  sourceEnv: NodeJS.ProcessEnv = process.env,
  overrides: Record<string, string> = {},
): Record<string, string> {
  const clean: Record<string, string> = {}
  for (const [key, val] of Object.entries(sourceEnv)) {
    if (val === undefined) continue
    if (key.startsWith('DSH_')) continue
    if (SENSITIVE_ENV_PATTERN.test(key)) continue
    clean[key] = val
  }
  return { ...clean, ...overrides }
}

/** Translate cryptic `mcpbridge` stderr / XPC errors into actionable user steps. */
export function enrichMcpBridgeError(rawMessage: string, xcodePid?: number): XcodeError {
  const text = rawMessage.trim()
  if (/no running Xcode processes found|No running Xcode found/iu.test(text)) {
    return new XcodeError(
      'Xcode is not running. Call `xcode_open_project` first (or launch Xcode and open your project).',
      'XCODE_NOT_RUNNING',
    )
  }
  if (/multiple Xcode processes found/iu.test(text)) {
    return new XcodeError(
      `Multiple Xcode instances are running and \`mcpbridge\` could not pick one automatically: ${text}`,
      'MULTIPLE_XCODE_INSTANCES',
    )
  }
  if (/Could not connect to Xcode|IntelligenceToolUse|denied|not authorized|permission|timed out waiting for connection/iu.test(text)) {
    return new XcodeError(
      `Could not establish MCP tool session with Xcode${xcodePid ? ` (PID ${xcodePid})` : ''}: ${text}. `
      + 'Ensure a project window is open in Xcode and external agents are enabled under '
      + 'Xcode → Settings → Intelligence → Model Context Protocol (Allow External Agents). '
      + 'If Xcode is showing an agent permission dialog, click Allow.',
      'XCODE_PERMISSION_OR_SESSION',
    )
  }
  return new XcodeError(text || 'xcrun mcpbridge terminated unexpectedly', 'MCPBRIDGE_FAILED')
}

function decodeMcpImages(content: unknown[]): McpDecodedImage[] {
  const images: McpDecodedImage[] = []
  for (const block of content) {
    if (!isRecord(block) || block.type !== 'image') continue
    if (images.length >= MAX_IMAGES_PER_RESULT) {
      throw new XcodeError(`MCP tool returned more than ${MAX_IMAGES_PER_RESULT} images`, 'IMAGE_LIMIT')
    }
    const mimeType = block.mimeType
    const data = block.data
    if (
      typeof mimeType !== 'string'
      || !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mimeType)
    ) {
      throw new XcodeError(`Unsupported MCP image media type: ${String(mimeType)}`, 'IMAGE_MIME')
    }
    if (typeof data !== 'string' || data.length === 0 || !CANONICAL_BASE64.test(data)) {
      throw new XcodeError('MCP image block is not canonical base64', 'IMAGE_BASE64')
    }
    const bytes = Buffer.from(data, 'base64')
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
      throw new XcodeError(`MCP image size (${bytes.length} bytes) is out of bounds`, 'IMAGE_SIZE')
    }
    images.push({
      mimeType: mimeType as McpDecodedImage['mimeType'],
      bytes,
    })
  }
  return images
}

function stripLargeBase64Fields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripLargeBase64Fields)
  if (!isRecord(value)) return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    if ((k === 'data' || k === 'imageData' || k === 'pngBase64' || k === 'image_base64') && typeof v === 'string' && v.length > 512) {
      out[k] = `[binary base64 omitted: ${v.length} chars]`
      continue
    }
    out[k] = stripLargeBase64Fields(v)
  }
  return out
}

/**
 * Normalize a raw `tools/call` result envelope from `mcpbridge`, hydrating
 * `structuredContent` when Xcode 26 returns JSON inside `content[].text`.
 */
export function normalizeMcpCallResult(tool: string, rawResult: unknown): McpCallNormalizedResult {
  if (!isRecord(rawResult)) {
    throw new XcodeError(`Xcode MCP tool "${tool}" returned a non-object result`, 'MCP_INVALID_RESULT')
  }
  const rawContent = Array.isArray(rawResult.content) ? rawResult.content : []
  const textParts: string[] = []
  for (const item of rawContent) {
    if (!isRecord(item)) continue
    if (item.type === 'text' && typeof item.text === 'string') {
      textParts.push(item.text)
    } else if (item.type === 'resource_link' && typeof item.uri === 'string') {
      textParts.push(`Resource: ${typeof item.name === 'string' ? item.name : item.uri} (${item.uri})`)
    } else if (item.type === 'resource' && isRecord(item.resource) && typeof item.resource.text === 'string') {
      textParts.push(item.resource.text)
    }
  }
  const combinedText = textParts.join('\n')

  if (rawResult.isError === true) {
    throw new XcodeError(
      `Xcode tool "${tool}" reported an error${combinedText ? `: ${combinedText}` : ''}`,
      'XCODE_TOOL_ERROR',
    )
  }

  const images = decodeMcpImages(rawContent)

  let structuredContent: unknown = rawResult.structuredContent
  if (structuredContent === undefined && textParts.length === 1) {
    const trimmed = textParts[0]!.trim()
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        structuredContent = stripLargeBase64Fields(JSON.parse(trimmed))
      } catch {
        // Plain text that merely starts with `{` or `[` — keep as text.
      }
    }
  } else if (structuredContent !== undefined) {
    structuredContent = stripLargeBase64Fields(structuredContent)
  }

  const sanitizedContent = rawContent.map(block => {
    if (isRecord(block) && block.type === 'image') {
      return { type: 'image', mimeType: block.mimeType ?? 'image/png' }
    }
    return stripLargeBase64Fields(block)
  })

  return {
    tool,
    text: combinedText,
    ...(structuredContent !== undefined ? { structuredContent } : {}),
    images,
    rawContent: sanitizedContent,
  }
}

export class McpStdioSession {
  readonly sessionId: string
  readonly xcodePid: number | undefined
  private readonly command: string
  private readonly args: string[]
  private readonly handshakeTimeoutMs: number
  private readonly defaultCallTimeoutMs: number
  private readonly extraEnv: Record<string, string>
  private readonly onToolsChanged?: () => void
  private readonly onClose?: (reason: string) => void

  private child: ChildProcessWithoutNullStreams | null = null
  private nextId = 1
  private readonly pending = new Map<number, PendingRequest>()
  private stderrTail = ''
  private closed = false
  private serverInfo: Record<string, unknown> | undefined
  private instructions: string | undefined
  private cachedTools: McpToolSchema[] | null = null

  constructor(options: McpStdioSessionOptions = {}) {
    this.command = options.command ?? 'xcrun'
    this.args = options.args ?? ['mcpbridge']
    this.xcodePid = options.xcodePid
    this.sessionId = options.sessionId ?? randomUUID()
    this.handshakeTimeoutMs = options.handshakeTimeoutMs ?? HANDSHAKE_TIMEOUT_MS
    this.defaultCallTimeoutMs = options.defaultCallTimeoutMs ?? DEFAULT_CALL_TIMEOUT_MS
    this.extraEnv = options.extraEnv ?? {}
    this.onToolsChanged = options.onToolsChanged
    this.onClose = options.onClose
  }

  get isAlive(): boolean {
    return !this.closed && this.child !== null && this.child.exitCode === null && !this.child.killed
  }

  getServerInfo(): Record<string, unknown> | undefined {
    return this.serverInfo
  }

  getInstructions(): string | undefined {
    return this.instructions
  }

  async connect(signal?: AbortSignal): Promise<void> {
    if (this.closed) throw new XcodeError('MCP session is already disposed', 'SESSION_CLOSED')
    if (this.isAlive) return

    const overrides: Record<string, string> = {
      MCP_XCODE_SESSION_ID: this.sessionId,
      ...this.extraEnv,
    }
    if (this.xcodePid !== undefined) {
      overrides.MCP_XCODE_PID = String(this.xcodePid)
    }

    const child = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: scrubEnvForMcpBridge(process.env, overrides),
    })
    this.child = child

    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      this.stderrTail = (this.stderrTail + chunk).slice(-4096)
    })

    const rl = createInterface({ input: child.stdout, crlfDelay: Infinity })
    rl.on('line', (line: string) => {
      if (!line.trim()) return
      if (Buffer.byteLength(line, 'utf8') > MAX_LINE_BYTES) {
        this.failAll(new XcodeError('MCP response exceeded maximum frame size', 'FRAME_TOO_LARGE'))
        void this.close()
        return
      }
      this.handleLine(line)
    })

    child.on('error', (err: Error) => {
      const enriched = enrichMcpBridgeError(err.message, this.xcodePid)
      this.failAll(enriched)
      this.markClosed(enriched.message)
    })

    child.on('close', (code: number | null, sig: NodeJS.Signals | null) => {
      rl.close()
      const detail = this.stderrTail.trim() || `process exited (code=${String(code)}, signal=${String(sig)})`
      const enriched = enrichMcpBridgeError(detail, this.xcodePid)
      this.failAll(enriched)
      this.markClosed(enriched.message)
    })

    const initResult = await this.request(
      'initialize',
      {
        protocolVersion: DEFAULT_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: {
          name: '@zseven-w/dsh-xcode',
          version: '0.1.0-rc.4',
        },
      },
      this.handshakeTimeoutMs,
      signal,
    )

    if (isRecord(initResult)) {
      if (isRecord(initResult.serverInfo)) this.serverInfo = initResult.serverInfo
      if (typeof initResult.instructions === 'string' && initResult.instructions.trim() !== '') {
        this.instructions = initResult.instructions.trim()
      }
    }

    this.notify('notifications/initialized', {})
  }

  async listTools(options: { refresh?: boolean; signal?: AbortSignal } = {}): Promise<McpToolSchema[]> {
    if (!options.refresh && this.cachedTools !== null) {
      return this.cachedTools
    }
    const tools: McpToolSchema[] = []
    let cursor: string | undefined
    for (let page = 0; page < 20; page++) {
      const res = await this.request(
        'tools/list',
        cursor ? { cursor } : {},
        this.handshakeTimeoutMs,
        options.signal,
      )
      if (!isRecord(res) || !Array.isArray(res.tools)) break
      for (const item of res.tools) {
        if (!isRecord(item) || typeof item.name !== 'string' || !item.name) continue
        tools.push({
          name: item.name,
          ...(typeof item.description === 'string' ? { description: item.description } : {}),
          inputSchema: isRecord(item.inputSchema) ? item.inputSchema : { type: 'object', properties: {} },
          ...(isRecord(item.outputSchema) ? { outputSchema: item.outputSchema } : {}),
        })
      }
      cursor = typeof res.nextCursor === 'string' && res.nextCursor.length > 0 ? res.nextCursor : undefined
      if (!cursor) break
    }
    this.cachedTools = tools
    return tools
  }

  async callTool(
    name: string,
    args: Record<string, unknown> = {},
    options: { timeoutMs?: number; signal?: AbortSignal } = {},
  ): Promise<McpCallNormalizedResult> {
    const raw = await this.request(
      'tools/call',
      { name, arguments: args },
      options.timeoutMs ?? this.defaultCallTimeoutMs,
      options.signal,
    )
    return normalizeMcpCallResult(name, raw)
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    this.failAll(new XcodeError('MCP session closed', 'SESSION_CLOSED'))
    const child = this.child
    this.child = null
    if (!child || child.exitCode !== null) return
    await new Promise<void>(resolveDone => {
      const killTimer = setTimeout(() => {
        try { child.kill('SIGKILL') } catch {}
        resolveDone()
      }, 1500)
      child.once('close', () => {
        clearTimeout(killTimer)
        resolveDone()
      })
      try {
        child.stdin.end()
        child.kill('SIGTERM')
      } catch {
        clearTimeout(killTimer)
        resolveDone()
      }
    })
  }

  private notify(method: string, params?: Record<string, unknown>): void {
    if (!this.isAlive || !this.child) return
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      method,
      ...(params !== undefined ? { params } : {}),
    })
    this.child.stdin.write(`${payload}\n`)
  }

  private request(
    method: string,
    params: Record<string, unknown>,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (!this.isAlive || !this.child) {
      return Promise.reject(enrichMcpBridgeError(this.stderrTail || 'MCP session is not connected', this.xcodePid))
    }
    if (signal?.aborted) {
      return Promise.reject(new XcodeError(`Xcode MCP ${method} canceled`, 'ABORTED'))
    }

    const id = this.nextId++
    return new Promise<unknown>((resolveReq, rejectReq) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        cleanupAbort?.()
        this.notify('notifications/cancelled', { requestId: id, reason: 'timeout' })
        rejectReq(
          enrichMcpBridgeError(
            `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for Xcode MCP "${method}". ${this.stderrTail}`.trim(),
            this.xcodePid,
          ),
        )
      }, timeoutMs)

      let cleanupAbort: (() => void) | undefined
      if (signal) {
        const onAbort = () => {
          clearTimeout(timer)
          this.pending.delete(id)
          this.notify('notifications/cancelled', { requestId: id, reason: 'canceled' })
          rejectReq(new XcodeError(`Xcode MCP ${method} canceled`, 'ABORTED'))
        }
        signal.addEventListener('abort', onAbort, { once: true })
        cleanupAbort = () => signal.removeEventListener('abort', onAbort)
      }

      this.pending.set(id, {
        method,
        resolve: resolveReq,
        reject: rejectReq,
        timer,
        cleanupAbort,
      })

      const frame = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      })
      this.child!.stdin.write(`${frame}\n`, err => {
        if (err) {
          clearTimeout(timer)
          cleanupAbort?.()
          this.pending.delete(id)
          rejectReq(enrichMcpBridgeError(err.message, this.xcodePid))
        }
      })
    })
  }

  private handleLine(line: string): void {
    let msg: unknown
    try {
      msg = JSON.parse(line)
    } catch {
      return
    }
    if (!isRecord(msg)) return

    if (typeof msg.method === 'string' && msg.id === undefined) {
      if (msg.method === 'notifications/tools/list_changed') {
        this.cachedTools = null
        this.onToolsChanged?.()
      }
      return
    }

    // Respond cleanly if the server sends a JSON-RPC ping (`ping`).
    if (msg.method === 'ping' && (typeof msg.id === 'number' || typeof msg.id === 'string')) {
      if (this.isAlive && this.child) {
        this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: {} })}\n`)
      }
      return
    }

    if (typeof msg.id !== 'number') return
    const entry = this.pending.get(msg.id)
    if (!entry) return
    this.pending.delete(msg.id)
    clearTimeout(entry.timer)
    entry.cleanupAbort?.()

    if (isRecord(msg.error)) {
      const errText = typeof msg.error.message === 'string'
        ? msg.error.message
        : JSON.stringify(msg.error)
      entry.reject(enrichMcpBridgeError(`Xcode MCP ${entry.method} failed: ${errText}`, this.xcodePid))
      return
    }
    entry.resolve(msg.result)
  }

  private failAll(error: Error): void {
    for (const [id, entry] of this.pending.entries()) {
      clearTimeout(entry.timer)
      entry.cleanupAbort?.()
      entry.reject(error)
      this.pending.delete(id)
    }
  }

  private markClosed(reason: string): void {
    if (this.closed) return
    this.closed = true
    this.child = null
    this.onClose?.(reason)
  }
}
