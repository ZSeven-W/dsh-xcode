# @zseven-w/dsh-xcode

Official Xcode Model Context Protocol (`xcrun mcpbridge`) & Apple Skills plugin for **DeepSeek Harness (DSH)**.

[简体中文](./README.zh.md) · MIT License

---

## Why `dsh-xcode`?

Apple ships an official MCP bridge (`xcrun mcpbridge`) and built-in agent `SKILL.md` bundles inside Xcode 26.3+. However, raw STDIO MCP wiring into coding agents hits several sharp edges in practice:

1. **Xcode 26 `structuredContent` mismatch**: tools such as `XcodeListWindows` declare an `outputSchema` while returning JSON inside `content[0].text` and omitting `structuredContent`, causing strict MCP SDK clients to reject valid responses.
2. **Lifecycle & PID routing**: `mcpbridge` fails immediately when Xcode is closed, when multiple Xcode versions are running (`Xcode.app` vs `Xcode-beta.app`), or before external agent access is enabled in **Xcode → Settings → Intelligence**.
3. **Context bloat**: Xcode exposes ~20+ raw tools and returns multi-megabyte base64 PNG payloads from `RenderPreview`.

`@zseven-w/dsh-xcode` wraps `xcrun mcpbridge` into a zero-dependency, native DSH `0.2.1+` plugin with:

- **8 compact model-facing tools** with automatic `tabIdentifier` resolution and Xcode 26 JSON normalization.
- **Single-file compiler diagnostics (`< 1 s`)** via `XcodeRefreshCodeIssuesInFile` — check Swift/ObjC edits without running a cold `xcodebuild`.
- **Native SwiftUI `#Preview` snapshots** saved to `.dsh-xcode/previews/` and attached to multimodal model turns via DSH `attachments.saveImage`.
- **Apple Official `SKILL.md` Sync**: exports Xcode's built-in skills (`xcrun agent skills export`) and registers them dynamically into `ctx.skills`.
- **Web Right-Sidebar Xcode Workbench**: live connection pill, open workspace windows, compiler diagnostics, incremental build status, rendered `#Preview` gallery, and `@zseven-w/dsh-ios` peer status.
- **Zero-dependency peer linkage with `@zseven-w/dsh-ios`**: IDE intelligence (`dsh-xcode`) + live Simulator / USB iPhone video stream & UI automation (`dsh-ios`).

## Requirements

- **macOS** with **Xcode 26.3+** installed and selected (`xcode-select -p` pointing to `/Applications/Xcode.app/Contents/Developer`).
- **DeepSeek Harness** `0.2.1-rc.5` or newer.
- One-time Xcode toggle: open **Xcode → Settings → Intelligence → Model Context Protocol** and enable **Allow External Agents** (approve the permission prompt when Xcode asks).

## Installation

### Local workspace link (development)

```bash
pnpm --dir /path/to/dsh-xcode install
pnpm --dir /path/to/dsh-xcode run build

# Install into your DSH web profile
dsh plugin --profile web add link:/path/to/dsh-xcode
```

### From npm (once published)

```bash
dsh plugin --profile web add @zseven-w/dsh-xcode
```

## Model-Facing Tools (8)

| Tool | Underlying Xcode Capability | Purpose |
| --- | --- | --- |
| `xcode_status` | `xcode-select`, `xcrun`, `XcodeListWindows` | Inspect Xcode version, `mcpbridge` readiness, running PIDs, open `tabIdentifier` windows, synced Apple skills, and `dsh-ios` peer state |
| `xcode_open_project` | `open -a Xcode` + `XcodeListWindows` | Auto-detect and open `.xcworkspace`, `.xcodeproj`, or `Package.swift` in Xcode and wait until `mcpbridge` is ready |
| `xcode_diagnostics` | `XcodeRefreshCodeIssuesInFile` / `XcodeListNavigatorIssues` | Instant single-file Swift/ObjC typecheck (`filePath`) or workspace-wide Issue Navigator diagnostics |
| `xcode_build_test` | `BuildProject`, `GetBuildLog`, `GetTestList`, `RunAllTests`, `RunSomeTests` | Warm incremental scheme builds, filtered build logs, and XCTest / Swift Testing runs |
| `xcode_render_preview` | `RenderPreview` | Render SwiftUI `#Preview` / `PreviewProvider` snapshots natively in Xcode (`.xcodeproj`, `.xcworkspace`, or SwiftPM) |
| `xcode_search_docs` | `DocumentationSearch` | Semantic search over Xcode's local Apple Developer Documentation & WWDC transcripts |
| `xcode_sync_skills` | `xcrun agent skills export` | Export and register Apple's official `SKILL.md` bundles from the active Xcode build |
| `xcode_call_tool` | Any `mcpbridge` tool | Escape hatch to list or call any raw Xcode MCP tool (`ExecuteSnippet`, `XcodeUpdate`, Xcode 27+ `DeviceInteraction*`, etc.) |

## Pairing with `@zseven-w/dsh-ios`

Install both plugins in the same DSH profile for a complete Apple engineering loop. Neither plugin depends on the other at install time; when both are loaded, they discover each other in-process via `Symbol.for('zseven.dsh.apple.peer.v1')`:

- **Use `@zseven-w/dsh-xcode` (`xcode_*`)** for IDE & compiler intelligence: `< 1 s` single-file diagnostics, warm scheme builds/tests, `.xcodeproj` SwiftUI `#Preview` rendering, and Apple documentation search.
- **Use `@zseven-w/dsh-ios` (`ios_sim_*`)** for live device runtime & UI automation: interactive Simulator / USB physical iPhone streaming in the DSH sidebar, AXe accessibility trees, Vision OCR taps, unified logs, LLDB backtraces, and `leaks`.

## Configuration (`cordis.patch.yml`)

All settings are optional:

```yaml
plugins:
  dsh-xcode:
    # Pin a specific running Xcode PID when multiple Xcode apps are open:
    # xcodePid: 12345
    # Timeout (ms) for BuildProject / RunAllTests / RenderPreview (default: 180000):
    # callTimeoutMs: 180000
    # Auto-export Apple's built-in SKILL.md bundles when Xcode connects (default: true):
    # autoSyncSkills: true
```

## Verification

```bash
pnpm run typecheck
pnpm test
```

## License

MIT © ZSeven-W
