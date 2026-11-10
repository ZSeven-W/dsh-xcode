# Install and Start DSH Xcode Bridge (`@zseven-w/dsh-xcode`)

Give Codex, Claude Code, or Antigravity this prompt:

> Install and set up https://github.com/ZSeven-W/dsh-xcode following its INSTALL.md, and verify the Xcode MCP bridge tools.

中文：

> 按照 https://github.com/ZSeven-W/dsh-xcode 的 INSTALL.md 帮我安装并验证 DSH Xcode Bridge 插件。

---

## 1. DeepSeek Harness (DSH)

```bash
dsh plugin add @zseven-w/dsh-xcode
```

Optional pairing with `@zseven-w/dsh-ios` for live iOS Simulator / physical device streaming & UI interaction:

```bash
dsh plugin add @zseven-w/dsh-ios
```

---

## 2. Codex (`codex plugin`)

### Instructions for the installing agent

1. Require **macOS**, **Xcode 26.3+**, **Node.js 22+**, **Git**, and a recent **Codex CLI** with `codex plugin marketplace` and `codex plugin add`. No `npm install` or `pnpm install` is required because `plugins/xcode/scripts/mcp-server.mjs` is pre-bundled with zero external dependencies.
2. Clone the repository to a persistent location and run `npm run setup`:

   ```bash
   git clone https://github.com/ZSeven-W/dsh-xcode.git
   cd dsh-xcode
   npm run setup
   ```

3. `npm run setup` (alias for `node scripts/install-hosts.mjs codex`) performs four verified steps:
   - Records the current Node executable in `~/.dsh-xcode/node-path` so the Codex Desktop GUI app can launch the stdio MCP bridge even when GUI `PATH` differs from the terminal.
   - Registers this checkout as the `zseven-xcode` local marketplace (`codex plugin marketplace add`).
   - Installs `dsh-xcode@zseven-xcode` (`codex plugin add dsh-xcode@zseven-xcode`).
   - Exercises Codex's real `codex app-server` plugin loader (`mcpServerStatus/list`) to verify `dsh_xcode` loads cleanly from `dsh-xcode@zseven-xcode` with all 8 tools (`xcode_status`, `xcode_open_project`, `xcode_diagnostics`, `xcode_build_test`, `xcode_render_preview`, `xcode_search_docs`, `xcode_sync_skills`, `xcode_call_tool`) and zero `toolsError`.

---

## 3. Claude Code / Antigravity / Grok CLI

From the cloned `dsh-xcode` repository, run the one-click host installer for your preferred coding agent:

```bash
node scripts/install-hosts.mjs claude   # Register .claude-plugin marketplace + install dsh-xcode@dsh-xcode + permissions
node scripts/install-hosts.mjs agy      # Register MCP server + skill in ~/.gemini/config/
node scripts/install-hosts.mjs grok     # Register [mcp_servers.dsh-xcode] in ~/.grok/config.toml
node scripts/install-hosts.mjs all      # Install across Codex, Claude Code, Antigravity, and Grok
```

To uninstall cleanly:

```bash
node scripts/install-hosts.mjs uninstall-codex
node scripts/install-hosts.mjs uninstall-claude
node scripts/install-hosts.mjs uninstall-agy
node scripts/install-hosts.mjs uninstall-grok
```

---

## 4. Xcode Prerequisite

Before running diagnostics, previews, or builds:
1. Open your `.xcworkspace`, `.xcodeproj`, or `Package.swift` in **Xcode 26.3+** (or call `xcode_open_project`).
2. Enable **Xcode → Settings → Intelligence → Model Context Protocol → Allow External Agents**.
