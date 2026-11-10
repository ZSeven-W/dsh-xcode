// Build the Host entry (lib/index.js + lib/index.d.ts, ESM, host packages external)
// and the browser module (lib/client.js) in the loader shape dsh-web requires:
// `window.__ModuleLoader__.load({ id, factory })`, keeping React external.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

await rm(join(root, 'lib'), { recursive: true, force: true })
await mkdir(join(root, 'lib'), { recursive: true })

await build({
  entryPoints: [join(root, 'src/index.ts')],
  outfile: join(root, 'lib/index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  external: ['@deepseek-ai/*'],
  logLevel: 'warning',
})

const dts = [
  'export declare const name = "dsh-xcode";',
  'export declare const inject: string[];',
  'export declare const XCODE_TOOL_NAMES: readonly string[];',
  'export interface Config {',
  '  xcodePid?: number;',
  '  callTimeoutMs?: number;',
  '  autoSyncSkills?: boolean;',
  '  skillsCacheDir?: string;',
  '}',
  'export declare function apply(ctx: unknown, config?: Config): () => Promise<void>;',
  'export declare const APPLE_PEER_SYMBOL: symbol;',
  'export interface IosPeerStreamedDevice {',
  '  udid: string;',
  '  name: string;',
  '  runtime?: string;',
  '  kind: "simulator" | "physical";',
  '}',
  'export interface IosPeerSnapshot {',
  '  version: string;',
  '  online: boolean;',
  '  streamedDevice: IosPeerStreamedDevice | null;',
  '  serveSimSource: string;',
  '  wdaAvailable: boolean;',
  '}',
  'export interface XcodePeerWindow {',
  '  tabIdentifier: string;',
  '  workspacePath?: string;',
  '  name?: string;',
  '}',
  'export interface XcodePeerSnapshot {',
  '  version: string;',
  '  connected: boolean;',
  '  mcpbridgeAvailable: boolean;',
  '  xcodeVersion?: string;',
  '  xcodeBuild?: string;',
  '  xcodePid?: number;',
  '  openWindows: XcodePeerWindow[];',
  '}',
  'export declare function registerXcodePeer(getter: () => XcodePeerSnapshot): () => void;',
  'export declare function registerIosPeer(getter: () => IosPeerSnapshot): () => void;',
  'export declare function readIosPeer(): IosPeerSnapshot | null;',
  'export declare function readXcodePeer(): XcodePeerSnapshot | null;',
  '',
].join('\n')
await writeFile(join(root, 'lib/index.d.ts'), dts)

const client = await build({
  entryPoints: [join(root, 'src/client/index.tsx')],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/*'],
  logLevel: 'warning',
})

const source = client.outputFiles[0].text
if (/react\.(?:development|production)(?:\.min)?\.js|__CLIENT_INTERNALS_DO_NOT_USE|__SECRET_INTERNALS_DO_NOT_USE/u.test(source)) {
  throw new Error('Client bundle contains React internals; host React must remain external')
}
if (!/require\(["']react(?:\/jsx-runtime)?["']\)/u.test(source)) {
  throw new Error('Client bundle must request React from the host module loader')
}

await writeFile(join(root, 'lib/client.js'), [
  `window.__ModuleLoader__.load({ id: ${JSON.stringify(manifest.name)}, factory: (require) => {`,
  'var module = { exports: {} }; var exports = module.exports;',
  source,
  'return module.exports; } });',
  '',
].join('\n'))

console.log('built lib/index.js, lib/index.d.ts, and lib/client.js')
