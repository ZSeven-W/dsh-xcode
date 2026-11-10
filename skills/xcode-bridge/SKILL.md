---
name: xcode-bridge
description: Use Apple's official Xcode MCP bridge (xcrun mcpbridge) for sub-second single-file Swift compiler diagnostics, native SwiftUI #Preview rendering, incremental scheme builds and XCTest/Swift Testing runs, and local Apple Developer Documentation search.
---

# DSH Xcode Bridge (`@zseven-w/dsh-xcode`)

Use this skill whenever working on an iOS, macOS, watchOS, tvOS, or visionOS project (`.xcworkspace`, `.xcodeproj`, or `Package.swift`).

## Core Workflow

1. **Check status or open the project first**:
   - Call `xcode_status` to check local Xcode version, `xcrun mcpbridge` availability, open Xcode windows (`tabIdentifier`s), and exported Apple skills.
   - If Xcode does not have the workspace open yet, call `xcode_open_project` (pass `workspaceDir` or `projectPath` if known).
   - Ensure `Xcode → Settings → Intelligence → Model Context Protocol` is enabled in Xcode 26.3+.

2. **Fast single-file edit loop (`xcode_diagnostics`)**:
   - After editing a `.swift`, `.m`, `.mm`, or `.h` file, call `xcode_diagnostics` with `filePath` **before** running a full build.
   - `xcode_diagnostics` queries `XcodeRefreshCodeIssuesInFile` against Xcode's in-memory index and returns compiler errors/warnings in sub-seconds without a cold `xcodebuild`.

3. **Visual SwiftUI verification (`xcode_render_preview`)**:
   - When creating or modifying a SwiftUI view that declares `#Preview` or `PreviewProvider`, call `xcode_render_preview` with `sourceFilePath` to render a real snapshot PNG inside Xcode and inspect the layout directly.

4. **Incremental scheme builds & targeted tests (`xcode_build_test`)**:
   - Use `xcode_build_test` with `action: "build"` to verify full target compilation using Xcode's warm build graph.
   - Use `action: "list_tests"` and `action: "run_some_tests"` (or `"run_all_tests"`) to run XCTest and Swift Testing suites.
   - Use `action: "build_log"` with `severity: "error"` to inspect build failures.

5. **Verify modern Apple APIs (`xcode_search_docs`)**:
   - Before guessing new iOS / macOS / SwiftUI / Swift Concurrency APIs, call `xcode_search_docs` to search Xcode's built-in Apple Developer Documentation and WWDC transcripts.

6. **Raw `xcrun mcpbridge` escape hatch (`xcode_call_tool`)**:
   - Use `xcode_call_tool` (`action: "list"` or `"call"`) to invoke any of the 20 raw Xcode MCP tools (`ExecuteSnippet`, `XcodeRead`, `XcodeUpdate`, `XcodeWrite`, `XcodeGlob`, `XcodeGrep`, etc.).
