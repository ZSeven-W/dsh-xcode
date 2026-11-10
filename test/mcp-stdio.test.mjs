import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  enrichMcpBridgeError,
  McpStdioSession,
  normalizeMcpCallResult,
  scrubEnvForMcpBridge,
} from '../src/mcp-stdio.ts'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const mockBridge = join(root, 'test/fixtures/mock-mcpbridge.mjs')

test('scrubEnvForMcpBridge removes secrets and DSH_* while preserving macOS XPC essentials', () => {
  const scrubbed = scrubEnvForMcpBridge(
    {
      HOME: '/Users/dev',
      USER: 'dev',
      PATH: '/usr/bin:/bin',
      DEVELOPER_DIR: '/Applications/Xcode.app/Contents/Developer',
      OPENAI_API_KEY: 'sk-secret',
      GITHUB_TOKEN: 'ghp_secret',
      AWS_SECRET_ACCESS_KEY: 'aws_secret',
      DB_PASSWORD: 'pw',
      DSH_INTERNAL_COOKIE: 'cookie',
    },
    { MCP_XCODE_PID: '4242', MCP_XCODE_SESSION_ID: 'sess-1' },
  )

  assert.equal(scrubbed.HOME, '/Users/dev')
  assert.equal(scrubbed.DEVELOPER_DIR, '/Applications/Xcode.app/Contents/Developer')
  assert.equal(scrubbed.MCP_XCODE_PID, '4242')
  assert.equal(scrubbed.MCP_XCODE_SESSION_ID, 'sess-1')
  assert.equal('OPENAI_API_KEY' in scrubbed, false)
  assert.equal('GITHUB_TOKEN' in scrubbed, false)
  assert.equal('AWS_SECRET_ACCESS_KEY' in scrubbed, false)
  assert.equal('DB_PASSWORD' in scrubbed, false)
  assert.equal('DSH_INTERNAL_COOKIE' in scrubbed, false)
})

test('enrichMcpBridgeError produces actionable error codes for Xcode XPC & Intelligence states', () => {
  const noXcode = enrichMcpBridgeError('mcpbridge: error: no running Xcode processes found')
  assert.equal(noXcode.code, 'XCODE_NOT_RUNNING')
  assert.match(noXcode.message, /xcode_open_project/u)

  const denied = enrichMcpBridgeError('Could not connect to Xcode: IntelligenceToolUse denied', 9876)
  assert.equal(denied.code, 'XCODE_PERMISSION_OR_SESSION')
  assert.match(denied.message, /PID 9876/u)
  assert.match(denied.message, /Settings → Intelligence/u)

  const multi = enrichMcpBridgeError('multiple Xcode processes found: 101, 202')
  assert.equal(multi.code, 'MULTIPLE_XCODE_INSTANCES')
})

test('normalizeMcpCallResult hydrates omitted structuredContent and strips oversized base64 strings', () => {
  const winNormalized = normalizeMcpCallResult('XcodeListWindows', {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          windows: [{ tabIdentifier: 'windowtab1', workspacePath: '/tmp/Demo.xcodeproj' }],
        }),
      },
    ],
  })
  assert.deepEqual(winNormalized.structuredContent, {
    windows: [{ tabIdentifier: 'windowtab1', workspacePath: '/tmp/Demo.xcodeproj' }],
  })

  assert.throws(
    () =>
      normalizeMcpCallResult('RenderPreview', {
        content: [{ type: 'image', mimeType: 'image/png', data: 'not valid base64 $$$' }],
      }),
    /canonical base64/u,
  )

  assert.throws(
    () =>
      normalizeMcpCallResult('BuildProject', {
        isError: true,
        content: [{ type: 'text', text: 'Active scheme failed to compile' }],
      }),
    /Active scheme failed to compile/u,
  )
})

test('McpStdioSession connects, paginates tools/list, normalizes Xcode 26 calls, and handles list_changed', async () => {
  let listChangedCount = 0
  process.env.TEST_SECRET_API_KEY = 'must-not-leak'
  const session = new McpStdioSession({
    command: process.execPath,
    args: [mockBridge],
    xcodePid: 5511,
    sessionId: 'unit-session-id',
    onToolsChanged: () => {
      listChangedCount += 1
    },
  })

  try {
    await session.connect()
    assert.equal(session.isAlive, true)
    assert.equal(session.getServerInfo()?.name, 'Xcode MCP Bridge (Mock)')
    assert.match(session.getInstructions() ?? '', /tabIdentifier/u)

    const tools = await session.listTools()
    assert.equal(tools.length, 12)
    assert.equal(tools.some(t => t.name === 'XcodeListWindows'), true)
    assert.equal(tools.some(t => t.name === 'RenderPreview'), true)

    // Verify env scrubbing + MCP_XCODE_PID / MCP_XCODE_SESSION_ID propagation inside child
    const envRes = await session.callTool('InspectBridgeEnv')
    const childEnv = envRes.structuredContent
    assert.equal(childEnv.sessionId, 'unit-session-id')
    assert.equal(childEnv.xcodePid, '5511')
    assert.equal(childEnv.envKeys.includes('TEST_SECRET_API_KEY'), false)

    // Verify Xcode 26 XcodeListWindows response without `structuredContent` succeeds
    const winRes = await session.callTool('XcodeListWindows')
    assert.equal(Array.isArray(winRes.structuredContent?.windows), true)
    assert.equal(winRes.structuredContent.windows.length, 2)

    // Verify RenderPreview decodes PNG bytes & strips giant base64 strings from structuredContent
    const previewRes = await session.callTool('RenderPreview', {
      tabIdentifier: 'windowtab-beta',
      sourceFilePath: '/tmp/BetaWorkspace/ContentView.swift',
    })
    assert.equal(previewRes.images.length, 1)
    assert.equal(previewRes.images[0].mimeType, 'image/png')
    assert.equal(previewRes.images[0].bytes.subarray(0, 4).toString('hex'), '89504e47')
    assert.match(String(previewRes.structuredContent?.imageData), /^\[binary base64 omitted:/u)

    // Verify `notifications/tools/list_changed` invalidates cached tools
    await session.callTool('TriggerToolsChanged')
    assert.equal(listChangedCount, 1)
    const refreshed = await session.listTools()
    assert.equal(refreshed.some(t => t.name === 'DeviceInteractionTap'), true)

    // Verify tool-level `isError: true` rejects cleanly
    await assert.rejects(() => session.callTool('FailTool'), /MissingScheme/u)
  } finally {
    delete process.env.TEST_SECRET_API_KEY
    await session.close()
    assert.equal(session.isAlive, false)
  }
})

test('McpStdioSession surfaces actionable diagnostics when mcpbridge exits during handshake', async () => {
  const deniedSession = new McpStdioSession({
    command: process.execPath,
    args: [mockBridge],
    xcodePid: 7788,
    extraEnv: { MOCK_MCPBRIDGE_MODE: 'denied' },
  })
  await assert.rejects(
    () => deniedSession.connect(),
    err => err.code === 'XCODE_PERMISSION_OR_SESSION' && /PID 7788/u.test(err.message),
  )
})
