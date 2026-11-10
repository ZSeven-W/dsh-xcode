import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  MCP_XCODE_TOOLS,
  XcodeMcpServer,
  resolveEffectiveWorkspaceDir,
} from '../src/mcp-server.ts'

test('resolveEffectiveWorkspaceDir maps Codex plugin cache cwd to active Xcode window directory', () => {
  const resolved = resolveEffectiveWorkspaceDir({
    fallbackCwd: '/Users/dev/.codex/plugins/cache/zseven-xcode/dsh-xcode/0.1.0-rc.3',
    openWindows: [
      {
        tabIdentifier: 'windowtab1',
        workspacePath: '/Users/dev/Projects/DemoApp/DemoApp.xcodeproj',
        active: true,
      },
    ],
  })
  assert.equal(resolved, '/Users/dev/Projects/DemoApp')

  const explicit = resolveEffectiveWorkspaceDir({
    workspaceDir: '/Users/dev/CustomDir',
    fallbackCwd: '/Users/dev/.codex/plugins/cache/zseven-xcode/dsh-xcode/0.1.0-rc.3',
  })
  assert.equal(explicit, '/Users/dev/CustomDir')
})

test('XcodeMcpServer handles initialize, tools/list, and tools/call over JSON-RPC 2.0', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'dsh-xcode-mcp-srv-'))
  try {
    const mockScript = join(workDir, 'mock-mcpbridge.mjs')
    const pngBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64')
    await writeFile(
      mockScript,
      [
        'import { createInterface } from "node:readline";',
        'const rl = createInterface({ input: process.stdin });',
        'const send = (obj) => process.stdout.write(JSON.stringify(obj) + "\\n");',
        'rl.on("line", (line) => {',
        '  const msg = JSON.parse(line);',
        '  if (!("id" in msg)) return;',
        '  if (msg.method === "initialize") {',
        '    send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "mock-xcode", version: "26.3" } } });',
        '  } else if (msg.method === "tools/list") {',
        '    send({ jsonrpc: "2.0", id: msg.id, result: { tools: [',
        '      { name: "XcodeListWindows", inputSchema: { type: "object" } },',
        '      { name: "XcodeRefreshCodeIssuesInFile", inputSchema: { type: "object" } },',
        '      { name: "RenderPreview", inputSchema: { type: "object" } },',
        '      { name: "DocumentationSearch", inputSchema: { type: "object" } }',
        '    ] } });',
        '  } else if (msg.method === "tools/call") {',
        '    const name = msg.params.name;',
        '    if (name === "XcodeListWindows") {',
        `      send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: JSON.stringify({ windows: [{ tabIdentifier: "windowtab1", workspacePath: ${JSON.stringify(join(workDir, 'Demo.xcodeproj'))}, active: true }] }) }] } });`,
        '    } else if (name === "XcodeRefreshCodeIssuesInFile") {',
        '      send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "ContentView.swift:12:5: error: Cannot find \'foo\' in scope" }] } });',
        '    } else if (name === "RenderPreview") {',
        `      send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "image", mimeType: "image/png", data: ${JSON.stringify(pngBase64)} }] } });`,
        '    } else if (name === "DocumentationSearch") {',
        '      send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "NavigationSplitView documentation result" }] } });',
        '    }',
        '  }',
        '});',
      ].join('\n'),
    )

    const server = new XcodeMcpServer({
      bridgeCommand: process.execPath,
      bridgeArgs: [mockScript],
      defaultCwd: workDir,
      inspectEnv: async () => ({
        platform: 'darwin',
        supportedPlatform: true,
        developerDir: '/Applications/Xcode.app/Contents/Developer',
        selectedXcodeAppPath: '/Applications/Xcode.app',
        xcodeVersion: { version: '26.3', build: '17C52' },
        bridge: { available: true, path: '/usr/bin/mcpbridge' },
        runningXcodes: [{ pid: 4242, appPath: '/Applications/Xcode.app', command: '/Applications/Xcode.app/Contents/MacOS/Xcode' }],
      }),
    })

    try {
      const initReply = await server.dispatch({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18' },
      })
      assert.equal(initReply?.result?.protocolVersion, '2025-06-18')
      assert.equal(initReply?.result?.serverInfo?.name, 'dsh-xcode')

      const listReply = await server.dispatch({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      })
      assert.equal(listReply?.result?.tools?.length, MCP_XCODE_TOOLS.length)

      const diagReply = await server.dispatch({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'xcode_diagnostics',
          arguments: { filePath: 'ContentView.swift' },
        },
      })
      assert.equal(diagReply?.result?.structuredContent?.tabIdentifier, 'windowtab1')
      assert.equal(diagReply?.result?.structuredContent?.issueCount, 1)

      const previewReply = await server.dispatch({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'xcode_render_preview',
          arguments: { sourceFilePath: 'ContentView.swift' },
        },
      })
      assert.equal(previewReply?.result?.content?.length, 2)
      assert.equal(previewReply?.result?.content?.[1]?.type, 'image')
      assert.equal(previewReply?.result?.structuredContent?.previews?.length, 1)
    } finally {
      await server.close()
    }
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
})
