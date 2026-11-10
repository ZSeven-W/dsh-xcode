#!/usr/bin/env node
/**
 * Standalone stdio Model Context Protocol (MCP) server for `@zseven-w/dsh-xcode`.
 *
 * Powers Codex (`codex plugin add dsh-xcode@zseven-xcode`), Claude Code
 * (`claude plugin install dsh-xcode@dsh-xcode`), Antigravity, and Grok CLI
 * using the exact same `XcodeBridgeController`, `xcrun mcpbridge` normalization,
 * and Apple `SKILL.md` exporter as the DSH host plugin.
 */

import { once } from 'node:events'
import { dirname, isAbsolute, resolve } from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import { fileURLToPath } from 'node:url'
import {
  XcodeBridgeController,
  type XcodeBridgeControllerOptions,
  type XcodeWindowInfo,
} from './bridge.ts'
import {
  defaultSkillsCacheRoot,
  exportAppleSkillsFromXcode,
  loadCachedAppleSkills,
} from './skills.ts'

export const MCP_SERVER_NAME = 'dsh-xcode'
export const MCP_SERVER_VERSION = '0.1.0-rc.3'
const MAX_MESSAGE_BYTES = 32 * 1024 * 1024

export interface McpToolSchema {
  name: string
  title?: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
    additionalProperties?: boolean
  }
  annotations?: {
    readOnlyHint?: boolean
    destructiveHint?: boolean
    idempotentHint?: boolean
    openWorldHint?: boolean
  }
}

const workspaceDirProperty = {
  type: 'string',
  description: 'Optional absolute workspace directory path for resolving relative project/file paths.',
}

export const MCP_XCODE_TOOLS: McpToolSchema[] = [
  {
    name: 'xcode_status',
    title: 'Xcode Bridge Status',
    description:
      'Inspect local Xcode installation, `xcrun mcpbridge` availability, running Xcode PIDs, open workspace '
      + 'windows (`tabIdentifier`s), exposed Xcode MCP tools, synced Apple `SKILL.md` skills, and `@zseven-w/dsh-ios` '
      + 'peer device status. Call this first when starting an Apple/iOS/macOS task.',
    inputSchema: {
      type: 'object',
      properties: {
        connect: {
          type: 'boolean',
          description: 'Connect to `xcrun mcpbridge` and query `XcodeListWindows` if Xcode is currently running. Default true.',
        },
        workspaceDir: workspaceDirProperty,
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'xcode_open_project',
    title: 'Open Project in Xcode',
    description:
      'Open an `.xcworkspace`, `.xcodeproj`, or `Package.swift` in Xcode (auto-detecting from the workspace '
      + 'when `projectPath` is omitted) and wait until `xcrun mcpbridge` connects and reports its `tabIdentifier`.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to `.xcworkspace`, `.xcodeproj`, `Package.swift`, or directory containing one (relative to workspace or absolute). Optional.',
        },
        waitSeconds: {
          type: 'integer',
          description: 'How long to wait (2–60 seconds) for Xcode to finish opening the window and establish MCP bridge access. Default 20.',
        },
        workspaceDir: workspaceDirProperty,
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'xcode_diagnostics',
    title: 'Xcode Live Diagnostics',
    description:
      'Read live compiler errors and warnings directly from Xcode without running a cold `xcodebuild`. '
      + 'Pass `filePath` for instant single-file typechecking (`XcodeRefreshCodeIssuesInFile`), or omit `filePath` '
      + 'to list workspace-wide Issue Navigator diagnostics (`XcodeListNavigatorIssues` / `GetBuildLog`).',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Optional source file path (`.swift`, `.m`, `.mm`, `.h`) to refresh & check issues in that single file without a full build.',
        },
        projectPath: {
          type: 'string',
          description: 'Optional `.xcodeproj` / `.xcworkspace` path when multiple Xcode windows are open.',
        },
        tabIdentifier: {
          type: 'string',
          description: 'Optional explicit Xcode `tabIdentifier` from `xcode_status`; auto-resolved when omitted.',
        },
        severity: {
          type: 'string',
          enum: ['error', 'warning', 'remark'],
          description: 'Optional minimum diagnostic severity filter.',
        },
        pattern: {
          type: 'string',
          description: 'Optional regex/substring filter over file path or diagnostic message.',
        },
        workspaceDir: workspaceDirProperty,
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'xcode_build_test',
    title: 'Xcode Build & Test',
    description:
      'Build the active Xcode scheme, read the latest build log, or discover/run XCTest & Swift Testing '
      + 'targets using Xcode\'s warm incremental build graph (`BuildProject`, `GetBuildLog`, `GetTestList`, '
      + '`RunAllTests`, `RunSomeTests`).',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['build', 'build_log', 'list_tests', 'run_all_tests', 'run_some_tests'],
          description: 'Operation to run in Xcode.',
        },
        tests: {
          type: 'string',
          description: 'For `run_some_tests`: JSON array string of test identifiers/specifiers as returned by `list_tests`.',
        },
        projectPath: {
          type: 'string',
          description: 'Optional `.xcodeproj` / `.xcworkspace` path when multiple Xcode windows are open.',
        },
        tabIdentifier: {
          type: 'string',
          description: 'Optional explicit Xcode `tabIdentifier`; auto-resolved when omitted.',
        },
        severity: {
          type: 'string',
          enum: ['error', 'warning', 'remark'],
          description: 'Optional filter for `build_log`.',
        },
        pattern: {
          type: 'string',
          description: 'Optional text/regex filter for `build_log`.',
        },
        workspaceDir: workspaceDirProperty,
      },
      required: ['action'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'xcode_render_preview',
    title: 'Render SwiftUI #Preview',
    description:
      'Render a SwiftUI `#Preview` or `PreviewProvider` snapshot natively inside Xcode (`RenderPreview`). '
      + 'Works for both `.xcodeproj`/`.xcworkspace` app targets and Swift packages, saves the PNG into `.dsh-xcode/previews/`, '
      + 'and returns the rendered image content block alongside metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceFilePath: {
          type: 'string',
          description: 'Path to the Swift file containing `#Preview` or `PreviewProvider` (relative to workspace or absolute).',
        },
        previewDefinitionIndexInFile: {
          type: 'integer',
          description: '0-based index of the `#Preview` declaration in the file when multiple previews exist. Default 0.',
        },
        projectPath: {
          type: 'string',
          description: 'Optional `.xcodeproj` / `.xcworkspace` path when multiple Xcode windows are open.',
        },
        tabIdentifier: {
          type: 'string',
          description: 'Optional explicit Xcode `tabIdentifier`; auto-resolved when omitted.',
        },
        workspaceDir: workspaceDirProperty,
      },
      required: ['sourceFilePath'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'xcode_search_docs',
    title: 'Search Apple Documentation',
    description:
      'Semantic search over Apple\'s official Developer Documentation and WWDC session transcripts built into '
      + 'the local Xcode installation (`DocumentationSearch`). Use this to verify modern SwiftUI / iOS / macOS APIs.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural-language or symbol search query (e.g. "NavigationSplitView columnVisibility SwiftUI").',
        },
        frameworks: {
          type: 'string',
          description: 'Optional comma-separated framework filter (e.g. "SwiftUI,Observation").',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'xcode_sync_skills',
    title: 'Sync Apple Xcode Skills',
    description:
      'Export Apple\'s built-in `SKILL.md` agent skill bundles from the active Xcode installation via '
      + '`xcrun agent skills export` and cache them locally.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceDir: workspaceDirProperty,
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'xcode_call_tool',
    title: 'Call Raw Xcode MCP Tool',
    description:
      'List or invoke any raw MCP tool exposed by `xcrun mcpbridge` (such as `ExecuteSnippet`, `XcodeRead`, '
      + '`XcodeWrite`, `XcodeUpdate`, `XcodeGlob`, `XcodeGrep`, or Xcode 27+ `DeviceInteraction*` tools).',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'call'],
          description: '"list" returns all raw tools & input schemas from `mcpbridge`; "call" executes `toolName`.',
        },
        toolName: {
          type: 'string',
          description: 'Raw Xcode MCP tool name when `action` is "call" (e.g. "ExecuteSnippet", "XcodeListWindows").',
        },
        argumentsJson: {
          type: 'string',
          description: 'JSON object string of arguments passed to `toolName` when `action` is "call".',
        },
        workspaceDir: workspaceDirProperty,
      },
      required: ['action'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
]

function isPluginCacheDir(dir: string): boolean {
  const normalized = dir.replace(/\\/gu, '/')
  return (
    normalized.includes('/.codex/plugins/')
    || normalized.includes('/.claude/plugins/')
    || normalized.endsWith('/plugins/xcode')
    || normalized.includes('/plugins/xcode/')
  )
}

export function resolveEffectiveWorkspaceDir(options: {
  workspaceDir?: unknown
  candidatePath?: unknown
  openWindows?: XcodeWindowInfo[]
  fallbackCwd?: string
}): string {
  const fallback = options.fallbackCwd ?? process.cwd()
  if (typeof options.workspaceDir === 'string' && options.workspaceDir.trim() !== '') {
    return resolve(fallback, options.workspaceDir.trim())
  }
  if (typeof options.candidatePath === 'string' && options.candidatePath.trim() !== '' && isAbsolute(options.candidatePath.trim())) {
    const abs = options.candidatePath.trim()
    if (isPluginCacheDir(fallback)) {
      return dirname(abs)
    }
  }
  if (isPluginCacheDir(fallback) && Array.isArray(options.openWindows) && options.openWindows.length > 0) {
    const activeWin = options.openWindows.find(w => w.active && w.workspacePath) ?? options.openWindows.find(w => w.workspacePath)
    if (activeWin?.workspacePath) {
      return dirname(activeWin.workspacePath)
    }
  }
  return fallback
}

export function jsonRpcError(id: string | number | null, code: number, message: string) {
  return { jsonrpc: '2.0' as const, id, error: { code, message } }
}

function formatToolResult(value: unknown, extraContent: Array<Record<string, unknown>> = []) {
  const structured = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : { result: value }
  return {
    content: [
      { type: 'text', text: JSON.stringify(value, null, 2) },
      ...extraContent,
    ],
    structuredContent: structured,
  }
}

export interface XcodeMcpServerOptions extends XcodeBridgeControllerOptions {
  skillsCacheDir?: string
  defaultCwd?: string
}

export class XcodeMcpServer {
  private readonly controller: XcodeBridgeController
  private readonly skillsCacheRoot: string
  private readonly defaultCwd: string
  private exportedSkills: string[] = []
  private hydratedSkills = false

  constructor(options: XcodeMcpServerOptions = {}) {
    this.controller = new XcodeBridgeController(options)
    this.skillsCacheRoot = options.skillsCacheDir ?? defaultSkillsCacheRoot()
    this.defaultCwd = options.defaultCwd ?? process.cwd()
  }

  private async maybeHydrateSkills(xcodeBuild?: string, xcodePid?: number): Promise<string[]> {
    const tag = (xcodeBuild ?? 'default').replace(/[^A-Za-z0-9._-]+/gu, '_')
    if (!this.hydratedSkills) {
      this.hydratedSkills = true
      const cached = await loadCachedAppleSkills(`${this.skillsCacheRoot}/${tag}`)
      if (cached.length > 0) {
        this.exportedSkills = cached.map(s => s.registeredName)
        this.controller.setExportedSkillNames(this.exportedSkills)
        return this.exportedSkills
      }
    }
    if (xcodePid !== undefined) {
      try {
        const exported = await exportAppleSkillsFromXcode({
          cacheRoot: this.skillsCacheRoot,
          xcodeBuild,
          xcodePid,
        })
        this.exportedSkills = exported.skills.map(s => s.registeredName)
        this.controller.setExportedSkillNames(this.exportedSkills)
      } catch {
        // Non-fatal opportunistic skill export.
      }
    }
    return this.exportedSkills
  }

  async executeTool(name: string, args: Record<string, unknown> = {}) {
    const statusSnapshot = await this.controller.status({ connectIfRunning: false }).catch(() => undefined)
    const cwd = resolveEffectiveWorkspaceDir({
      workspaceDir: args.workspaceDir,
      candidatePath: args.projectPath ?? args.filePath ?? args.sourceFilePath,
      openWindows: statusSnapshot?.openWindows,
      fallbackCwd: this.defaultCwd,
    })

    switch (name) {
      case 'xcode_status': {
        const stat = await this.controller.status({
          connectIfRunning: args.connect !== false,
          cwd,
        })
        const skills = await this.maybeHydrateSkills(stat.xcodeVersion?.build, stat.xcodePid)
        return formatToolResult({
          cwd,
          ...stat,
          exportedSkills: skills,
        })
      }

      case 'xcode_open_project': {
        const res = await this.controller.openProject({
          projectPath: typeof args.projectPath === 'string' ? args.projectPath : undefined,
          cwd,
          waitSeconds: typeof args.waitSeconds === 'number' ? args.waitSeconds : undefined,
        })
        if (res.connected) {
          const st = await this.controller.status({ connectIfRunning: false })
          await this.maybeHydrateSkills(st.xcodeVersion?.build, res.xcodePid)
        }
        return formatToolResult({ cwd, ...res })
      }

      case 'xcode_diagnostics': {
        const res = await this.controller.diagnostics({
          filePath: typeof args.filePath === 'string' ? args.filePath : undefined,
          projectPath: typeof args.projectPath === 'string' ? args.projectPath : undefined,
          tabIdentifier: typeof args.tabIdentifier === 'string' ? args.tabIdentifier : undefined,
          severity: typeof args.severity === 'string' ? args.severity : undefined,
          pattern: typeof args.pattern === 'string' ? args.pattern : undefined,
          cwd,
        })
        return formatToolResult({ cwd, ...res })
      }

      case 'xcode_build_test': {
        const action = String(args.action ?? '') as
          | 'build'
          | 'build_log'
          | 'list_tests'
          | 'run_all_tests'
          | 'run_some_tests'
        let parsedTests: unknown[] | undefined
        if (typeof args.tests === 'string' && args.tests.trim() !== '') {
          let parsed: unknown
          try {
            parsed = JSON.parse(args.tests)
          } catch {
            throw new Error('`tests` must be a JSON array of test specifiers from `list_tests`.')
          }
          if (!Array.isArray(parsed)) {
            throw new Error('`tests` must be a JSON array of test specifiers from `list_tests`.')
          }
          parsedTests = parsed
        } else if (Array.isArray(args.tests)) {
          parsedTests = args.tests
        }
        const res = await this.controller.buildOrTest({
          action,
          tests: parsedTests,
          projectPath: typeof args.projectPath === 'string' ? args.projectPath : undefined,
          tabIdentifier: typeof args.tabIdentifier === 'string' ? args.tabIdentifier : undefined,
          severity: typeof args.severity === 'string' ? args.severity : undefined,
          pattern: typeof args.pattern === 'string' ? args.pattern : undefined,
          cwd,
        })
        return formatToolResult({ cwd, ...res })
      }

      case 'xcode_render_preview': {
        const rendered = await this.controller.renderPreview({
          sourceFilePath: String(args.sourceFilePath ?? ''),
          ...(typeof args.previewDefinitionIndexInFile === 'number'
            ? { previewDefinitionIndexInFile: Math.trunc(args.previewDefinitionIndexInFile) }
            : {}),
          projectPath: typeof args.projectPath === 'string' ? args.projectPath : undefined,
          tabIdentifier: typeof args.tabIdentifier === 'string' ? args.tabIdentifier : undefined,
          cwd,
        })
        const summary = {
          cwd,
          tabIdentifier: rendered.tabIdentifier,
          sourceFilePath: rendered.sourceFilePath,
          previews: rendered.savedPreviews.map(p => ({
            file: p.relativeImagePath,
            absolutePath: p.absoluteImagePath,
            mimeType: p.mimeType,
            bytes: p.bytes,
          })),
          ...(rendered.text ? { text: rendered.text } : {}),
          ...(rendered.structured !== undefined ? { structured: rendered.structured } : {}),
        }
        const imageBlocks = rendered.images.map(img => ({
          type: 'image',
          data: img.bytes.toString('base64'),
          mimeType: img.mimeType,
        }))
        return formatToolResult(summary, imageBlocks)
      }

      case 'xcode_search_docs': {
        const frameworks = typeof args.frameworks === 'string' && args.frameworks.trim() !== ''
          ? args.frameworks.split(',').map(s => s.trim()).filter(Boolean)
          : Array.isArray(args.frameworks)
            ? args.frameworks.map(String)
            : undefined
        const res = await this.controller.searchDocs({
          query: String(args.query ?? ''),
          frameworks,
        })
        return formatToolResult(res)
      }

      case 'xcode_sync_skills': {
        const stat = await this.controller.status({ connectIfRunning: true })
        const exported = await exportAppleSkillsFromXcode({
          cacheRoot: this.skillsCacheRoot,
          xcodeBuild: stat.xcodeVersion?.build,
          xcodePid: stat.xcodePid,
        })
        this.exportedSkills = exported.skills.map(s => s.registeredName)
        this.controller.setExportedSkillNames(this.exportedSkills)
        await this.controller.persistWorkbenchState(cwd).catch(() => {})
        return formatToolResult({
          cwd,
          outputDir: exported.outputDir,
          count: exported.skills.length,
          skills: exported.skills.map(s => ({
            name: s.registeredName,
            title: s.title,
            description: s.description,
            skillFilePath: s.skillFilePath,
          })),
        })
      }

      case 'xcode_call_tool': {
        const action = args.action === 'list' ? 'list' : 'call'
        let parsedArgs: Record<string, unknown> = {}
        if (typeof args.argumentsJson === 'string' && args.argumentsJson.trim() !== '') {
          let parsed: unknown
          try {
            parsed = JSON.parse(args.argumentsJson)
          } catch {
            throw new Error('`argumentsJson` must be a valid JSON object string.')
          }
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('`argumentsJson` must decode to a JSON object.')
          }
          parsedArgs = parsed as Record<string, unknown>
        } else if (args.arguments && typeof args.arguments === 'object' && !Array.isArray(args.arguments)) {
          parsedArgs = args.arguments as Record<string, unknown>
        }
        if (action === 'call' && parsedArgs.tabIdentifier === undefined && args.toolName !== 'XcodeListWindows' && args.toolName !== 'DocumentationSearch') {
          try {
            parsedArgs.tabIdentifier = await this.controller.resolveTabIdentifier({ projectPath: cwd })
          } catch {
            // Leave omitted if tool does not require tabIdentifier.
          }
        }
        const res = await this.controller.listOrCallRawTool({
          action,
          toolName: typeof args.toolName === 'string' ? args.toolName : undefined,
          arguments: parsedArgs,
          cwd,
        })
        if (action === 'list') {
          return formatToolResult(res)
        }
        const callRes = res as { text: string; structuredContent?: unknown; isError?: boolean }
        return formatToolResult({
          toolName: args.toolName,
          isError: Boolean(callRes.isError),
          ...(callRes.structuredContent !== undefined ? { structured: callRes.structuredContent } : {}),
          text: callRes.text,
        })
      }

      default: {
        // Fallback: allow calling raw `xcrun mcpbridge` tool names directly.
        const rawArgs = { ...args }
        delete rawArgs.workspaceDir
        if (rawArgs.tabIdentifier === undefined && name !== 'XcodeListWindows' && name !== 'DocumentationSearch') {
          try {
            rawArgs.tabIdentifier = await this.controller.resolveTabIdentifier({ projectPath: cwd })
          } catch {
            // Ignore if tool doesn't use tabIdentifier.
          }
        }
        const res = await this.controller.listOrCallRawTool({
          action: 'call',
          toolName: name,
          arguments: rawArgs,
          cwd,
        })
        const callRes = res as { text: string; structuredContent?: unknown; isError?: boolean }
        return formatToolResult({
          toolName: name,
          isError: Boolean(callRes.isError),
          ...(callRes.structuredContent !== undefined ? { structured: callRes.structuredContent } : {}),
          text: callRes.text,
        })
      }
    }
  }

  async dispatch(message: unknown): Promise<Record<string, unknown> | null> {
    if (
      !message
      || typeof message !== 'object'
      || Array.isArray(message)
      || (message as Record<string, unknown>).jsonrpc !== '2.0'
      || typeof (message as Record<string, unknown>).method !== 'string'
    ) {
      return jsonRpcError(null, -32600, 'Expected a JSON-RPC 2.0 request or notification.')
    }

    const msg = message as {
      jsonrpc: '2.0'
      id?: string | number | null
      method: string
      params?: Record<string, unknown>
    }
    const hasId = Object.prototype.hasOwnProperty.call(msg, 'id')
    if (hasId && msg.id !== null && typeof msg.id !== 'string' && typeof msg.id !== 'number') {
      return jsonRpcError(null, -32600, 'Invalid JSON-RPC request id.')
    }
    const id = (msg.id ?? null) as string | number | null
    const reply = (result: unknown) => ({ jsonrpc: '2.0' as const, id, result })

    try {
      if (!hasId) {
        // Notification (`notifications/initialized`, `notifications/cancelled`, etc.)
        return null
      }

      switch (msg.method) {
        case 'initialize': {
          const requestedProtocol = typeof msg.params?.protocolVersion === 'string'
            ? msg.params.protocolVersion
            : '2025-06-18'
          return reply({
            protocolVersion: requestedProtocol,
            capabilities: {
              tools: { listChanged: true },
            },
            serverInfo: {
              name: MCP_SERVER_NAME,
              version: MCP_SERVER_VERSION,
            },
            instructions:
              'Apple Xcode MCP bridge (`xcrun mcpbridge`) with single-file live compiler diagnostics, '
              + 'native SwiftUI `#Preview` rendering, warm incremental scheme builds and tests, local Apple '
              + 'Developer Documentation search, automatic `tabIdentifier` routing, and Xcode 26 `structuredContent` normalization.',
          })
        }

        case 'ping':
          return reply({})

        case 'tools/list':
          return reply({ tools: MCP_XCODE_TOOLS })

        case 'resources/list':
          return reply({ resources: [] })

        case 'prompts/list':
          return reply({ prompts: [] })

        case 'tools/call': {
          const toolName = typeof msg.params?.name === 'string' ? msg.params.name.trim() : ''
          if (!toolName) {
            return jsonRpcError(id, -32602, 'Missing `params.name` in `tools/call`.')
          }
          const rawArgs = msg.params?.arguments
          const toolArgs = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
            ? (rawArgs as Record<string, unknown>)
            : {}
          const out = await this.executeTool(toolName, toolArgs)
          return reply(out)
        }

        default:
          return jsonRpcError(id, -32601, `Method not found: ${msg.method}`)
      }
    } catch (err) {
      if (!hasId) return null
      const messageText = err instanceof Error ? err.message : String(err)
      const code = (err as { code?: string })?.code
      if (msg.method === 'tools/call') {
        return reply({
          content: [{ type: 'text', text: messageText }],
          isError: true,
          ...(code ? { structuredContent: { error: messageText, code } } : {}),
        })
      }
      return jsonRpcError(id, -32000, messageText)
    }
  }

  async close(): Promise<void> {
    await this.controller.dispose()
  }
}

async function writeLine(payload: Record<string, unknown> | null): Promise<void> {
  if (!payload) return
  if (!process.stdout.write(`${JSON.stringify(payload)}\n`)) {
    await once(process.stdout, 'drain')
  }
}

export async function runStdioMcpServer(options: XcodeMcpServerOptions = {}): Promise<void> {
  const server = new XcodeMcpServer(options)
  const shutdown = () => {
    process.stdin.destroy()
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)

  const decoder = new StringDecoder('utf8')
  let buffer = ''
  let queue = Promise.resolve()

  try {
    for await (const chunk of process.stdin) {
      buffer += decoder.write(chunk as Buffer)
      let newlineIdx: number
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx)
        buffer = buffer.slice(newlineIdx + 1)
        if (Buffer.byteLength(line) > MAX_MESSAGE_BYTES) {
          throw new Error('MCP stdio input line exceeds the 32 MiB size limit.')
        }
        if (!line.trim()) continue
        let parsed: unknown
        try {
          parsed = JSON.parse(line)
        } catch {
          await writeLine(jsonRpcError(null, -32700, 'Invalid JSON on MCP stdio stream.'))
          continue
        }
        queue = queue.then(async () => {
          const response = await server.dispatch(parsed)
          await writeLine(response)
        })
        await queue
      }
      if (Buffer.byteLength(buffer) > MAX_MESSAGE_BYTES) {
        throw new Error('MCP stdio input buffer exceeds the 32 MiB size limit.')
      }
    }
    buffer += decoder.end()
    if (buffer.trim()) {
      await writeLine(jsonRpcError(null, -32700, 'MCP stdio messages must end with a newline.'))
    }
  } finally {
    process.off('SIGTERM', shutdown)
    process.off('SIGINT', shutdown)
    await server.close()
  }
}

const isMain = Boolean(
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url),
)

if (isMain) {
  const args = process.argv.slice(2)
  if (args.includes('--doctor')) {
    const server = new XcodeMcpServer()
    server
      .executeTool('xcode_status', { connect: true })
      .then(res => {
        process.stdout.write(`${JSON.stringify({ ok: true, status: res.structuredContent }, null, 2)}\n`)
        return server.close()
      })
      .catch(err => {
        process.stderr.write(`dsh-xcode doctor failed: ${err instanceof Error ? err.message : String(err)}\n`)
        process.exitCode = 1
        return server.close()
      })
  } else {
    runStdioMcpServer().catch(err => {
      process.stderr.write(`dsh-xcode mcp-server error: ${err instanceof Error ? err.message : String(err)}\n`)
      process.exitCode = 1
    })
  }
}
