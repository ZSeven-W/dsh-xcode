import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  detectAppleProject,
  parseRunningXcodeProcesses,
  parseXcodebuildVersion,
  pickXcodePid,
  xcodeAppFromDeveloperDir,
} from '../src/env.ts'
import {
  extractDiagnosticItems,
  parseXcodeWindows,
  WORKBENCH_STATE_FILE,
  XcodeBridgeController,
} from '../src/bridge.ts'
import {
  exportAppleSkillsFromXcode,
  loadCachedAppleSkills,
  parseSkillMarkdown,
} from '../src/skills.ts'
import {
  readIosPeer,
  readXcodePeer,
  registerIosPeer,
  registerXcodePeer,
} from '../src/peer-registry.ts'

// Provide `@deepseek-ai/dsh-tools` when testing host plugin entry outside a full DSH host process.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@deepseek-ai/dsh-tools') {
      return {
        shortCircuit: true,
        url: 'data:text/javascript,export function defineTool(def){return def;}',
      }
    }
    return nextResolve(specifier, context)
  },
})

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const mockBridge = join(root, 'test/fixtures/mock-mcpbridge.mjs')

test('Xcode environment parsers accurately distinguish Xcode.app from Simulator and helpers', () => {
  assert.equal(
    xcodeAppFromDeveloperDir('/Applications/Xcode-26.6.app/Contents/Developer/'),
    '/Applications/Xcode-26.6.app',
  )
  assert.deepEqual(
    parseXcodebuildVersion('Xcode 26.6\nBuild version 17F113\n'),
    { version: '26.6', build: '17F113' },
  )

  const psSample = [
    '14147 /Applications/Xcode.app/Contents/Developer/Applications/Simulator.app/Contents/MacOS/Simulator',
    '22901 /Applications/Xcode.app/Contents/MacOS/Xcode',
    '22950 /Applications/Xcode.app/Contents/SharedFrameworks/XCBuild.framework/Versions/A/PlugIns/XCBBuildService.bundle/Contents/MacOS/XCBBuildService',
    '31002 /Applications/Xcode-beta.app/Contents/MacOS/Xcode',
  ].join('\n')

  const running = parseRunningXcodeProcesses(psSample)
  assert.deepEqual(running, [
    {
      pid: 22901,
      executablePath: '/Applications/Xcode.app/Contents/MacOS/Xcode',
      appBundlePath: '/Applications/Xcode.app',
    },
    {
      pid: 31002,
      executablePath: '/Applications/Xcode-beta.app/Contents/MacOS/Xcode',
      appBundlePath: '/Applications/Xcode-beta.app',
    },
  ])

  assert.deepEqual(
    pickXcodePid({ running, selectedAppPath: '/Applications/Xcode-beta.app' }),
    { pid: 31002, source: 'xcode-select' },
  )
  assert.deepEqual(
    pickXcodePid({ explicitPid: 9999, running }),
    { pid: 9999, source: 'explicit' },
  )
  assert.equal(pickXcodePid({ running: [] }).pid, undefined)
})

test('detectAppleProject prioritizes .xcworkspace > .xcodeproj > Package.swift and unwraps nested project.xcworkspace', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-xcode-detect-'))
  try {
    // 1. Nested `App.xcodeproj/project.xcworkspace` resolves to `App.xcodeproj`
    const nestedWs = join(dir, 'Solo', 'Solo.xcodeproj', 'project.xcworkspace')
    await mkdir(nestedWs, { recursive: true })
    const solo = await detectAppleProject(nestedWs)
    assert.equal(solo.kind, 'xcodeproj')
    assert.equal(solo.name, 'Solo')
    assert.ok(solo.openTargetPath.endsWith('Solo.xcodeproj'))

    // 2. Directory containing both `.xcworkspace` and `.xcodeproj` picks `.xcworkspace`
    const combo = join(dir, 'Combo')
    await mkdir(join(combo, 'Combo.xcodeproj'), { recursive: true })
    await mkdir(join(combo, 'Combo.xcworkspace'), { recursive: true })
    const detectedCombo = await detectAppleProject(combo)
    assert.equal(detectedCombo.kind, 'xcworkspace')
    assert.equal(detectedCombo.name, 'Combo')

    // 3. Monorepo 1-level subdirectory (`ios/Mobile.xcodeproj`)
    const mono = join(dir, 'Monorepo')
    await mkdir(join(mono, 'ios', 'Mobile.xcodeproj'), { recursive: true })
    const detectedMono = await detectAppleProject(mono)
    assert.equal(detectedMono.kind, 'xcodeproj')
    assert.equal(detectedMono.name, 'Mobile')

    // 4. SwiftPM `Package.swift`
    const spm = join(dir, 'MyKit')
    await mkdir(spm, { recursive: true })
    await writeFile(join(spm, 'Package.swift'), '// swift-tools-version: 6.0\n')
    const detectedSpm = await detectAppleProject(spm)
    assert.equal(detectedSpm.kind, 'swiftpm')
    assert.equal(detectedSpm.name, 'MyKit')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('parseXcodeWindows and extractDiagnosticItems handle both JSON and text formats', () => {
  const textWins = parseXcodeWindows({
    text: '* tabIdentifier: tab_1, workspacePath: /Users/dev/App/App.xcodeproj\n* tabIdentifier: tab_2, workspacePath: /Users/dev/Pkg/Package.swift',
  })
  assert.equal(textWins.length, 2)
  assert.equal(textWins[0].tabIdentifier, 'tab_1')
  assert.equal(textWins[1].workspacePath, '/Users/dev/Pkg/Package.swift')

  const diags = extractDiagnosticItems({
    text: '/Users/dev/App/ContentView.swift:42:13: error: cannot convert value of type Int to String\n/Users/dev/App/ContentView.swift:50:5: warning: unused variable',
  })
  assert.equal(diags.length, 2)
  assert.equal(diags[0].severity, 'error')
  assert.equal(diags[0].line, 42)
  assert.equal(diags[1].severity, 'warning')
})

test('XcodeBridgeController orchestrates windows, diagnostics, build/test, preview snapshots, docs, and peer state', async () => {
  const workspaceDir = await mkdtemp(join(tmpdir(), 'dsh-xcode-ctrl-'))
  const unregisterIos = registerIosPeer(() => ({
    version: '0.1.0-rc.10',
    online: true,
    streamedDevice: { udid: 'SIM-UDID-1', name: 'iPhone 17 Pro', kind: 'simulator' },
    serveSimSource: 'package-bin',
    wdaAvailable: true,
  }))

  const controller = new XcodeBridgeController({
    xcodePid: 4321,
    bridgeCommand: process.execPath,
    bridgeArgs: [mockBridge],
    inspectEnv: async () => ({
      platform: 'darwin',
      supportedPlatform: true,
      developerDir: '/Applications/Xcode.app/Contents/Developer',
      selectedXcodeAppPath: '/Applications/Xcode.app',
      xcodeVersion: { version: '26.6', build: '17F113' },
      bridge: {
        available: true,
        mcpbridgePath: '/Applications/Xcode.app/Contents/Developer/usr/bin/mcpbridge',
        supportsSkillsExport: true,
        supportsPluginPath: false,
      },
      runningXcodes: [
        {
          pid: 4321,
          executablePath: '/Applications/Xcode.app/Contents/MacOS/Xcode',
          appBundlePath: '/Applications/Xcode.app',
        },
      ],
    }),
  })

  try {
    const status = await controller.status({ cwd: workspaceDir })
    assert.equal(status.connected, true)
    assert.equal(status.openWindows.length, 2)
    assert.equal(status.iosPeer?.streamedDevice?.name, 'iPhone 17 Pro')

    // Auto-resolve `tabIdentifier` by matching path inside AlphaApp vs BetaWorkspace
    const alphaTab = await controller.resolveTabIdentifier({
      projectPath: '/tmp/AlphaApp/Sources/HomeView.swift',
    })
    assert.equal(alphaTab, 'windowtab-alpha')

    const betaTab = await controller.resolveTabIdentifier({
      projectPath: '/tmp/BetaWorkspace/Beta.xcworkspace',
    })
    assert.equal(betaTab, 'windowtab-beta')

    // Single-file diagnostics (`XcodeRefreshCodeIssuesInFile`)
    const fileDiag = await controller.diagnostics({
      filePath: '/tmp/AlphaApp/Sources/HomeView.swift',
      cwd: workspaceDir,
    })
    assert.equal(fileDiag.mode, 'file')
    assert.equal(fileDiag.tabIdentifier, 'windowtab-alpha')
    assert.equal(fileDiag.issueCount, 2)

    // Navigator diagnostics (`XcodeListNavigatorIssues`)
    const navDiag = await controller.diagnostics({
      projectPath: '/tmp/BetaWorkspace/Beta.xcworkspace',
      cwd: workspaceDir,
    })
    assert.equal(navDiag.mode, 'navigator')
    assert.equal(navDiag.tabIdentifier, 'windowtab-beta')
    assert.equal(navDiag.issueCount, 1)

    // Incremental build & selective test run
    const built = await controller.buildOrTest({
      action: 'build',
      projectPath: '/tmp/BetaWorkspace/Beta.xcworkspace',
      cwd: workspaceDir,
    })
    assert.equal(built.ok, true)
    assert.equal(built.tabIdentifier, 'windowtab-beta')

    const tested = await controller.buildOrTest({
      action: 'run_some_tests',
      tests: ['BetaTests/testLoginFlow'],
      tabIdentifier: 'windowtab-beta',
      cwd: workspaceDir,
    })
    assert.equal(tested.ok, true)
    assert.equal(tested.structured?.passed, 1)

    // Render SwiftUI `#Preview` and save PNG to `.dsh-xcode/previews/`
    const preview = await controller.renderPreview({
      sourceFilePath: 'Views/CardView.swift',
      tabIdentifier: 'windowtab-beta',
      cwd: workspaceDir,
    })
    assert.equal(preview.savedPreviews.length, 1)
    const pngInfo = await stat(preview.savedPreviews[0].absoluteImagePath)
    assert.equal(pngInfo.size > 0, true)

    // DocumentationSearch
    const docs = await controller.searchDocs({ query: 'NavigationSplitView', frameworks: ['SwiftUI'] })
    assert.match(docs.text, /NavigationSplitView/u)

    // Verify `.dsh-xcode/state.json` was persisted for the Right-Sidebar Workbench
    const persisted = JSON.parse(await readFile(join(workspaceDir, WORKBENCH_STATE_FILE), 'utf8'))
    assert.equal(persisted.connected, true)
    assert.equal(persisted.previews.length, 1)
    assert.equal(persisted.iosPeer.streamedDevice.name, 'iPhone 17 Pro')
  } finally {
    unregisterIos()
    await controller.dispose()
    await rm(workspaceDir, { recursive: true, force: true })
  }
})

test('Apple SKILL.md parser, exporter, peer registry, and Host entry apply() work end-to-end', async () => {
  const parsed = parseSkillMarkdown(
    '---\nname: swiftui-liquid-glass\ndescription: "Adopt iOS 26 Liquid Glass materials"\n---\n\n# Liquid Glass\nUse `.glassEffect()`.',
    'fallback',
  )
  assert.equal(parsed.name, 'swiftui-liquid-glass')
  assert.equal(parsed.description, 'Adopt iOS 26 Liquid Glass materials')
  assert.match(parsed.body, /glassEffect/u)

  const tempRoot = await mkdtemp(join(tmpdir(), 'dsh-xcode-skills-'))
  try {
    // Mock `xcrun agent skills export --output-dir <dir> --replace-existing`
    const mockExportScript = join(tempRoot, 'mock-export.mjs')
    await writeFile(
      mockExportScript,
      [
        'import { mkdir, writeFile } from "node:fs/promises";',
        'import { join } from "node:path";',
        'const idx = process.argv.indexOf("--output-dir");',
        'const out = process.argv[idx + 1];',
        'await mkdir(join(out, "xcode-workflows"), { recursive: true });',
        'await writeFile(join(out, "xcode-workflows", "SKILL.md"), "---\\nname: xcode-workflows\\ndescription: Official Xcode workflows\\n---\\n# Workflows\\nBody");',
        'process.stdout.write("Exported 1 skill\\n");',
      ].join('\n'),
    )

    const exported = await exportAppleSkillsFromXcode({
      cacheRoot: join(tempRoot, 'cache'),
      xcodeBuild: '17F113',
      xcodePid: 4321,
      command: process.execPath,
      argsPrefix: [mockExportScript],
    })
    assert.equal(exported.skills.length, 1)
    assert.equal(exported.skills[0].registeredName, 'xcode-workflows')

    const reloaded = await loadCachedAppleSkills(exported.outputDir)
    assert.equal(reloaded.length, 1)

    // Test peer registry symmetry
    const unregX = registerXcodePeer(() => ({
      version: '0.1.0-rc.1',
      connected: true,
      mcpbridgeAvailable: true,
      openWindows: [{ tabIdentifier: 'tab-1' }],
    }))
    assert.equal(readXcodePeer()?.connected, true)
    unregX()
    assert.equal(readXcodePeer(), null)
    assert.equal(readIosPeer(), null)

    // Test mounting `apply()` from `src/index.ts` on a mock Cordis host context
    const pluginMod = await import('../src/index.ts')
    const registeredTools = new Map()
    const registeredSkills = new Map()
    const registeredCommands = new Map()
    const effectDisposers = []

    const fakeCtx = {
      workingDirectory: { ensure: async () => tempRoot },
      tools: {
        register(tool) {
          registeredTools.set(tool.name, tool)
          return () => registeredTools.delete(tool.name)
        },
      },
      skills: {
        register(skill) {
          registeredSkills.set(skill.name, skill)
          return () => registeredSkills.delete(skill.name)
        },
      },
      commands: {
        register(cmd) {
          registeredCommands.set(cmd.name, cmd)
          return () => registeredCommands.delete(cmd.name)
        },
      },
      attachments: {
        imageLimits: { maxImageBytes: 5_000_000, maxMessageImageBytes: 5_000_000 },
        async saveImage({ mediaType, name }) {
          return { id: `att-${name}`, mediaType }
        },
      },
      effect(fn) {
        const cleanup = fn()
        if (typeof cleanup === 'function') effectDisposers.push(cleanup)
        return () => {
          if (typeof cleanup === 'function') cleanup()
        }
      },
      inject(_deps, cb) {
        cb(fakeCtx)
        return { dispose() {} }
      },
      get() {
        return undefined
      },
      logger: { info() {} },
    }

    const disposePlugin = pluginMod.apply(fakeCtx, {
      skillsCacheDir: join(tempRoot, 'cache'),
      autoSyncSkills: false,
    })

    assert.equal(registeredTools.size, 8)
    for (const toolName of pluginMod.XCODE_TOOL_NAMES) {
      assert.equal(registeredTools.has(toolName), true, `missing tool ${toolName}`)
    }
    assert.equal(registeredSkills.has('xcode-ide-bridge'), true)
    assert.equal(registeredCommands.has('xcode'), true)
    assert.notEqual(readXcodePeer(), null)

    await disposePlugin()
    assert.equal(readXcodePeer(), null)
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})
