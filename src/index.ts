/**
 * `@zseven-w/dsh-xcode` — DeepSeek Harness Host plugin for Apple's official
 * Xcode Model Context Protocol bridge (`xcrun mcpbridge`) & built-in Apple Skills.
 *
 * Exposes 8 stable model-facing tools (`xcode_status`, `xcode_open_project`,
 * `xcode_diagnostics`, `xcode_build_test`, `xcode_render_preview`,
 * `xcode_search_docs`, `xcode_sync_skills`, `xcode_call_tool`), registers the
 * `/xcode` sidebar RPC command, syncs Apple's exported `SKILL.md` bundles into
 * `ctx.skills`, and links peer state with `@zseven-w/dsh-ios`.
 */

import { basename } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  WORKBENCH_STATE_FILE,
  XcodeBridgeController,
  type XcodeBridgeControllerOptions,
} from './bridge.ts'
import {
  defaultSkillsCacheRoot,
  exportAppleSkillsFromXcode,
  loadCachedAppleSkills,
  mountXcodeSkills,
} from './skills.ts'
import { registerXcodePeer } from './peer-registry.ts'

export * from './peer-registry.ts'
export * from './env.ts'
export * from './mcp-stdio.ts'
export * from './bridge.ts'
export * from './skills.ts'

export const name = 'dsh-xcode'
export const inject = ['tools', 'workingDirectory']

export const XCODE_TOOL_NAMES = [
  'xcode_status',
  'xcode_open_project',
  'xcode_diagnostics',
  'xcode_build_test',
  'xcode_render_preview',
  'xcode_search_docs',
  'xcode_sync_skills',
  'xcode_call_tool',
] as const

export interface Config {
  /** Optional explicit running Xcode PID for `MCP_XCODE_PID`. */
  xcodePid?: number
  /** Default timeout (ms) for long-running Xcode MCP calls (`BuildProject`, `RunAllTests`, `RenderPreview`). Default 180000. */
  callTimeoutMs?: number
  /** Automatically export and register Apple's built-in `SKILL.md` bundles when `xcode_status` / `xcode_open_project` connects. Default true. */
  autoSyncSkills?: boolean
  /** Override cache root for exported Apple `SKILL.md` bundles. */
  skillsCacheDir?: string
}

const jsonSchema: any = { type: 'object', additionalProperties: true }

function presentation(kind: string, cwd: string, extra: Record<string, unknown> = {}) {
  return { xcodeWorkbench: 1, kind, cwd, stateFile: WORKBENCH_STATE_FILE, ...extra } as any
}

export function apply(ctx: any, config: Config = {}): () => Promise<void> {
  const controllerOpts: XcodeBridgeControllerOptions = {
    ...(config.xcodePid !== undefined ? { xcodePid: config.xcodePid } : {}),
    ...(config.callTimeoutMs !== undefined ? { callTimeoutMs: config.callTimeoutMs } : {}),
  }
  const controller = new XcodeBridgeController(controllerOpts)
  const skillManager = mountXcodeSkills(ctx)
  const skillsCacheRoot = config.skillsCacheDir ?? defaultSkillsCacheRoot()
  const autoSyncSkills = config.autoSyncSkills !== false

  let attachments: any
  ctx.inject(['attachments'], (child: any) => {
    attachments = child.attachments
    child.effect(() => () => { attachments = undefined })
  })

  const unregisterPeer = registerXcodePeer(() => controller.peerSnapshot())
  const disposers: Array<() => void | Promise<void>> = [unregisterPeer]

  async function resolveCwd(exec: any): Promise<string> {
    if (exec?.agent !== undefined && ctx.workingDirectory?.ensure) {
      return await ctx.workingDirectory.ensure(exec.agent, exec.signal)
    }
    return process.cwd()
  }

  async function seesImages(exec: any): Promise<boolean> {
    try {
      const routed = exec?.agent?.session?.requestHeader?.()?.config
      const provider = routed?.provider ?? exec?.agent?.options?.provider
      const model = routed?.model ?? exec?.agent?.options?.model
      const llm = ctx.get?.('llm')
      if (provider === undefined || model === undefined || llm === undefined) return false
      const info = await llm.resolveModelInfo(provider, model, exec.signal)
      return Array.isArray(info?.inputModalities) && info.inputModalities.includes('image')
    } catch {
      return false
    }
  }

  let initialSkillHydrated = false
  async function maybeHydrateCachedOrLiveSkills(xcodeBuild?: string, xcodePid?: number, signal?: AbortSignal): Promise<void> {
    const tag = (xcodeBuild ?? 'default').replace(/[^A-Za-z0-9._-]+/gu, '_')
    if (!initialSkillHydrated) {
      initialSkillHydrated = true
      const cached = await loadCachedAppleSkills(`${skillsCacheRoot}/${tag}`)
      if (cached.length > 0) {
        skillManager.registerExportedSkills(cached)
        controller.setExportedSkillNames(cached.map(s => s.registeredName))
        return
      }
    }
    if (!autoSyncSkills || xcodePid === undefined) return
    try {
      const exported = await exportAppleSkillsFromXcode({
        cacheRoot: skillsCacheRoot,
        xcodeBuild,
        xcodePid,
        signal,
      })
      skillManager.registerExportedSkills(exported.skills)
      controller.setExportedSkillNames(exported.skills.map(s => s.registeredName))
    } catch {
      // Optional opportunistic sync; never fail the main tool call.
    }
  }

  // 1. xcode_status
  disposers.push(ctx.effect(() => ctx.tools.register(defineTool({
    name: 'xcode_status',
    description: 'Inspect local Xcode installation, `xcrun mcpbridge` availability, running Xcode PIDs, open workspace '
      + 'windows (`tabIdentifier`s), exposed Xcode MCP tools, synced Apple `SKILL.md` skills, and `@zseven-w/dsh-ios` '
      + 'peer device status. Call this first when starting an Apple/iOS/macOS task.',
    parameters: {
      connect: {
        type: 'boolean',
        description: 'Connect to `xcrun mcpbridge` and query `XcodeListWindows` if Xcode is currently running. Default true.',
      },
    },
    isConcurrencySafe: () => true,
    output: {
      schema: jsonSchema,
      render: (_args: any, value: any) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      presentationMeta: (_args: any, value: any) => value?.cwd ? presentation('status', value.cwd, { connected: value.connected }) : undefined,
    },
    async execute(args: any, exec: any) {
      const cwd = await resolveCwd(exec)
      const stat = await controller.status({
        connectIfRunning: args?.connect !== false,
        cwd,
        signal: exec?.signal,
      })
      await maybeHydrateCachedOrLiveSkills(stat.xcodeVersion?.build, stat.xcodePid, exec?.signal)
      return {
        cwd,
        ...stat,
        exportedSkills: skillManager.registeredSkillNames(),
      }
    },
  })), 'dsh-xcode:xcode_status'))

  // 2. xcode_open_project
  disposers.push(ctx.effect(() => ctx.tools.register(defineTool({
    name: 'xcode_open_project',
    description: 'Open an `.xcworkspace`, `.xcodeproj`, or `Package.swift` in Xcode (auto-detecting from the workspace '
      + 'when `projectPath` is omitted) and wait until `xcrun mcpbridge` connects and reports its `tabIdentifier`.',
    parameters: {
      projectPath: {
        type: 'string',
        description: 'Path to `.xcworkspace`, `.xcodeproj`, `Package.swift`, or directory containing one (relative to workspace or absolute). Optional.',
      },
      waitSeconds: {
        type: 'integer',
        description: 'How long to wait (2–60 seconds) for Xcode to finish opening the window and establish MCP bridge access. Default 20.',
      },
    },
    timeoutMs: 90_000,
    output: {
      schema: jsonSchema,
      render: (_args: any, value: any) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      presentationMeta: (_args: any, value: any) => value?.cwd ? presentation('open', value.cwd, { connected: value.connected }) : undefined,
    },
    async execute(args: any, exec: any) {
      const cwd = await resolveCwd(exec)
      const res = await controller.openProject({
        projectPath: args?.projectPath,
        cwd,
        waitSeconds: typeof args?.waitSeconds === 'number' ? args.waitSeconds : undefined,
        signal: exec?.signal,
      })
      if (res.connected) {
        const st = await controller.status({ connectIfRunning: false, signal: exec?.signal })
        await maybeHydrateCachedOrLiveSkills(st.xcodeVersion?.build, res.xcodePid, exec?.signal)
      }
      return { cwd, ...res }
    },
  })), 'dsh-xcode:xcode_open_project'))

  // 3. xcode_diagnostics
  disposers.push(ctx.effect(() => ctx.tools.register(defineTool({
    name: 'xcode_diagnostics',
    description: 'Read live compiler errors and warnings directly from Xcode without running a cold `xcodebuild`. '
      + 'Pass `filePath` for instant single-file typechecking (`XcodeRefreshCodeIssuesInFile`), or omit `filePath` '
      + 'to list workspace-wide Issue Navigator diagnostics (`XcodeListNavigatorIssues` / `GetBuildLog`).',
    parameters: {
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
    },
    isConcurrencySafe: () => true,
    timeoutMs: 90_000,
    output: {
      schema: jsonSchema,
      render: (_args: any, value: any) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      presentationMeta: (_args: any, value: any) => value?.cwd ? presentation('diagnostics', value.cwd, { issueCount: value.issueCount }) : undefined,
    },
    async execute(args: any, exec: any) {
      const cwd = await resolveCwd(exec)
      const res = await controller.diagnostics({
        filePath: args?.filePath,
        projectPath: args?.projectPath,
        tabIdentifier: args?.tabIdentifier,
        severity: args?.severity,
        pattern: args?.pattern,
        cwd,
        signal: exec?.signal,
      })
      return { cwd, ...res }
    },
  })), 'dsh-xcode:xcode_diagnostics'))

  // 4. xcode_build_test
  disposers.push(ctx.effect(() => ctx.tools.register(defineTool({
    name: 'xcode_build_test',
    description: 'Build the active Xcode scheme, read the latest build log, or discover/run XCTest & Swift Testing '
      + 'targets using Xcode\'s warm incremental build graph (`BuildProject`, `GetBuildLog`, `GetTestList`, '
      + '`RunAllTests`, `RunSomeTests`).',
    parameters: {
      action: {
        type: 'string',
        required: true,
        enum: ['build', 'build_log', 'list_tests', 'run_all_tests', 'run_some_tests'],
        description: 'Operation to run in Xcode.',
      },
      tests: {
        type: 'string',
        description: 'For `run_some_tests`: JSON array of test identifiers/specifiers as returned by `list_tests`.',
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
    },
    timeoutMs: 300_000,
    output: {
      schema: jsonSchema,
      render: (_args: any, value: any) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      presentationMeta: (_args: any, value: any) => value?.cwd ? presentation('build', value.cwd, { ok: value.ok, action: value.action }) : undefined,
    },
    async execute(args: any, exec: any) {
      const cwd = await resolveCwd(exec)
      let parsedTests: unknown[] | undefined
      if (typeof args?.tests === 'string' && args.tests.trim() !== '') {
        try {
          const val = JSON.parse(args.tests)
          if (!Array.isArray(val)) throw new Error('not an array')
          parsedTests = val
        } catch {
          throw new Error('`tests` must be a JSON array of test specifiers from `list_tests`.')
        }
      } else if (Array.isArray(args?.tests)) {
        parsedTests = args.tests
      }
      const res = await controller.buildOrTest({
        action: args.action,
        tests: parsedTests,
        projectPath: args?.projectPath,
        tabIdentifier: args?.tabIdentifier,
        severity: args?.severity,
        pattern: args?.pattern,
        cwd,
        signal: exec?.signal,
      })
      return { cwd, ...res }
    },
  })), 'dsh-xcode:xcode_build_test'))

  // 5. xcode_render_preview
  disposers.push(ctx.effect(() => ctx.tools.register(defineTool({
    name: 'xcode_render_preview',
    description: 'Render a SwiftUI `#Preview` or `PreviewProvider` snapshot natively inside Xcode (`RenderPreview`). '
      + 'Works for both `.xcodeproj`/`.xcworkspace` app targets and Swift packages, saves the PNG into `.dsh-xcode/previews/` '
      + 'for the Xcode Workbench sidebar, and attaches the rendered image to model context when multimodal input is supported.',
    parameters: {
      sourceFilePath: {
        type: 'string',
        required: true,
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
    },
    timeoutMs: 240_000,
    output: {
      schema: jsonSchema,
      render: (_args: any, value: any) => [
        { type: 'text', text: JSON.stringify(value.summary, null, 2) },
        ...(value.attachments ?? []).flatMap((item: any) => [
          { type: 'text', text: `SwiftUI Preview (${item.name}):` },
          { type: 'image', attachment: item.attachment },
        ]),
      ],
      presentationMeta: (_args: any, value: any) => value?.summary?.cwd
        ? presentation('preview', value.summary.cwd, { previewCount: value.summary.previews?.length ?? 0 })
        : undefined,
    },
    async execute(args: any, exec: any) {
      const cwd = await resolveCwd(exec)
      const rendered = await controller.renderPreview({
        sourceFilePath: String(args.sourceFilePath),
        ...(typeof args?.previewDefinitionIndexInFile === 'number'
          ? { previewDefinitionIndexInFile: Math.trunc(args.previewDefinitionIndexInFile) }
          : {}),
        projectPath: args?.projectPath,
        tabIdentifier: args?.tabIdentifier,
        cwd,
        signal: exec?.signal,
      })

      const attachedImages: Array<{ name: string; attachment: unknown }> = []
      if (attachments !== undefined && rendered.images.length > 0 && await seesImages(exec)) {
        const limits = attachments.imageLimits ?? {}
        let budget = Math.min(limits.maxImageBytes ?? Infinity, limits.maxMessageImageBytes ?? Infinity)
        for (const [idx, img] of rendered.images.entries()) {
          if (img.bytes.byteLength > budget) continue
          try {
            const name = rendered.savedPreviews[idx]
              ? basename(rendered.savedPreviews[idx]!.absoluteImagePath)
              : `preview-${idx}.png`
            const savedAtt = await attachments.saveImage({
              data: new Uint8Array(img.bytes),
              mediaType: img.mimeType,
              name,
            })
            attachedImages.push({ name, attachment: savedAtt })
            budget -= img.bytes.byteLength
          } catch {
            // Saved file path in `.dsh-xcode/previews/` remains available even if attachment admission declines.
          }
        }
      }

      return {
        summary: {
          cwd,
          tabIdentifier: rendered.tabIdentifier,
          sourceFilePath: rendered.sourceFilePath,
          previews: rendered.savedPreviews.map(p => ({
            file: p.relativeImagePath,
            mimeType: p.mimeType,
            bytes: p.bytes,
          })),
          ...(rendered.text ? { text: rendered.text } : {}),
          ...(rendered.structured !== undefined ? { structured: rendered.structured } : {}),
        },
        attachments: attachedImages,
      }
    },
  })), 'dsh-xcode:xcode_render_preview'))

  // 6. xcode_search_docs
  disposers.push(ctx.effect(() => ctx.tools.register(defineTool({
    name: 'xcode_search_docs',
    description: 'Semantic search over Apple\'s official Developer Documentation and WWDC session transcripts built into '
      + 'the local Xcode installation (`DocumentationSearch`). Use this to verify modern SwiftUI / iOS / macOS APIs.',
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: 'Natural-language or symbol search query (e.g. "NavigationSplitView columnVisibility SwiftUI").',
      },
      frameworks: {
        type: 'string',
        description: 'Optional comma-separated framework filter (e.g. "SwiftUI,Observation").',
      },
    },
    isConcurrencySafe: () => true,
    timeoutMs: 45_000,
    output: {
      schema: jsonSchema,
      render: (_args: any, value: any) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args: any, exec: any) {
      const frameworks = typeof args?.frameworks === 'string' && args.frameworks.trim() !== ''
        ? args.frameworks.split(',').map((s: string) => s.trim()).filter(Boolean)
        : undefined
      return await controller.searchDocs({
        query: String(args.query),
        frameworks,
        signal: exec?.signal,
      })
    },
  })), 'dsh-xcode:xcode_search_docs'))

  // 7. xcode_sync_skills
  disposers.push(ctx.effect(() => ctx.tools.register(defineTool({
    name: 'xcode_sync_skills',
    description: 'Export Apple\'s built-in `SKILL.md` agent skill bundles from the active Xcode installation via '
      + '`xcrun agent skills export`, cache them locally, and register them into the active DSH session.',
    parameters: {},
    timeoutMs: 45_000,
    output: {
      schema: jsonSchema,
      render: (_args: any, value: any) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      presentationMeta: (_args: any, value: any) => value?.cwd ? presentation('skills', value.cwd, { count: value.count }) : undefined,
    },
    async execute(_args: any, exec: any) {
      const cwd = await resolveCwd(exec)
      const stat = await controller.status({ connectIfRunning: true, signal: exec?.signal })
      const exported = await exportAppleSkillsFromXcode({
        cacheRoot: skillsCacheRoot,
        xcodeBuild: stat.xcodeVersion?.build,
        xcodePid: stat.xcodePid,
        signal: exec?.signal,
      })
      const registeredCount = skillManager.registerExportedSkills(exported.skills)
      controller.setExportedSkillNames(exported.skills.map(s => s.registeredName))
      await controller.persistWorkbenchState(cwd).catch(() => {})
      return {
        cwd,
        outputDir: exported.outputDir,
        count: exported.skills.length,
        registeredInDsh: registeredCount,
        skills: exported.skills.map(s => ({
          name: s.registeredName,
          title: s.title,
          description: s.description,
        })),
      }
    },
  })), 'dsh-xcode:xcode_sync_skills'))

  // 8. xcode_call_tool
  disposers.push(ctx.effect(() => ctx.tools.register(defineTool({
    name: 'xcode_call_tool',
    description: 'List or invoke any raw MCP tool exposed by `xcrun mcpbridge` (such as `ExecuteSnippet`, `XcodeRead`, '
      + '`XcodeWrite`, `XcodeUpdate`, `XcodeGlob`, `XcodeGrep`, or Xcode 27+ `DeviceInteraction*` tools).',
    parameters: {
      action: {
        type: 'string',
        required: true,
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
    },
    isConcurrencySafe: (args: any) => args?.action === 'list',
    timeoutMs: 240_000,
    output: {
      schema: jsonSchema,
      render: (_args: any, value: any) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args: any, exec: any) {
      const cwd = await resolveCwd(exec)
      let parsedArgs: Record<string, unknown> = {}
      if (typeof args?.argumentsJson === 'string' && args.argumentsJson.trim() !== '') {
        let parsed: unknown
        try { parsed = JSON.parse(args.argumentsJson) } catch {
          throw new Error('`argumentsJson` must be a valid JSON object string.')
        }
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('`argumentsJson` must decode to a JSON object.')
        }
        parsedArgs = parsed as Record<string, unknown>
      }
      const res = await controller.listOrCallRawTool({
        action: args.action,
        toolName: args?.toolName,
        arguments: parsedArgs,
        cwd,
        signal: exec?.signal,
      })
      if (args.action === 'list') return res
      const callRes = res as Awaited<ReturnType<XcodeBridgeController['listOrCallRawTool']>> & {
        text?: string
        structuredContent?: unknown
        images?: Array<{ mimeType: string; bytes: Buffer }>
      }
      return {
        tool: args.toolName,
        ...(callRes.structuredContent !== undefined ? { structured: callRes.structuredContent } : {}),
        text: callRes.text ?? '',
        imageCount: Array.isArray(callRes.images) ? callRes.images.length : 0,
      }
    },
  })), 'dsh-xcode:xcode_call_tool'))

  // Sidebar RPC command: `/xcode <status|open|diagnostics|build|sync-skills> [json]`
  ctx.inject(['commands'], (child: any) => {
    child.commands.register({
      name: 'xcode',
      description: 'Xcode Workbench sidebar actions (status, open, diagnostics, build, sync-skills)',
      input: { hint: '<status|open|diagnostics|build|sync-skills> [json]' },
      async handler({ agent, rawInput }: any) {
        try {
          const input = String(rawInput ?? '').trim()
          const space = input.search(/\s/u)
          const action = (space < 0 ? input : input.slice(0, space)) || 'status'
          const payload = space < 0 ? {} : JSON.parse(input.slice(space + 1))
          const cwd = typeof payload.cwd === 'string' && payload.cwd.trim() !== ''
            ? payload.cwd.trim()
            : await ctx.workingDirectory.ensure(agent)

          if (action === 'status') {
            const st = await controller.status({ connectIfRunning: true, cwd })
            await maybeHydrateCachedOrLiveSkills(st.xcodeVersion?.build, st.xcodePid)
            const persisted = await controller.persistWorkbenchState(cwd)
            return { kind: 'success', text: JSON.stringify({ cwd, state: persisted, status: st }) }
          }
          if (action === 'open') {
            const opened = await controller.openProject({ projectPath: payload.projectPath, cwd })
            const persisted = await controller.persistWorkbenchState(cwd)
            return { kind: 'success', text: JSON.stringify({ cwd, opened, state: persisted }) }
          }
          if (action === 'diagnostics') {
            const diag = await controller.diagnostics({
              filePath: payload.filePath,
              tabIdentifier: payload.tabIdentifier,
              cwd,
            })
            const persisted = await controller.persistWorkbenchState(cwd)
            return { kind: 'success', text: JSON.stringify({ cwd, diagnostics: diag, state: persisted }) }
          }
          if (action === 'build') {
            const built = await controller.buildOrTest({
              action: 'build',
              tabIdentifier: payload.tabIdentifier,
              cwd,
            })
            const persisted = await controller.persistWorkbenchState(cwd)
            return { kind: 'success', text: JSON.stringify({ cwd, build: built, state: persisted }) }
          }
          if (action === 'sync-skills') {
            const st = await controller.status({ connectIfRunning: true, cwd })
            const exported = await exportAppleSkillsFromXcode({
              cacheRoot: skillsCacheRoot,
              xcodeBuild: st.xcodeVersion?.build,
              xcodePid: st.xcodePid,
            })
            skillManager.registerExportedSkills(exported.skills)
            controller.setExportedSkillNames(exported.skills.map(s => s.registeredName))
            const persisted = await controller.persistWorkbenchState(cwd)
            return { kind: 'success', text: JSON.stringify({ cwd, count: exported.skills.length, state: persisted }) }
          }
          return { kind: 'error', text: `Unknown /xcode action "${action}"` }
        } catch (error) {
          return { kind: 'error', text: error instanceof Error ? error.message : String(error) }
        }
      },
    })
  })

  ctx.logger?.info?.(`dsh-xcode mounted (${XCODE_TOOL_NAMES.join(' + ')})`)

  return async () => {
    for (const dispose of disposers.reverse()) {
      await dispose()
    }
    skillManager.dispose()
    await controller.dispose()
  }
}
