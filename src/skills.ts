/**
 * Bundled `xcode-ide-bridge` playbook skill + `xcrun agent skills export`
 * importer that brings Apple's first-party Xcode SKILL.md bundles into DSH.
 */

import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { scrubEnvForMcpBridge } from './mcp-stdio.ts'
import { XcodeError } from './env.ts'

const execFileAsync = promisify(execFile)

export const XCODE_SKILL_NAME = 'xcode-ide-bridge'

export const XCODE_SKILL_DESCRIPTION =
  'Work with Apple projects through Xcode\'s official MCP bridge (`xcrun mcpbridge`): instant single-file '
  + 'diagnostics, SwiftUI `#Preview` rendering, incremental scheme builds/tests, Apple docs search, and '
  + 'coordination with `@zseven-w/dsh-ios`.'

export const XCODE_SKILL_WHEN_TO_USE =
  'Any Swift, SwiftUI, Objective-C, iOS, macOS, visionOS, or watchOS task where Xcode compiler diagnostics, '
  + 'SwiftUI `#Preview` snapshots, scheme builds/tests, or Apple Developer Documentation are needed.'

export const XCODE_SKILL_CONTENT = `# Xcode IDE Bridge (\`@zseven-w/dsh-xcode\`)

\`dsh-xcode\` connects DeepSeek Harness directly to a running Xcode instance over Apple's official \`xcrun mcpbridge\` (XPC) — without spawning cold \`xcodebuild\` runs on every edit.

## Fast feedback loop

1. **Check or open the project once**
   - Call \`xcode_status\` to see if Xcode is running, connected, and which \`tabIdentifier\` windows are open.
   - If Xcode is closed (or the project is not open yet), call \`xcode_open_project\` with the workspace/project path. Note: the user must allow external agents once in **Xcode → Settings → Intelligence → Model Context Protocol**.
2. **Prefer single-file diagnostics while editing (\`< 1 s\`)**
   - After editing a Swift/ObjC file, call \`xcode_diagnostics\` with \`filePath\` (uses \`XcodeRefreshCodeIssuesInFile\`) instead of triggering a full build. Only run \`xcode_build_test\` (\`action: "build"\`) once file-level issues are clean or cross-module changes need linking.
3. **Render SwiftUI Previews visually**
   - Call \`xcode_render_preview\` with \`sourceFilePath\` to render \`#Preview\` or \`PreviewProvider\` through Xcode's native preview engine — works on full \`.xcodeproj\` / \`.xcworkspace\` apps as well as Swift packages.
   - Tip: if a custom \`#Preview\` macro fails to resolve a specific form factor in Xcode's preview engine, an explicit \`PreviewProvider\` declaration is a reliable fallback.
4. **Search local Apple docs before guessing modern APIs**
   - Call \`xcode_search_docs\` (\`DocumentationSearch\`) to query Xcode's local Apple Developer Documentation & WWDC corpus for current SDK signatures (iOS 26 / macOS 26 / Swift 6+).
5. **Escape hatch for raw Xcode MCP tools**
   - Call \`xcode_call_tool\` with \`action: "list"\` to inspect all ~20+ tools exposed by the user's exact Xcode build (e.g. \`ExecuteSnippet\`, \`XcodeRead\`, \`XcodeUpdate\`, or Xcode 27+ \`DeviceInteraction*\`), and \`action: "call"\` to invoke any of them directly.

## Pairing with \`@zseven-w/dsh-ios\`

When \`@zseven-w/dsh-ios\` (\`ios_sim_*\`) is also installed in DSH:
- **Use \`dsh-xcode\` (\`xcode_*\`) for IDE & compiler work**: single-file diagnostics, incremental \`BuildProject\` / XCTest / Swift Testing runs, \`.xcodeproj\` SwiftUI \`#Preview\` snapshots, and Apple documentation search.
- **Use \`dsh-ios\` (\`ios_sim_*\`) for live device runtime & UI automation**: booting/streaming simulators in the live video sidebar, driving USB-connected physical iPhones via WebDriverAgent, tapping UI via AXe accessibility trees (\`ios_sim_ui_tree\`, \`ios_sim_tap_element\`, \`ios_sim_ui_rows\`) or Vision OCR (\`ios_sim_find_text\`, \`ios_sim_tap_text\`), reading unified runtime logs, LLDB backtraces, and \`leaks\`.
`

export interface ExportedAppleSkill {
  dirName: string
  registeredName: string
  title: string
  description: string
  skillFilePath: string
  content: string
}

export function defaultSkillsCacheRoot(): string {
  return join(homedir(), '.cache', 'dsh-xcode', 'skills')
}

/** Parse optional YAML frontmatter (`name`, `description`) from a `SKILL.md` file. */
export function parseSkillMarkdown(raw: string, fallbackName: string): {
  name: string
  description: string
  body: string
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u.exec(raw)
  if (!match) {
    return {
      name: fallbackName,
      description: `Apple official Xcode skill (${fallbackName})`,
      body: raw.trim(),
    }
  }
  const frontmatter = match[1]!
  const body = match[2]!.trim()
  let name = fallbackName
  let description = `Apple official Xcode skill (${fallbackName})`
  for (const line of frontmatter.split(/\r?\n/u)) {
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.+)$/u.exec(line.trim())
    if (!kv) continue
    const key = kv[1]!.toLowerCase()
    const val = kv[2]!.trim().replace(/^["']|["']$/gu, '')
    if (key === 'name' && val) name = val
    if (key === 'description' && val) description = val
  }
  return { name, description, body: body || raw.trim() }
}

function sanitizeSkillId(raw: string): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
  const clean = slug || 'skill'
  return clean.startsWith('xcode-') ? clean : `xcode-${clean}`
}

/** Read any already-exported Apple `SKILL.md` bundles from a cache directory. */
export async function loadCachedAppleSkills(cacheDir: string): Promise<ExportedAppleSkill[]> {
  const entries = await readdir(cacheDir, { withFileTypes: true }).catch(() => [])
  const skills: ExportedAppleSkill[] = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const skillFilePath = join(cacheDir, entry.name, 'SKILL.md')
    let raw: string
    try {
      raw = await readFile(skillFilePath, 'utf8')
    } catch {
      continue
    }
    const parsed = parseSkillMarkdown(raw, entry.name)
    skills.push({
      dirName: entry.name,
      registeredName: sanitizeSkillId(parsed.name),
      title: parsed.name,
      description: parsed.description,
      skillFilePath,
      content: parsed.body,
    })
  }
  return skills
}

/**
 * Run `xcrun agent skills export --output-dir <targetDir> --replace-existing`
 * against the active Xcode process and parse the resulting `SKILL.md` bundles.
 */
export async function exportAppleSkillsFromXcode(options: {
  cacheRoot?: string
  xcodeBuild?: string
  xcodePid?: number
  command?: string
  argsPrefix?: string[]
  signal?: AbortSignal
}): Promise<{ outputDir: string; skills: ExportedAppleSkill[]; stdout: string }> {
  const buildTag = (options.xcodeBuild ?? 'default').replace(/[^A-Za-z0-9._-]+/gu, '_')
  const outputDir = join(options.cacheRoot ?? defaultSkillsCacheRoot(), buildTag)
  await mkdir(outputDir, { recursive: true })

  const command = options.command ?? 'xcrun'
  const args = [
    ...(options.argsPrefix ?? ['agent', 'skills', 'export']),
    '--output-dir',
    outputDir,
    '--replace-existing',
  ]
  const overrides: Record<string, string> = {}
  if (options.xcodePid !== undefined) {
    overrides.MCP_XCODE_PID = String(options.xcodePid)
  }

  let stdout = ''
  try {
    const res = await execFileAsync(command, args, {
      timeout: 25_000,
      maxBuffer: 4 * 1024 * 1024,
      env: scrubEnvForMcpBridge(process.env, overrides),
      ...(options.signal ? { signal: options.signal } : {}),
    })
    stdout = String(res.stdout ?? '').trim()
  } catch (error: any) {
    const detail = typeof error?.stderr === 'string' && error.stderr.trim()
      ? error.stderr.trim()
      : (error instanceof Error ? error.message : String(error))
    throw new XcodeError(
      `Failed to export Apple skills via \`xcrun agent skills export\`: ${detail}. `
      + 'Ensure Xcode is open with external agents allowed in Xcode → Settings → Intelligence.',
      'SKILLS_EXPORT_FAILED',
    )
  }

  const skills = await loadCachedAppleSkills(outputDir)
  return { outputDir, skills, stdout }
}

export interface DynamicSkillManager {
  registerExportedSkills: (skills: ExportedAppleSkill[]) => number
  registeredSkillNames: () => string[]
  dispose: () => void
}

/**
 * Mount the bundled `xcode-ide-bridge` playbook and return a dynamic registrar
 * for Apple's exported `SKILL.md` bundles when the DSH host provides `skills`.
 */
export function mountXcodeSkills(ctx: any): DynamicSkillManager {
  let hostSkillsService: any
  const dynamicDisposers = new Map<string, () => void>()

  const fiber = ctx.inject(['skills'], (skillCtx: any) => {
    hostSkillsService = skillCtx.skills
    skillCtx.effect(() => skillCtx.skills.register({
      name: XCODE_SKILL_NAME,
      description: XCODE_SKILL_DESCRIPTION,
      whenToUse: XCODE_SKILL_WHEN_TO_USE,
      content: XCODE_SKILL_CONTENT,
      source: 'bundled',
    }), 'dsh-xcode:bundled-skill')

    skillCtx.effect(() => () => {
      for (const dispose of dynamicDisposers.values()) {
        try { dispose() } catch {}
      }
      dynamicDisposers.clear()
      hostSkillsService = undefined
    }, 'dsh-xcode:exported-skills-cleanup')
  })

  return {
    registerExportedSkills(skills: ExportedAppleSkill[]): number {
      if (!hostSkillsService) return 0
      for (const dispose of dynamicDisposers.values()) {
        try { dispose() } catch {}
      }
      dynamicDisposers.clear()
      for (const skill of skills) {
        if (skill.registeredName === XCODE_SKILL_NAME) continue
        try {
          const dispose = hostSkillsService.register({
            name: skill.registeredName,
            description: skill.description,
            content: skill.content,
            source: 'bundled',
          })
          if (typeof dispose === 'function') {
            dynamicDisposers.set(skill.registeredName, dispose)
          }
        } catch {
          // Ignore duplicate name collisions with user-installed skills.
        }
      }
      return dynamicDisposers.size
    },
    registeredSkillNames(): string[] {
      return [...dynamicDisposers.keys()]
    },
    dispose(): void {
      for (const dispose of dynamicDisposers.values()) {
        try { dispose() } catch {}
      }
      dynamicDisposers.clear()
      void fiber?.dispose?.()
    },
  }
}
