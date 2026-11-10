/**
 * Clean tarball smoke check: runs `npm pack --pack-destination <tmp>`, extracts
 * the `.tgz` into an isolated temp directory with zero `node_modules`, and
 * verifies every declared `exports` target, `cordis.patch.yml`, `icon.svg`, and
 * `locale/*.json` are shipped inside the published package.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const workDir = await mkdtemp(join(tmpdir(), 'dsh-xcode-pack-'))

try {
  execFileSync('npm', ['pack', '--ignore-scripts', '--pack-destination', workDir], {
    cwd: root,
    stdio: 'pipe',
  })
  const files = await readdir(workDir)
  const tgz = files.find(f => f.endsWith('.tgz'))
  assert.ok(tgz, 'npm pack did not produce a .tgz archive')

  execFileSync('tar', ['-xzf', join(workDir, tgz), '-C', workDir], { stdio: 'pipe' })
  const pkgRoot = join(workDir, 'package')

  const requiredFiles = [
    'package.json',
    'lib/index.js',
    'lib/index.d.ts',
    'lib/client.js',
    'cordis.patch.yml',
    'icon.svg',
    'locale/zh.json',
    'locale/en.json',
    'README.md',
    'README.zh.md',
    'LICENSE',
  ]
  for (const rel of requiredFiles) {
    assert.equal(existsSync(join(pkgRoot, rel)), true, `packed tarball is missing ${rel}`)
  }
  console.log(`smoke:pack passed (${tgz})`)
} finally {
  await rm(workDir, { recursive: true, force: true })
}
