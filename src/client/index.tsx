/**
 * Browser half of `@zseven-w/dsh-xcode`:
 * - Right-sidebar "Xcode Workbench" tab (`dsh-resource://xcode-workbench/session/<sessionId>/<cwd>`)
 * - Right-sidebar `+` launcher entry (`@zseven-w/dsh-xcode/panel`)
 * - Compact `tool.call.toolview` chat rows that notify open tabs on completion
 */

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { ADDRESS_PREFIX, parseWorkbenchAddress, workbenchAddress } from './address.ts'
import { en, NS, zh, type Key } from './locales.ts'

export { ADDRESS_PREFIX, parseWorkbenchAddress, workbenchAddress }

const ID = '@zseven-w/dsh-xcode'
const KIND = 'xcode-workbench'
const PANEL_ID = '@zseven-w/dsh-xcode/panel'
const PANEL_KIND = 'xcode-workbench-launcher'
const STATE_REL_PATH = '.dsh-xcode/state.json'

const CARD_TOOLS = [
  'xcode_status',
  'xcode_open_project',
  'xcode_diagnostics',
  'xcode_build_test',
  'xcode_render_preview',
  'xcode_sync_skills',
] as const

type T = (key: Key, params?: Record<string, string>) => string
type ReadBytes = (sessionId: string, path: string, signal: AbortSignal) => Promise<{ data: Uint8Array }>
type RunCommand = (sessionId: string, input: string) => Promise<{ ok: boolean; text: string }>

function baseName(path: string): string {
  return path.split(/[\\/]/u).filter(Boolean).at(-1) ?? path
}

function joinPath(dir: string, rel: string): string {
  return `${dir.replace(/[\\/]+$/u, '')}/${rel.replace(/^[\\/]+/u, '')}`
}

const refreshBus = new EventTarget()
function announceRefresh(cwd: string): void {
  refreshBus.dispatchEvent(new CustomEvent('refresh', { detail: cwd }))
}

const tok = {
  text: 'var(--dsw-alias-label-primary, inherit)',
  muted: 'var(--dsw-alias-label-secondary, #888)',
  border: 'var(--dsw-alias-border-l2, rgba(128,128,128,.28))',
  layer: 'var(--dsw-alias-bg-layer-1, rgba(128,128,128,.07))',
  accent: '#1a78f2',
  ok: '#16a34a',
  warn: '#d97706',
  danger: 'var(--dsw-alias-label-danger, #dc2626)',
}

const st: Record<string, CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, color: tok.text, fontSize: 13 },
  bar: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: `1px solid ${tok.border}`, flexWrap: 'wrap' },
  button: { font: 'inherit', fontSize: 12, padding: '4px 9px', borderRadius: 6, border: `1px solid ${tok.border}`, background: 'transparent', color: 'inherit', cursor: 'pointer' },
  body: { flex: 1, overflow: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 12 },
  card: { border: `1px solid ${tok.border}`, borderRadius: 8, padding: '9px 10px', background: tok.layer },
  sectionTitle: { fontWeight: 600, fontSize: 12, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  pill: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '2px 7px', borderRadius: 999, border: `1px solid ${tok.border}` },
  muted: { fontSize: 12, color: tok.muted, lineHeight: 1.45 },
  errorBanner: { padding: '7px 10px', fontSize: 12, color: tok.danger, borderBottom: `1px solid ${tok.border}` },
  previewGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 },
  previewImg: { width: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 6, border: `1px solid ${tok.border}`, background: '#0f172a' },
  row: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, flexWrap: 'wrap' },
}

interface PersistedState {
  updatedAt: string
  xcodeVersion?: string
  xcodeBuild?: string
  connected: boolean
  xcodePid?: number
  openWindows: Array<{ tabIdentifier: string; workspacePath?: string; name?: string }>
  availableTools: string[]
  exportedSkills: string[]
  iosPeer?: {
    online: boolean
    streamedDevice: { udid: string; name: string; kind: 'simulator' | 'physical' } | null
  } | null
  lastDiagnostics?: {
    checkedAt: string
    target?: string
    items: Array<{ severity: 'error' | 'warning' | 'note'; file?: string; line?: number; message: string }>
    rawText: string
  }
  lastBuild?: {
    finishedAt: string
    action: string
    ok: boolean
    summary: string
  }
  previews: Array<{
    id: string
    sourceFilePath: string
    relativeImagePath: string
    mimeType: string
    bytes: number
    createdAt: string
  }>
  lastError?: string
}

function WorkbenchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}

interface WorkbenchCoreProps {
  sessionId: string
  cwd?: string
  t: T
  readBytes: ReadBytes
  runCommand: RunCommand
}

function WorkbenchCore({ sessionId, cwd: initialCwd, t, readBytes, runCommand }: WorkbenchCoreProps) {
  const [cwd, setCwd] = useState<string | undefined>(initialCwd)
  const [state, setState] = useState<PersistedState | null>(null)
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const invoke = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    if (!sessionId) return
    setBusy(action)
    setErr(null)
    try {
      const body = JSON.stringify({ ...(cwd ? { cwd } : {}), ...payload })
      const res = await runCommand(sessionId, `${action} ${body}`)
      if (!res.ok) {
        setErr(res.text)
        return
      }
      const parsed = JSON.parse(res.text)
      if (typeof parsed.cwd === 'string') setCwd(parsed.cwd)
      if (parsed.state) setState(parsed.state as PersistedState)
      if (parsed.status?.connectionError) setErr(String(parsed.status.connectionError))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }, [sessionId, cwd, runCommand])

  const loadFromDisk = useCallback(async (targetCwd: string, signal: AbortSignal) => {
    try {
      const raw = await readBytes(sessionId, joinPath(targetCwd, STATE_REL_PATH), signal)
      const parsed = JSON.parse(new TextDecoder().decode(raw.data)) as PersistedState
      setState(parsed)
    } catch {
      // No `.dsh-xcode/state.json` yet; fall back to live `/xcode status`.
      await invoke('status')
    }
  }, [sessionId, readBytes, invoke])

  useEffect(() => {
    if (!sessionId) return
    const ctrl = new AbortController()
    if (initialCwd) {
      setCwd(initialCwd)
      void loadFromDisk(initialCwd, ctrl.signal)
    } else {
      void invoke('status')
    }
    return () => ctrl.abort()
  }, [sessionId, initialCwd, loadFromDisk, invoke])

  useEffect(() => {
    const onRefresh = (ev: Event) => {
      const changedCwd = (ev as CustomEvent<string>).detail
      if (!cwd || changedCwd === cwd) {
        const ctrl = new AbortController()
        void loadFromDisk(changedCwd || cwd || '', ctrl.signal)
      }
    }
    refreshBus.addEventListener('refresh', onRefresh)
    return () => refreshBus.removeEventListener('refresh', onRefresh)
  }, [cwd, loadFromDisk])

  useEffect(() => {
    if (!sessionId || !cwd || !state?.previews?.length) return
    const ctrl = new AbortController()
    const createdUrls: string[] = []
    ;(async () => {
      const next: Record<string, string> = {}
      for (const p of state.previews.slice(0, 6)) {
        try {
          const bytes = await readBytes(sessionId, joinPath(cwd, p.relativeImagePath), ctrl.signal)
          const copy = new Uint8Array(bytes.data.byteLength)
          copy.set(bytes.data)
          const blob = new Blob([copy], { type: p.mimeType || 'image/png' })
          const url = URL.createObjectURL(blob)
          createdUrls.push(url)
          next[p.id] = url
        } catch {
          // Skip unreadable preview file.
        }
      }
      if (!ctrl.signal.aborted) setPreviewUrls(next)
    })()
    return () => {
      ctrl.abort()
      for (const url of createdUrls) URL.revokeObjectURL(url)
    }
  }, [sessionId, cwd, state?.previews, readBytes])

  const connected = state?.connected === true
  const diagItems = state?.lastDiagnostics?.items ?? []

  return (
    <div style={st.root}>
      <div style={st.bar}>
        <span style={{
          ...st.pill,
          borderColor: connected ? tok.ok : tok.border,
          color: connected ? tok.ok : tok.muted,
          fontWeight: 600,
        }}>
          <span style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: connected ? tok.ok : tok.muted,
          }} />
          {connected
            ? t('status.connected', { pid: String(state?.xcodePid ?? '?') })
            : t('status.standby')}
        </span>
        {state?.xcodeVersion && (
          <span style={st.pill}>
            {t('status.xcodeVersion', { version: state.xcodeVersion, build: state.xcodeBuild ?? '' })}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <button type="button" style={st.button} disabled={busy !== null} onClick={() => void invoke('status')}>
            {t('action.refresh')}
          </button>
          <button type="button" style={st.button} disabled={busy !== null} onClick={() => void invoke('open')}>
            {t('action.openProject')}
          </button>
          <button type="button" style={st.button} disabled={busy !== null} onClick={() => void invoke('diagnostics')}>
            {t('action.diagnostics')}
          </button>
          <button type="button" style={st.button} disabled={busy !== null} onClick={() => void invoke('build')}>
            {t('action.build')}
          </button>
          <button type="button" style={st.button} disabled={busy !== null} onClick={() => void invoke('sync-skills')}>
            {t('action.syncSkills')}
          </button>
        </div>
      </div>

      {(err || state?.lastError) && (
        <div style={st.errorBanner}>{err ?? state?.lastError}</div>
      )}

      <div style={st.body}>
        {state?.iosPeer && (
          <div style={st.card}>
            <div style={st.sectionTitle}>
              <span>📱 {t('section.iosPeer')}</span>
            </div>
            <div style={st.muted}>
              {state.iosPeer.online && state.iosPeer.streamedDevice
                ? t('iosPeer.streaming', {
                    name: state.iosPeer.streamedDevice.name,
                    kind: state.iosPeer.streamedDevice.kind === 'physical' ? t('iosPeer.kindPhone') : t('iosPeer.kindSim'),
                  })
                : t('iosPeer.ready')}
            </div>
          </div>
        )}

        <div style={st.card}>
          <div style={st.sectionTitle}>
            <span>🪟 {t('section.windows')}</span>
            <span style={st.muted}>{state?.openWindows?.length ?? 0}</span>
          </div>
          {!state?.openWindows?.length ? (
            <div style={st.muted}>{t('windows.empty')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {state.openWindows.map(win => (
                <div key={win.tabIdentifier} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <code style={{ padding: '1px 5px', borderRadius: 4, border: `1px solid ${tok.border}` }}>
                    {win.tabIdentifier}
                  </code>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {win.name ?? (win.workspacePath ? baseName(win.workspacePath) : '')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={st.card}>
          <div style={st.sectionTitle}>
            <span>🩺 {t('section.diagnostics')}</span>
            {state?.lastDiagnostics && (
              <span style={{ color: diagItems.some(i => i.severity === 'error') ? tok.danger : tok.ok, fontSize: 11 }}>
                {diagItems.length === 0 ? t('diagnostics.clean') : `${diagItems.length}`}
              </span>
            )}
          </div>
          {!state?.lastDiagnostics ? (
            <div style={st.muted}>{t('diagnostics.empty')}</div>
          ) : diagItems.length === 0 ? (
            <div style={{ ...st.muted, color: tok.ok }}>{t('diagnostics.clean')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflow: 'auto' }}>
              {diagItems.slice(0, 25).map((item, idx) => (
                <div key={idx} style={{ fontSize: 12, lineHeight: 1.4 }}>
                  <span style={{
                    color: item.severity === 'error' ? tok.danger : item.severity === 'warning' ? tok.warn : tok.muted,
                    fontWeight: 600,
                    marginRight: 6,
                  }}>
                    [{item.severity.toUpperCase()}]
                  </span>
                  {item.file && (
                    <code style={{ marginRight: 6, color: tok.muted }}>
                      {baseName(item.file)}{item.line ? `:${item.line}` : ''}
                    </code>
                  )}
                  <span>{item.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {state?.lastBuild && (
          <div style={st.card}>
            <div style={st.sectionTitle}>
              <span>🔨 {t('section.build')} ({state.lastBuild.action})</span>
              <span style={{ color: state.lastBuild.ok ? tok.ok : tok.danger, fontSize: 11 }}>
                {state.lastBuild.ok ? t('build.ok') : t('build.failed')}
              </span>
            </div>
            <div style={{ ...st.muted, whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto' }}>
              {state.lastBuild.summary}
            </div>
          </div>
        )}

        <div style={st.card}>
          <div style={st.sectionTitle}>
            <span>🖼️ {t('section.previews')}</span>
            <span style={st.muted}>{state?.previews?.length ?? 0}</span>
          </div>
          {!state?.previews?.length ? (
            <div style={st.muted}>{t('previews.empty')}</div>
          ) : (
            <div style={st.previewGrid}>
              {state.previews.slice(0, 6).map(prev => (
                <div key={prev.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {previewUrls[prev.id] && (
                    <img src={previewUrls[prev.id]} alt={baseName(prev.sourceFilePath)} style={st.previewImg} />
                  )}
                  <span style={{ ...st.muted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {baseName(prev.sourceFilePath)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {Boolean(state?.exportedSkills?.length) && (
          <div style={st.card}>
            <div style={st.sectionTitle}>
              <span>📘 {t('section.skills', { count: String(state?.exportedSkills?.length ?? 0) })}</span>
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {state!.exportedSkills.map(sk => (
                <span key={sk} style={st.pill}>{sk}</span>
              ))}
            </div>
          </div>
        )}

        {Boolean(state?.availableTools?.length) && (
          <div style={st.card}>
            <div style={st.sectionTitle}>
              <span>🧰 {t('section.tools', { count: String(state?.availableTools?.length ?? 0) })}</span>
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {state!.availableTools.map(tool => (
                <code key={tool} style={{ ...st.pill, fontSize: 10 }}>{tool}</code>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface ResourceTabInjected {
  readBytes: ReadBytes
  runCommand: RunCommand
}

function ResourceWorkbenchTab(props: any) {
  const { address, t, readBytes, runCommand } = props as { address: string; t: T } & ResourceTabInjected
  const parsed = parseWorkbenchAddress(String(address ?? ''))
  return (
    <WorkbenchCore
      sessionId={parsed?.sessionId ?? ''}
      cwd={parsed?.cwd}
      t={t}
      readBytes={readBytes}
      runCommand={runCommand}
    />
  )
}

interface LauncherTabInjected {
  panelSession: string
  readBytes: ReadBytes
  runCommand: RunCommand
}

function LauncherWorkbenchTab(props: any) {
  const { panelSession, t, readBytes, runCommand } = props as { t: T } & LauncherTabInjected
  return (
    <WorkbenchCore
      sessionId={panelSession}
      t={t}
      readBytes={readBytes}
      runCommand={runCommand}
    />
  )
}

interface RowInjected {
  openWorkbench: (sessionId: string, cwd: string) => void
}

function XcodeToolRow(props: any) {
  const { block, sessionId, t, openWorkbench } = props as {
    block: any
    sessionId: string
    t: T
  } & RowInjected
  const toolName = String(block?.toolName ?? block?.name ?? '')
  const meta = block?.presentationMeta
  const cwd = typeof meta?.cwd === 'string' ? meta.cwd : undefined
  const settled = block?.status === 'completed' || block?.status === 'error' || block?.isError === true
  const failed = block?.status === 'error' || block?.isError === true

  useEffect(() => {
    if (settled && cwd) announceRefresh(cwd)
  }, [settled, cwd])

  const label = toolName === 'xcode_open_project'
    ? t('row.open')
    : toolName === 'xcode_diagnostics'
      ? t('row.diagnostics')
      : toolName === 'xcode_build_test'
        ? t('row.build')
        : toolName === 'xcode_render_preview'
          ? t('row.preview')
          : toolName === 'xcode_sync_skills'
            ? t('row.skills')
            : t('row.status')

  const errDetail = failed
    ? (block?.content ?? []).map((item: any) => (item?.type === 'text' ? item.text : '')).join(' ').slice(0, 220)
    : ''

  return (
    <div style={st.row} data-tool={toolName}>
      <span aria-hidden>🔨</span>
      <span>{label}</span>
      {errDetail && <span style={{ fontSize: 11, color: tok.danger }}>{errDetail}</span>}
      {cwd && sessionId && (
        <button type="button" style={st.button} onClick={() => openWorkbench(sessionId, cwd)}>
          {t('row.openPanel')}
        </button>
      )}
    </div>
  )
}

export const inject = [
  'slots',
  'locale',
  'remote',
  'remote.workspaceFiles',
  'remote.commands',
  'sidebarRight',
  'sidebarRightTabs',
]

export function apply(ctx: any): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-xcode: dictionaries')
  const t: T = ctx.locale.bind(NS)

  const openWorkbench = (sessionId: string, cwd: string) => {
    ctx.sidebarRight.openResource(workbenchAddress(sessionId, cwd))
  }

  const readBytes: ReadBytes = async (sessionId, path, signal) => {
    const res = await ctx.remote.workspaceFiles.readBytes(sessionId, path, {}, signal)
    if (!res.ok) throw new Error(`${res.error?.message ?? 'read failed'} (${path})`)
    return res.value
  }

  const runCommand: RunCommand = async (sessionId, input) => {
    try {
      const res = await ctx.remote.commands.execute(sessionId, `/xcode ${input}`, [])
      if (!res.ok) return { ok: false, text: `${res.error?.message ?? 'command failed'}` }
      const value = res.value?.result ?? res.value
      if (value === undefined) return { ok: false, text: 'The /xcode command is not available in this session' }
      return { ok: value.kind === 'success', text: String(value.text ?? '') }
    } catch (error) {
      return { ok: false, text: error instanceof Error ? error.message : String(error) }
    }
  }

  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: ID,
    kind: KIND,
    patterns: ['dsh-resource://xcode-workbench/**'],
    priority: 'extension',
    canOpen: (address: string) => parseWorkbenchAddress(address) !== undefined,
    title: (address: string) => {
      const parsed = parseWorkbenchAddress(address)
      return t('tab.title', { name: parsed ? baseName(parsed.cwd) : 'Xcode' })
    },
  }), 'dsh-xcode: resource tab')

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: ID,
    locale: NS,
    inject: (): ResourceTabInjected => ({ readBytes, runCommand }),
  }, ResourceWorkbenchTab)), 'dsh-xcode: resource tab body')

  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: PANEL_ID,
    kind: PANEL_KIND,
    title: () => t('tab.launcherTitle'),
    guide: [{
      id: 'xcode-workbench',
      order: 65,
      title: () => t('guide.title'),
      description: () => t('guide.description'),
      icon: WorkbenchIcon,
    }],
  }), 'dsh-xcode: launcher tab')

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: PANEL_ID,
    locale: NS,
    inject: (sessionId: string): LauncherTabInjected => ({
      panelSession: typeof sessionId === 'string' ? sessionId : '',
      readBytes,
      runCommand,
    }),
  }, LauncherWorkbenchTab)), 'dsh-xcode: launcher tab body')

  for (const tool of CARD_TOOLS) {
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
      name: 'tool.call.toolview',
      key: tool,
      locale: NS,
      inject: (): RowInjected => ({ openWorkbench }),
    }, XcodeToolRow))
  }
}
