import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readIosPeer, registerXcodePeer } from '../src/peer-registry.ts'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@deepseek-ai/dsh-tools') {
      return {
        shortCircuit: true,
        url: 'data:text/javascript,export function defineTool(def){return def;} export class ToolArgsError extends Error {}',
      }
    }
    return nextResolve(specifier, context)
  },
})

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const siblingIosEntry = join(root, '..', 'dsh-ios', 'lib', 'index.js')

test(
  'cross-plugin peer linkage between @zseven-w/dsh-xcode and @zseven-w/dsh-ios',
  { skip: !existsSync(siblingIosEntry) },
  async () => {
    const iosMod = await import(pathToFileURL(siblingIosEntry).href)

    // 1. Mounting dsh-ios registers live peer snapshot readable from dsh-xcode
    const fakeIosCtx = {
      tools: { register: () => () => {} },
      effect(fn) {
        const cleanup = fn()
        return () => {
          if (typeof cleanup === 'function') cleanup()
        }
      },
      inject() {
        return { async dispose() {} }
      },
      logger: { info() {}, warn() {} },
    }

    const disposeIos = iosMod.apply(fakeIosCtx)
    try {
      const peerFromXcode = readIosPeer()
      assert.ok(peerFromXcode)
      assert.equal(peerFromXcode.version, '0.1.0-rc.10')
      assert.equal(typeof peerFromXcode.serveSimSource, 'string')

      // 2. When dsh-xcode is mounted, ios_sim_preview on an .xcodeproj guides the model to `xcode_render_preview`
      const unregXcode = registerXcodePeer(() => ({
        version: '0.1.0-rc.1',
        connected: true,
        mcpbridgeAvailable: true,
        openWindows: [{ tabIdentifier: 'windowtab1', workspacePath: '/tmp/App.xcodeproj' }],
      }))

      const tempProjDir = await mkdtemp(join(tmpdir(), 'dsh-ios-xcode-hint-'))
      try {
        await mkdir(join(tempProjDir, 'DemoApp.xcodeproj'), { recursive: true })
        const fakeHost = {
          status: () => ({
            available: true,
            running: false,
            restarts: 0,
            serveSimSource: 'package-bin',
            consumers: 0,
            stderr: [],
          }),
        }
        const { iosSimPreview, controller } = iosMod.createSimPreviewTools(fakeHost)
        try {
          await assert.rejects(
            () =>
              iosSimPreview.execute(
                { action: 'start', packagePath: tempProjDir },
                { signal: new AbortController().signal },
              ),
            err =>
              /Package\.swift/u.test(err.message)
              && /xcode_render_preview/u.test(err.message)
              && /@zseven-w\/dsh-xcode` is mounted/u.test(err.message),
          )
        } finally {
          await controller.dispose()
        }
      } finally {
        unregXcode()
        await rm(tempProjDir, { recursive: true, force: true })
      }
    } finally {
      await disposeIos()
      assert.equal(readIosPeer(), null)
    }
  },
)
