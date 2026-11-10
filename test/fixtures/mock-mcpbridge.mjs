/**
 * Mock `xcrun mcpbridge` STDIO JSON-RPC 2.0 server for integration tests.
 * Reproduces Xcode 26.x's exact wire behavior, including:
 * - paginated `tools/list`
 * - `XcodeListWindows` advertising `outputSchema` while returning JSON inside
 *   `content[0].text` with `structuredContent` omitted
 * - `RenderPreview` returning canonical PNG base64 `image` blocks
 * - `notifications/tools/list_changed` when `TriggerToolsChanged` is called
 */

import { createInterface } from 'node:readline'

// 1x1 transparent PNG
const ONE_BY_ONE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const mode = process.env.MOCK_MCPBRIDGE_MODE ?? 'normal'
if (mode === 'no-xcode') {
  process.stderr.write('mcpbridge: error: no running Xcode processes found\n')
  process.exit(1)
}
if (mode === 'denied') {
  process.stderr.write('Could not connect to Xcode: IntelligenceToolUse session denied by user\n')
  process.exit(1)
}

const windowsPayload = process.env.MOCK_WINDOWS_JSON
  ? JSON.parse(process.env.MOCK_WINDOWS_JSON)
  : {
      windows: [
        {
          tabIdentifier: 'windowtab-alpha',
          workspacePath: '/tmp/AlphaApp/AlphaApp.xcodeproj',
          name: 'AlphaApp',
          isActive: false,
        },
        {
          tabIdentifier: 'windowtab-beta',
          workspacePath: '/tmp/BetaWorkspace/Beta.xcworkspace',
          name: 'Beta',
          isActive: true,
        },
      ],
    }

let extraToolEnabled = false

function getToolsPage1() {
  return [
    {
      name: 'XcodeListWindows',
      description: 'Lists open Xcode windows and their tabIdentifiers',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: {
        type: 'object',
        properties: { windows: { type: 'array' } },
        required: ['windows'],
      },
    },
    {
      name: 'XcodeRefreshCodeIssuesInFile',
      description: 'Refreshes live compiler issues in a single source file',
      inputSchema: {
        type: 'object',
        properties: {
          tabIdentifier: { type: 'string' },
          filePath: { type: 'string' },
        },
        required: ['tabIdentifier', 'filePath'],
      },
    },
    {
      name: 'XcodeListNavigatorIssues',
      description: 'Lists issues from Xcode Issue Navigator',
      inputSchema: {
        type: 'object',
        properties: { tabIdentifier: { type: 'string' } },
      },
    },
  ]
}

function getToolsPage2() {
  const base = [
    {
      name: 'BuildProject',
      description: 'Builds active scheme in Xcode',
      inputSchema: { type: 'object', properties: { tabIdentifier: { type: 'string' } } },
    },
    {
      name: 'GetBuildLog',
      description: 'Reads build log',
      inputSchema: { type: 'object', properties: { tabIdentifier: { type: 'string' } } },
    },
    {
      name: 'GetTestList',
      description: 'Lists tests in scheme',
      inputSchema: { type: 'object', properties: { tabIdentifier: { type: 'string' } } },
    },
    {
      name: 'RunAllTests',
      description: 'Runs all tests',
      inputSchema: { type: 'object', properties: { tabIdentifier: { type: 'string' } } },
    },
    {
      name: 'RunSomeTests',
      description: 'Runs selected tests',
      inputSchema: {
        type: 'object',
        properties: { tabIdentifier: { type: 'string' }, tests: { type: 'array' } },
      },
    },
    {
      name: 'RenderPreview',
      description: 'Renders SwiftUI #Preview',
      inputSchema: {
        type: 'object',
        properties: {
          tabIdentifier: { type: 'string' },
          sourceFilePath: { type: 'string' },
        },
      },
    },
    {
      name: 'DocumentationSearch',
      description: 'Searches Apple docs and WWDC transcripts',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
    },
    {
      name: 'ExecuteSnippet',
      description: 'Executes a Swift snippet in project context',
      inputSchema: { type: 'object', properties: { tabIdentifier: { type: 'string' }, code: { type: 'string' } } },
    },
    {
      name: 'InspectBridgeEnv',
      description: 'Test helper returning received env keys',
      inputSchema: { type: 'object', properties: {} },
    },
  ]
  if (extraToolEnabled) {
    base.push({
      name: 'DeviceInteractionTap',
      description: 'Xcode 27+ device interaction tool',
      inputSchema: { type: 'object', properties: {} },
    })
  }
  return base
}

function send(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`)
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })

rl.on('line', line => {
  if (!line.trim()) return
  let msg
  try {
    msg = JSON.parse(line)
  } catch {
    return
  }
  if (!msg || typeof msg !== 'object') return

  if (msg.id === undefined) {
    // Notification (`notifications/initialized`, `notifications/cancelled`, etc.)
    return
  }

  if (msg.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: 'Xcode MCP Bridge (Mock)', version: '26.6' },
        instructions: 'Use tabIdentifier from XcodeListWindows.',
      },
    })
    return
  }

  if (msg.method === 'tools/list') {
    const cursor = msg.params?.cursor
    if (!cursor) {
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          tools: getToolsPage1(),
          nextCursor: 'page-2',
        },
      })
    } else {
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          tools: getToolsPage2(),
        },
      })
    }
    return
  }

  if (msg.method === 'tools/call') {
    const { name, arguments: args = {} } = msg.params ?? {}

    if (name === 'XcodeListWindows') {
      // Deliberately omit `structuredContent` to test Xcode 26 normalization!
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(windowsPayload) }],
        },
      })
      return
    }

    if (name === 'XcodeRefreshCodeIssuesInFile') {
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          content: [
            {
              type: 'text',
              text: `${args.filePath}:18:9: error: cannot find 'missingState' in scope\n${args.filePath}:24:5: warning: initialization of immutable value 'unused' was never used`,
            },
          ],
        },
      })
      return
    }

    if (name === 'XcodeListNavigatorIssues') {
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          structuredContent: {
            issues: [
              {
                severity: 'warning',
                filePath: '/tmp/BetaWorkspace/App/RootView.swift',
                line: 11,
                message: 'Deprecated modifier used',
              },
            ],
          },
          content: [{ type: 'text', text: '1 warning in Navigator' }],
        },
      })
      return
    }

    if (name === 'BuildProject') {
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          content: [{ type: 'text', text: `Build succeeded for ${args.tabIdentifier} (0.8s warm incremental)` }],
        },
      })
      return
    }

    if (name === 'RunSomeTests') {
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          structuredContent: {
            passed: Array.isArray(args.tests) ? args.tests.length : 0,
            failed: 0,
            tests: args.tests ?? [],
          },
          content: [{ type: 'text', text: 'Selected tests passed' }],
        },
      })
      return
    }

    if (name === 'RenderPreview') {
      const giantFakeBase64 = 'A'.repeat(1024)
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          structuredContent: {
            rendered: true,
            tabIdentifier: args.tabIdentifier,
            sourceFilePath: args.sourceFilePath,
            imageData: giantFakeBase64,
          },
          content: [
            { type: 'text', text: `Rendered #Preview #${args.previewDefinitionIndexInFile ?? 0}` },
            { type: 'image', mimeType: 'image/png', data: ONE_BY_ONE_PNG_BASE64 },
          ],
        },
      })
      return
    }

    if (name === 'DocumentationSearch') {
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          structuredContent: {
            results: [
              {
                title: 'NavigationSplitView',
                framework: 'SwiftUI',
                summary: 'A view that presents views in two or three columns.',
              },
            ],
          },
          content: [{ type: 'text', text: 'Found 1 Apple Documentation entry for ' + String(args.query) }],
        },
      })
      return
    }

    if (name === 'InspectBridgeEnv') {
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                envKeys: Object.keys(process.env),
                sessionId: process.env.MCP_XCODE_SESSION_ID ?? null,
                xcodePid: process.env.MCP_XCODE_PID ?? null,
              }),
            },
          ],
        },
      })
      return
    }

    if (name === 'TriggerToolsChanged') {
      extraToolEnabled = true
      send({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' })
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: { content: [{ type: 'text', text: 'notified' }] },
      })
      return
    }

    if (name === 'FailTool') {
      send({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          isError: true,
          content: [{ type: 'text', text: 'Scheme "MissingScheme" does not exist in workspace' }],
        },
      })
      return
    }

    send({
      jsonrpc: '2.0',
      id: msg.id,
      error: { code: -32601, message: `Unknown tool: ${String(name)}` },
    })
  }
})
