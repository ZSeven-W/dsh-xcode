import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { parseWorkbenchAddress, workbenchAddress } from '../src/client/address.ts'
import { en, zh } from '../src/client/locales.ts'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

test('zh and en client locales have identical non-empty key sets', () => {
  const zhKeys = Object.keys(zh).sort()
  const enKeys = Object.keys(en).sort()
  assert.deepEqual(zhKeys, enKeys)
  for (const key of zhKeys) {
    assert.equal(typeof zh[key], 'string')
    assert.equal(zh[key].length > 0, true)
    assert.equal(typeof en[key], 'string')
    assert.equal(en[key].length > 0, true)
  }
})

test('workbenchAddress round-trips session IDs and workspace paths with spaces and CJK characters', () => {
  const addr = workbenchAddress('sess-123', '/Users/fini/workspace/演示 App')
  const parsed = parseWorkbenchAddress(addr)
  assert.deepEqual(parsed, {
    sessionId: 'sess-123',
    cwd: '/Users/fini/workspace/演示 App',
  })
  assert.equal(parseWorkbenchAddress('dsh-resource://other-plugin/session/a/b'), undefined)
  assert.equal(parseWorkbenchAddress('dsh-resource://xcode-workbench/session/only-one-part'), undefined)
})

test('built server & client bundles satisfy DSH Web ModuleLoader, external React, and sidebar slot contracts', async () => {
  const serverJs = await readFile(join(root, 'lib/index.js'), 'utf8')
  const serverDts = await readFile(join(root, 'lib/index.d.ts'), 'utf8')
  const clientJs = await readFile(join(root, 'lib/client.js'), 'utf8')
  const iconInfo = await stat(join(root, 'icon.svg'))

  assert.equal(iconInfo.size > 50, true)
  assert.match(serverJs, /xcode_render_preview/u)
  assert.match(serverDts, /export declare function apply/u)

  assert.match(clientJs, /^window\.__ModuleLoader__\.load\(\{\s*id:\s*"@zseven-w\/dsh-xcode"/u)
  assert.match(clientJs, /require\(["']react(?:\/jsx-runtime)?["']\)/u)
  assert.equal(
    /react\.(?:development|production)(?:\.min)?\.js|__CLIENT_INTERNALS_DO_NOT_USE|__SECRET_INTERNALS_DO_NOT_USE/u.test(
      clientJs,
    ),
    false,
  )

  // Execute `lib/client.js` inside a sandboxed window.__ModuleLoader__ and verify slot & tab registration
  let loadedEntry = null
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(entry) {
          loadedEntry = entry
        },
      },
    },
    EventTarget,
    CustomEvent,
    TextDecoder,
    URL,
    Blob,
    AbortController,
  }
  vm.runInNewContext(clientJs, sandbox)
  assert.ok(loadedEntry)
  assert.equal(loadedEntry.id, '@zseven-w/dsh-xcode')

  const clientExports = loadedEntry.factory(modName => {
    if (modName === 'react') {
      return { useState: () => [], useEffect: () => {}, useCallback: fn => fn }
    }
    if (modName === 'react/jsx-runtime') {
      return { jsx: () => null, jsxs: () => null }
    }
    throw new Error(`Unexpected require("${modName}") in client bundle`)
  })

  assert.equal(Array.isArray(clientExports.inject), true)
  assert.equal(clientExports.inject.includes('sidebarRightTabs'), true)

  const registeredTabs = []
  const registeredSlots = []
  let localeRegistered = false
  clientExports.apply({
    effect(fn) {
      fn()
      return () => {}
    },
    locale: {
      register() {
        localeRegistered = true
        return () => {}
      },
      bind: () => key => key,
    },
    sidebarRight: { openResource() {} },
    sidebarRightTabs: {
      register(tab) {
        registeredTabs.push(tab)
        return () => {}
      },
    },
    slots: {
      inject(_slot, cb) {
        cb()
        return () => {}
      },
      register(meta) {
        registeredSlots.push(meta)
        return () => {}
      },
    },
    remote: {
      workspaceFiles: { async readBytes() { return { ok: true, value: { data: new Uint8Array() } } } },
      commands: { async execute() { return { ok: true, value: { kind: 'success', text: '{}' } } } },
    },
  })

  assert.equal(localeRegistered, true)
  assert.equal(registeredTabs.length, 2)
  assert.equal(registeredSlots.some(s => s.name === 'sidebar.right.pane.tab' && s.key === '@zseven-w/dsh-xcode'), true)
  assert.equal(registeredSlots.some(s => s.name === 'sidebar.right.pane.tab' && s.key === '@zseven-w/dsh-xcode/panel'), true)
  assert.equal(registeredSlots.filter(s => s.name === 'tool.call.toolview').length, 6)
})
