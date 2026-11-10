# @zseven-w/dsh-xcode

面向 **DeepSeek Harness (DSH)** 的 Apple 官方 Xcode MCP 桥接（`xcrun mcpbridge`）与内置 Apple Skills 插件。

[English](./README.md) · MIT License

---

## 为什么需要 `dsh-xcode`？

从 Xcode 26.3 起，Apple 在命令行工具链中内置了官方 `xcrun mcpbridge`（通过 XPC 直连运行中的 Xcode IDE）以及 `xcrun agent skills export` 官方 `SKILL.md` 导出能力。但直接把裸 `xcrun mcpbridge` 挂进通用 Agent 会遇到几个现实坑：

1. **Xcode 26 `structuredContent` 协议不一致**：`XcodeListWindows` 等工具在 `tools/list` 声明了 `outputSchema`，但实际返回时把 JSON 塞进 `content[0].text` 且省略了 `structuredContent`，会导致严格校验 schema 的标准 MCP 客户端直接报错拒收。
2. **生命周期与多开 PID 路由**：Xcode 未启动、同时开了正式版与 Beta 版 Xcode、或尚未在 **Xcode → Settings → Intelligence** 开启外部 Agent 权限时，裸 STDIO 进程会直接秒退或报底层 XPC 错误。
3. **上下文膨胀**：Xcode 原生暴露约 20+ 个细粒度工具，且 `RenderPreview` 会返回数 MB 的 Base64 PNG 数据。

`@zseven-w/dsh-xcode` 将官方 `mcpbridge` 封装为原生零运行时依赖的 DSH `0.2.1+` 插件：

- **8 个高内聚模型工具**：自动解析并匹配窗口 `tabIdentifier`，自动归一化 Xcode 26 的 JSON 响应与二进制预览图。
- **秒级单文件查错（`< 1 s`）**：通过 `XcodeRefreshCodeIssuesInFile` 对单个 Swift/ObjC 文件做增量类型检查，无需每次改代码都跑冷启动 `xcodebuild`。
- **原生 SwiftUI `#Preview` 渲染**：支持完整 `.xcodeproj` / `.xcworkspace` 工程与 Swift Package，自动落盘至 `.dsh-xcode/previews/` 并在多模态模型下注入图片附件。
- **Apple 官方 `SKILL.md` 自动同步**：调用 `xcrun agent skills export` 导出当前 Xcode 内置的官方 Agent 技能包，动态注册进 DSH `ctx.skills`。
- **DSH Web 右侧栏「Xcode 工作台」**：实时展示连接状态、已打开工程窗口、最新编译诊断、构建结果、`#Preview` 预览画廊，以及 `@zseven-w/dsh-ios` 设备在线状态。
- **与 `@zseven-w/dsh-ios` 零耦合双剑合璧**：同进程自动发现，IDE 编译诊断交给 `dsh-xcode`，模拟器/USB 真机实时投屏与点按交互交给 `dsh-ios`。

## 环境要求

- **macOS** + **Xcode 26.3+**（`xcode-select -p` 指向 `/Applications/Xcode.app/Contents/Developer`）。
- **DeepSeek Harness** `0.2.1-rc.5` 及以上版本。
- 首次使用请在 **Xcode → Settings → Intelligence → Model Context Protocol** 中开启 **Allow External Agents**（Xcode 弹出外部 Agent 授权提示时点击 Allow）。

## 安装方式

### 本地目录链接安装（开发推荐）

```bash
pnpm --dir /path/to/dsh-xcode install
pnpm --dir /path/to/dsh-xcode run build

# 挂载到 DSH web profile
dsh plugin --profile web add link:/path/to/dsh-xcode
```

### 从 npm 安装（发布后）

```bash
dsh plugin --profile web add @zseven-w/dsh-xcode
```

## 暴露的 8 个模型工具

| 工具名 | 底层 Xcode 能力 | 用途说明 |
| --- | --- | --- |
| `xcode_status` | `xcode-select`、`xcrun`、`XcodeListWindows` | 检查本机 Xcode 版本、`mcpbridge` 状态、运行中 PID、已打开窗口 `tabIdentifier`、已同步官方 Skills 及 `dsh-ios` 联动状态 |
| `xcode_open_project` | `open -a Xcode` + `XcodeListWindows` | 自动识别并在 Xcode 中打开 `.xcworkspace` / `.xcodeproj` / `Package.swift`，等待 MCP 会话就绪 |
| `xcode_diagnostics` | `XcodeRefreshCodeIssuesInFile` / `XcodeListNavigatorIssues` | 传入 `filePath` 秒级刷新单文件编译报错，不传则读取全局 Issue Navigator 诊断 |
| `xcode_build_test` | `BuildProject`、`GetBuildLog`、`GetTestList`、`RunAllTests`、`RunSomeTests` | 复用 Xcode 热构建缓存执行 Scheme 编译、读取过滤日志、列出或运行 XCTest / Swift Testing 测试 |
| `xcode_render_preview` | `RenderPreview` | 使用 Xcode 原生引擎渲染 SwiftUI `#Preview` / `PreviewProvider` 快照并展示在右侧工作台 |
| `xcode_search_docs` | `DocumentationSearch` | 语义检索本地 Xcode 内置 Apple 官方开发文档与 WWDC 讲座文稿 |
| `xcode_sync_skills` | `xcrun agent skills export` | 导出当前 Xcode 内置的 Apple 官方 `SKILL.md` 技能包并注册到当前 DSH 会话 |
| `xcode_call_tool` | 任意 `mcpbridge` 工具 | 逃生舱：列出或直接调用任意原生 Xcode MCP 工具（如 `ExecuteSnippet`、`XcodeUpdate` 或 Xcode 27+ `DeviceInteraction*`） |

## 与 `@zseven-w/dsh-ios` 联动分工

两个插件没有任何安装期硬依赖；同时安装在同一 DSH Profile 时，会通过 `Symbol.for('zseven.dsh.apple.peer.v1')` 自动协同：

- **`@zseven-w/dsh-xcode`（`xcode_*`）负责 IDE 与编译器闭环**：单文件秒级查错、热缓存增量编译与单测、`.xcodeproj` 原生 SwiftUI `#Preview` 截图、本地 Apple 文档检索。
- **`@zseven-w/dsh-ios`（`ios_sim_*`）负责设备运行时与真机/模拟器交互**：右侧栏实时视频流、USB 真机 WebDriverAgent 驱动、AXe 无障碍树点按、Vision OCR 识别点击、实时日志流、LLDB 堆栈与 `leaks` 内存检测。

## 开发与测试

```bash
pnpm run typecheck
pnpm test
```

## License

MIT © ZSeven-W
