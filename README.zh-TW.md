<p align="center">
  <img src="./docs/images/dsh-xcode-logo.png" alt="DSH Xcode" width="120" />
</p>

<h1 align="center">DSH Xcode 工作台</h1>

<p align="center">
  <strong>在 <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> 對話中直連 Apple 官方 Xcode MCP 橋接器（<code>xcrun mcpbridge</code>）與內建 Apple Skills——並與 <a href="https://github.com/ZSeven-W/dsh-ios">DSH iOS</a> 無縫協同。</strong><br />
  <sub>8 個代理程式工具 &bull; &lt; 1 秒單檔編譯診斷 &bull; 原生 SwiftUI <code>#Preview</code> 快照 &bull; 熱快取增量建置與測試 &bull; 本機 Apple 文件檢索 &bull; 右側欄 Xcode 工作台</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-xcode</code> &middot; 目前的外掛版本：<code>0.1.0-rc.2</code> &middot; 已在 DSH <code>0.2.1-rc.5</code> 下測試</sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <b>繁體中文</b> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-xcode/actions/workflows/check.yml"><img src="https://img.shields.io/github/actions/workflow/status/ZSeven-W/dsh-xcode/check.yml?label=CI" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@zseven-w/dsh-xcode"><img src="https://img.shields.io/npm/v/@zseven-w/dsh-xcode?color=1a78f2" alt="npm" /></a>
  <a href="https://github.com/ZSeven-W/dsh-xcode/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-xcode?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-xcode-banner.png" alt="DSH Xcode — 在 DeepSeek Harness 中直連 Apple 官方 Xcode MCP 橋接器與內建 Apple Skills" width="100%" />
</p>

## 為什麼選擇 DSH Xcode

從 Xcode 26.3 起，Apple 在工具鏈中內建了官方 Model Context Protocol 橋接器（`xcrun mcpbridge`，透過本機 XPC 直連執行中的 Xcode），以及官方 `SKILL.md` 技能匯出工具（`xcrun agent skills export`）。但如果直接把裸 `xcrun mcpbridge` 掛進通用代理程式，會遇到三個明顯的工程障礙：

1. **Xcode 26 `structuredContent` 協定不一致** — `XcodeListWindows` 等工具在 `tools/list` 中宣告了 `outputSchema`，實際回傳時卻把 JSON 放進 `content[0].text` 且省略 `structuredContent`，導致嚴格校驗 Schema 的標準 MCP 用戶端直接報錯拒收。
2. **處理程序生命週期與多開 PID 路由** — Xcode 未開啟、同時執行正式版 `Xcode.app` 與 `Xcode-beta.app`、或尚未在 **Xcode → Settings → Intelligence** 開啟外部代理程式權限時，裸 STDIO 處理程序會直接退出或拋出底層 XPC 錯誤。
3. **上下文膨脹** — Xcode 原生暴露 20+ 個細粒度工具，且 `RenderPreview` 會回傳數 MB 的 Base64 PNG 字串。

`DSH Xcode` 將 Apple 官方橋接器封裝為零執行階段相依的原生 DSH 外掛，提供常駐右側欄的 **Xcode 工作台**，並與 [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios) 實現零耦合雙外掛聯動。

| | |
| --- | --- |
| ⚡ **&lt; 1 秒單檔診斷** | `xcode_diagnostics` 傳入 `filePath` 時直接呼叫 `XcodeRefreshCodeIssuesInFile`，複用 Xcode 記憶體中的增量編譯圖，對單一 Swift/ObjC 檔案秒級查錯，不必每次編輯都冷啟動 `xcodebuild`。 |
| 🖼️ **原生 SwiftUI `#Preview` 快照** | `xcode_render_preview` 驅動 Xcode 原生 `RenderPreview` 引擎，同時支援 `.xcodeproj`、`.xcworkspace` 與 Swift Package，快照自動寫入 `.dsh-xcode/previews/`，並在多模態模型下直接附上圖片內容。 |
| 🔨 **熱快取增量建置與單元測試** | `xcode_build_test` 複用 Xcode 熱 DerivedData 建置圖，執行 `BuildProject`、`GetBuildLog`、`GetTestList`、`RunAllTests` 與 `RunSomeTests`（相容 XCTest 與 Swift Testing）。 |
| 🔧 **Xcode 26 協定相容與自動路由** | 自動將單塊 JSON 文字回填至 `structuredContent`，在多視窗場景下按專案路徑自動匹配 `tabIdentifier`，並剝離超大 Base64 欄位，避免撐爆模型上下文。 |
| 📘 **Apple 官方 `SKILL.md` 同步** | 呼叫 `xcrun agent skills export` 匯出目前 Xcode 版本內建的官方技能包，按建置號碼快取至 `~/.cache/dsh-xcode/skills/`，並動態註冊進 DSH `ctx.skills`。 |
| 🪟 **右側欄「Xcode 工作台」** | 即時顯示連線狀態與 PID、已開啟的專案視窗（`tabIdentifier`）、編譯器診斷清單、建置/測試摘要、SwiftUI `#Preview` 渲染圖庫，以及 `dsh-ios` 裝置連線狀態。 |
| 📱 **與 `dsh-ios` 雙劍合璧** | 安裝期間零相依，同處理程序透過 `Symbol.for('zseven.dsh.apple.peer.v1')` 自動發現：IDE 編譯查錯交給 `dsh-xcode`，模擬器/USB 實機即時串流與無障礙/OCR 互動交給 `dsh-ios`。 |
| 🧭 **面向未來的逃生艙** | `xcode_call_tool` 支援隨時列出並呼叫任意原生 `mcpbridge` 工具（如 `ExecuteSnippet`、`XcodeUpdate` 或 Xcode 27+ 新增的 `DeviceInteraction*`），無需等待外掛發版。 |

## 工具列表

全部 8 個工具在任何主機上都會註冊；省略 `tabIdentifier` 時自動按目前工作區匹配已開啟的視窗；非 macOS 主機或未啟動 Xcode 時，會回傳明確可操作的修復指引。

| 工具 | 作用 | 關鍵參數 |
| --- | --- | --- |
| `xcode_status` | 檢查本機 `xcode-select` 開發者目錄、Xcode 版本/建置號碼、`xcrun mcpbridge` 與 `agent` 能力、執行中 `Xcode.app` PID、已開啟的專案視窗（`tabIdentifier`）、已同步的官方 Skills，以及 `dsh-ios` 連動狀態。 | `connect`（預設 `true`） |
| `xcode_open_project` | 自動探測並在 Xcode 中開啟 `.xcworkspace`、`.xcodeproj` 或 `Package.swift`，輪詢等待 `mcpbridge` 連線就緒並回報對應視窗的 `tabIdentifier`。 | `projectPath`（可選）、`waitSeconds`（預設 `20`） |
| `xcode_diagnostics` | 讀取 Xcode 即時編譯報錯與警告。傳入 `filePath` 執行 `< 1 秒` 單檔查錯（`XcodeRefreshCodeIssuesInFile`）；不傳則讀取全域 Issue Navigator 診斷（`XcodeListNavigatorIssues`）。 | `filePath`、`projectPath`、`tabIdentifier`、`severity`（`error`/`warning`/`remark`）、`pattern` |
| `xcode_build_test` | 複用 Xcode 熱建置圖，編譯目前活躍的 Scheme、讀取過濾後的建置日誌，或列出/執行 XCTest 與 Swift Testing 測試。 | `action`（必填——`build`/`build_log`/`list_tests`/`run_all_tests`/`run_some_tests`）、`tests`（JSON 陣列）、`severity`、`pattern` |
| `xcode_render_preview` | 在 Xcode 內原生渲染 SwiftUI `#Preview` 或 `PreviewProvider` 快照，將 PNG 儲存至 `.dsh-xcode/previews/` 供工作台展示，並在多模態模型下附上圖片。 | `sourceFilePath`（必填）、`previewDefinitionIndexInFile`（預設 `0`）、`projectPath`、`tabIdentifier` |
| `xcode_search_docs` | 語意檢索 Xcode 內建的 Apple Developer Documentation 與 WWDC 講座逐字稿（`DocumentationSearch`）。 | `query`（必填）、`frameworks`（可選，逗號分隔，如 `"SwiftUI,Observation"`） |
| `xcode_sync_skills` | 透過 `xcrun agent skills export` 匯出目前 Xcode 內建的 Apple 官方 `SKILL.md` 技能包，並註冊到目前的 DSH 工作階段。 | — |
| `xcode_call_tool` | 列出目前 Xcode 暴露的所有底層 MCP 工具（`action: "list"`），或直接呼叫指定的底層工具（`action: "call"`）。 | `action`（必填——`list`/`call`）、`toolName`、`argumentsJson` |

## 介面形態

- **右側欄面板——「Xcode 工作台」。** 點擊任一工具列上的 **開啟工作台** 按鈕，或在右側欄 **`+`** 啟動器中選擇 **Xcode 工作台** 即可開啟。面板會顯示 Xcode 連線狀態膠囊與 PID、Xcode 版本/建置號碼、`dsh-ios` 即時裝置連動、已開啟的專案視窗（`tabIdentifier`）、附檔案與行號徽章的最新編譯診斷、最近一次建置/測試結果、SwiftUI `#Preview` 縮圖、已同步的 Apple Skills，以及已掛載的底層工具。工具列按鈕（**重新整理**、**開啟專案**、**檢查報錯**、**增量建置**、**同步官方 Skills**）透過 `/xcode` 工作階段指令直接執行，不消耗模型 Token。
- **精簡對話卡片。** 工具呼叫（`xcode_status`、`xcode_open_project`、`xcode_diagnostics`、`xcode_build_test`、`xcode_render_preview`、`xcode_sync_skills`）會渲染中英雙語精簡狀態列（`zh` / `en`），並在呼叫完成時自動通知已開啟的工作台分頁重新整理。

## 與 DSH iOS（`@zseven-w/dsh-ios`）協同

`dsh-xcode` 與 [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios) **沒有任何安裝期硬相依**，可單獨使用，也可同時裝入同一個 DSH Profile。同時掛載時，兩者透過同處理程序 `Symbol.for('zseven.dsh.apple.peer.v1')` 自動協同：

- **`dsh-xcode`（`xcode_*`）負責 IDE 與編譯器閉環** — 編輯程式碼時的 `< 1 秒` 單檔查錯、熱快取 Scheme 建置與單元測試、`.xcodeproj` / `.xcworkspace` 原生 SwiftUI `#Preview` 渲染，以及本機 Apple 文件查詢。
- **`dsh-ios`（`ios_sim_*`）負責裝置執行階段與 UI 自動化** — 側欄中的模擬器與 USB 實機 iPhone 即時 MJPEG 視訊串流、AXe 無障礙樹（`ios_sim_ui_tree`、`ios_sim_tap_element`、`ios_sim_ui_rows`）、Vision OCR 文字尋找/點按（`ios_sim_find_text`、`ios_sim_tap_text`）、統一執行階段日誌（`ios_sim_logs`）、LLDB 呼叫堆疊與 `leaks` 記憶體洩漏檢測。
- **跨外掛智慧引導** — 當模型對 `.xcodeproj` / `.xcworkspace` 專案誤呼叫僅適用於 Swift Package 的 `ios_sim_preview` 時，`dsh-ios` 會自動識別已掛載的 `dsh-xcode`，並引導模型改用 `xcode_render_preview`。

## 安全與隱私

- **純本機 XPC 傳輸** — `xcrun mcpbridge` 僅透過 macOS XPC 與本機執行中的 Xcode 溝通，外掛不監聽任何網路埠，也不發起任何外部網路請求。
- **環境變數清洗** — 啟動 `xcrun mcpbridge` 或 `xcrun agent` 子處理程序前，`scrubEnvForMcpBridge` 會自動剔除所有名稱符合 `*KEY*`、`*SECRET*`、`*TOKEN*`、`*PASSWORD*` 與 `DSH_*` 的變數，僅保留 macOS 開發與 XPC 必需的基礎環境（`HOME`、`USER`、`PATH`、`TMPDIR`、`DEVELOPER_DIR`、`MCP_XCODE_PID`、`MCP_XCODE_SESSION_ID`）。
- **Xcode 原生明確授權** — 外部代理程式存取受 Xcode 自身的 **Settings → Intelligence → Model Context Protocol** 開關與 macOS/Xcode 權限對話框雙重管控。
- **嚴格的二進位邊界** — MCP 圖片區塊解碼前會先驗證標準 Base64 格式與 20 MB 的嚴格上限；原始 JSON 內容中的超大 Base64 字串也會被自動剝離，確保模型上下文乾淨。

## 環境需求

- **macOS** + **Xcode 26.3（含）以上版本**（`xcode-select -p` 需指向完整 `/Applications/Xcode.app/Contents/Developer`，而非僅安裝 Command Line Tools）。
- **DeepSeek Harness** `0.2.1-rc.5`（含）以上版本，Node.js `>= 24.11.0`。
- **首次開啟權限** — 開啟 **Xcode → Settings → Intelligence → Model Context Protocol**，勾選允許外部代理程式（首次連線時在 Xcode 授權對話框中點擊 **Allow**）。

## 安裝到 DSH

```sh
dsh plugin --profile web add @zseven-w/dsh-xcode@latest
dsh web
```

建議同時安裝 `dsh-ios`，獲得完整的「Xcode IDE 編譯診斷 + 模擬器/實機即時畫面互動」閉環：

```sh
dsh plugin --profile web add @zseven-w/dsh-ios@latest
```

## 快速開始

1. **檢查狀態並開啟專案** — *「檢查一下 Xcode 狀態，並開啟目前資料夾裡的 iOS 專案。」* → `xcode_status` / `xcode_open_project`（首次執行請在 Xcode 對話框中點擊 Allow）。
2. **秒級單檔查錯** — *「重構 `HomeView.swift`，先別完整建置，單檔查一下有沒有編譯錯誤。」* → `xcode_diagnostics`（`filePath: "Sources/HomeView.swift"`）。
3. **渲染 SwiftUI `#Preview`** — *「渲染 `HomeView.swift` 的 SwiftUI 預覽，看看排版。」* → `xcode_render_preview`。在右側欄開啟 **Xcode 工作台** 即可檢視渲染後的快照。
4. **查文件與跑單元測試** — *「搜一下本機 Apple 文件裡 `NavigationSplitView` 的分欄控制寫法，然後跑一遍測試。」* → `xcode_search_docs` → `xcode_build_test`（`action: "run_all_tests"`）。

## 設定項

可在 Profile 的 `cordis.patch.yml` 中 `plugins.dsh-xcode` 下按需設定（全部可選）：

| 設定項 | 預設值 | 說明 |
| --- | --- | --- |
| `xcodePid` | 自動解析 | 同時開啟正式版與 Beta 版 Xcode 時，指定要附著的 Xcode 處理程序 PID（`MCP_XCODE_PID`）。 |
| `callTimeoutMs` | `180000` | `BuildProject`、`RunAllTests`、`RenderPreview` 等長耗時呼叫的預設逾時毫秒數。 |
| `autoSyncSkills` | `true` | 在 `xcode_status` 或 `xcode_open_project` 連線成功時自動匯出並註冊 Apple 內建 `SKILL.md` 技能包。 |
| `skillsCacheDir` | `~/.cache/dsh-xcode/skills` | 按 Xcode 建置號碼快取官方 `SKILL.md` 的本機目錄。 |

## 疑難排解

- **提示找不到 `mcpbridge` 或指向 Command Line Tools** — 目前 `xcode-select -p` 指向了 `/Library/Developer/CommandLineTools` 或舊版 Xcode（< 26.3）。請執行 `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` 切換到 Xcode 26.3+。
- **`Could not establish MCP tool session with Xcode`** — 請確認已在 Xcode 中開啟至少一個專案/工作區視窗（可呼叫 `xcode_open_project`），在 **Xcode → Settings → Intelligence → Model Context Protocol** 中開啟外部代理程式權限，並留意 Xcode 是否在背景彈出了 Allow 授權對話框。
- **同時開了多個 Xcode** — 外掛預設優先匹配 `xcode-select -p` 對應的 Xcode 路徑；若同一路徑多開，可在設定中指定 `xcodePid` 或設定環境變數 `DSHPLUGIN_XCODE_PID=<pid>`。
- **複雜 `#Preview` 巨集渲染失敗** — 部分多 Target 專案中 `#Preview` 巨集可能無法自動推斷裝置形態，在檔案中補上標準 `PreviewProvider` 結構，即可穩定透過 `xcode_render_preview` 渲染。

## 本機開發與測試

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run smoke:pack
```

以本機目錄連結方式掛載到 DSH Web Profile：

```sh
dsh plugin --profile web add link:/path/to/dsh-xcode
dsh web
```

| 測試套件 | 涵蓋範圍 |
| --- | --- |
| `test/mcp-stdio.test.mjs` | STDIO JSON-RPC 握手、分頁 `tools/list`、Xcode 26 省略 `structuredContent` 自動回填、標準 Base64 PNG 解碼、大體積 Base64 剝離、環境變數清洗、錯誤分類。 |
| `test/env-and-bridge.test.mjs` | `ps` 中 `Xcode.app` 與 `Simulator.app` 處理程序區分、PID 選擇優先級、`.xcworkspace`/`.xcodeproj`/`Package.swift` 探測、`tabIdentifier` 自動匹配、診斷/建置/預覽狀態持久化、`SKILL.md` 匯出與宿主 `apply()` 生命週期。 |
| `test/client-bundle.test.mjs` | `window.__ModuleLoader__.load` 產物形態、外部化宿主 React 不變量、`zh`/`en` 字詞一致性、工作台資源位址編解碼、右側欄分頁與 Slot 註冊。 |
| `test/ios-peer-linkage.test.mjs` | 與 `@zseven-w/dsh-ios` 的同處理程序 `Symbol.for('zseven.dsh.apple.peer.v1')` 即時互通，以及 `.xcodeproj` → `xcode_render_preview` 智慧路由。 |

## 生態系專案（Ecosystem）

- [DSH iOS Simulator](https://github.com/ZSeven-W/dsh-ios) — 在對話中嵌入即時可互動的 iOS 模擬器與 USB 實機畫面，支援 AXe 無障礙樹、Vision OCR 與 SwiftPM 預覽熱重載
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — 透過 `adb` 全面驅動的即時 Android 模擬器或 USB 裝置
- [DSH Computer](https://github.com/ZSeven-W/dsh-computer) — AX 優先觀測與宿主審批的 headless-first macOS Computer Use 驅動器
- [DSH Browser](https://github.com/ZSeven-W/dsh-browser) — 具備語意引用與有界證據的隔離 Chromium 工作階段
- [DSH QA](https://github.com/ZSeven-W/dsh-qa) — 跨 Browser、Desktop、iOS 與 Android 的代理程式探索測試與確定性情境重放
- [DSH Game Studio](https://github.com/ZSeven-W/dsh-game-studio) — 一句話描述 2D 或 3D 體素遊戲，在側邊欄遊玩、換上 AI 美術圖、一鍵發佈
- [DSH Harbor](https://github.com/ZSeven-W/dsh-harbor) — 為已安裝外掛提供能力盤點、衝突偵測與 DSH 升級預檢
- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — 從 Claude Code / Codex 以原生子代理程式身分派發工作給 DSH 代理程式
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — 為 DSH 提供持久、可稽核的長期代理程式記憶
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — 在 DSH 對話中預覽、審查與編輯 `.op` OpenPencil 設計文件

## 授權條款

MIT © ZSeven-W
