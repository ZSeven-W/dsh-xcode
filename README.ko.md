<p align="center">
  <img src="./docs/images/dsh-xcode-logo.png" alt="DSH Xcode" width="120" />
</p>

<h1 align="center">DSH Xcode</h1>

<p align="center">
  <strong>Apple의 공식 Xcode MCP 브리지(<code>xcrun mcpbridge</code>)와 내장 Apple Skills를 <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> 대화 안에서 직접 사용 — <a href="https://github.com/ZSeven-W/dsh-ios">DSH iOS</a>와 매끄럽게 연동.</strong><br />
  <sub>에이전트 도구 8개 &bull; 1초 미만의 단일 파일 컴파일러 진단 &bull; 네이티브 SwiftUI <code>#Preview</code> 스냅샷 &bull; 웜 스킴 빌드와 테스트 &bull; 로컬 Apple 문서 검색 &bull; 오른쪽 사이드바 Xcode Workbench</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-xcode</code> &middot; 현재 플러그인 릴리스: <code>0.1.0-rc.2</code> &middot; DSH <code>0.2.1-rc.5</code>로 테스트됨</sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <b>한국어</b> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-xcode/actions/workflows/check.yml"><img src="https://img.shields.io/github/actions/workflow/status/ZSeven-W/dsh-xcode/check.yml?label=CI" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@zseven-w/dsh-xcode"><img src="https://img.shields.io/npm/v/@zseven-w/dsh-xcode?color=1a78f2" alt="npm" /></a>
  <a href="https://github.com/ZSeven-W/dsh-xcode/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-xcode?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-xcode-banner.png" alt="DSH Xcode — DeepSeek Harness 안의 Apple 공식 Xcode MCP 브리지와 Apple Skills" width="100%" />
</p>

## DSH Xcode를 선택하는 이유

Xcode 26.3부터 Apple은 로컬 XPC 기반의 공식 Model Context Protocol 브리지(`xcrun mcpbridge`)와 자사 `SKILL.md` 에이전트 번들(`xcrun agent skills export`)을 함께 제공합니다. 하지만 날것의 `xcrun mcpbridge`를 범용 코딩 에이전트에 바로 연결하면 세 가지 현실적인 벽에 부딪힙니다:

1. **Xcode 26 `structuredContent` 불일치** — `XcodeListWindows` 같은 도구는 `tools/list`에서 `outputSchema`를 선언해 놓고 실제로는 JSON을 `content[0].text`에 담아 반환하며 `structuredContent`를 생략해, 엄격한 MCP SDK 클라이언트가 유효한 응답을 거부합니다.
2. **프로세스 수명 주기와 다중 Xcode PID 라우팅** — `mcpbridge`는 Xcode가 닫혔을 때, `Xcode.app`과 `Xcode-beta.app`이 동시에 실행 중일 때, 또는 **Xcode → Settings → Intelligence**에서 외부 에이전트 접근이 켜지기 전에 즉시 종료됩니다.
3. **컨텍스트 부풀림** — Xcode는 20개 이상의 세분화된 도구를 노출하고, `RenderPreview`는 수 MB짜리 base64 PNG 문자열을 내놓습니다.

`DSH Xcode`는 Apple의 공식 브리지를 런타임 의존성 없는 네이티브 DeepSeek Harness 플러그인으로 감싸고, 통합 오른쪽 사이드바 Workbench와 [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios)와의 느슨한 피어 디스커버리를 제공합니다.

| | |
| --- | --- |
| ⚡ **1초 미만의 단일 파일 진단** | `filePath`를 지정한 `xcode_diagnostics`는 Xcode의 라이브 컴파일러 그래프에 `XcodeRefreshCodeIssuesInFile`을 호출합니다 — 콜드 `xcodebuild`를 실행하지 않고 Swift/ObjC 편집을 1초 미만에 검사합니다. |
| 🖼️ **네이티브 SwiftUI `#Preview` 스냅샷** | `xcode_render_preview`는 `.xcodeproj`, `.xcworkspace`, Swift 패키지에서 Xcode 자체의 `RenderPreview` 엔진을 구동해 PNG를 `.dsh-xcode/previews/`에 기록하고, 멀티모달 모델이 활성 상태이면 이미지를 곧바로 첨부합니다. |
| 🔨 **웜 증분 빌드와 테스트** | `xcode_build_test`는 Xcode의 웜 DerivedData 빌드 그래프를 재사용해 `BuildProject`, `GetBuildLog`, `GetTestList`, `RunAllTests`, `RunSomeTests`(XCTest &amp; Swift Testing)를 실행합니다. |
| 🔧 **Xcode 26 통신 정규화** | 생략된 `structuredContent`를 JSON 텍스트 블록에서 자동으로 채우고, 열려 있는 여러 워크스페이스 창에 걸쳐 `tabIdentifier`를 해결하며, JSON 요약에서 과대한 base64 문자열을 걷어냅니다. |
| 📘 **Apple 공식 `SKILL.md` 동기화** | `xcrun agent skills export`를 실행해 해당 Xcode 빌드에 내장된 `SKILL.md` 번들을 파싱하고, `~/.cache/dsh-xcode/skills/`에 캐시한 뒤 `ctx.skills`에 동적으로 등록합니다. |
| 🪟 **오른쪽 사이드바 Xcode Workbench** | 라이브 연결 상태 필, 열려 있는 워크스페이스 `tabIdentifier` 창, 컴파일러 진단 목록, 빌드/테스트 요약, 렌더링된 SwiftUI `#Preview` 갤러리, `dsh-ios` 피어 기기 상태를 표시합니다. |
| 📱 **`dsh-ios`와 페어** | `Symbol.for('zseven.dsh.apple.peer.v1')`로 설치 시 결합이 전혀 없습니다. `dsh-xcode`는 IDE 컴파일러 인텔리전스를, `dsh-ios`는 라이브 시뮬레이터와 USB 연결 iPhone의 스트리밍·조작을 맡습니다. |
| 🧭 **미래를 위한 탈출구** | `xcode_call_tool`로 플러그인 업데이트를 기다리지 않고 임의의 날것 `mcpbridge` 도구(`ExecuteSnippet`, `XcodeUpdate`, Xcode 27+의 `DeviceInteraction*`)를 나열하고 호출할 수 있습니다. |

## 도구

8개 도구 모두 모든 호스트에 등록되고, 생략 시 활성 워크스페이스에서 `tabIdentifier`를 자동 해결하며, macOS가 아닌 호스트나 Xcode가 닫혀 있을 때는 실행 가능한 설정 안내와 함께 기능을 줄여 동작합니다.

| 도구 | 기능 | 주요 매개변수 |
| --- | --- | --- |
| `xcode_status` | 활성 `xcode-select` 개발자 디렉터리, Xcode 버전/빌드 번호, `xcrun mcpbridge`와 `agent` 기능, 실행 중인 `Xcode.app` PID, 열려 있는 워크스페이스 창(`tabIdentifier`), 동기화된 Apple skills, `dsh-ios` 피어 상태를 확인합니다. | `connect` (기본값 `true`) |
| `xcode_open_project` | `.xcworkspace`, `.xcodeproj` 또는 `Package.swift`를 자동으로 감지해 Xcode에서 열고(`open -a Xcode`), `mcpbridge`가 연결되어 창의 `tabIdentifier`를 보고할 때까지 폴링합니다. | `projectPath` (선택), `waitSeconds` (기본값 `20`) |
| `xcode_diagnostics` | Xcode의 라이브 컴파일러 오류와 경고를 읽습니다. `filePath`를 넘기면 `1초 미만`의 단일 파일 타입 체크(`XcodeRefreshCodeIssuesInFile`), 생략하면 워크스페이스 전체 Issue Navigator 진단(`XcodeListNavigatorIssues`)을 수행합니다. | `filePath`, `projectPath`, `tabIdentifier`, `severity` (`error`/`warning`/`remark`), `pattern` |
| `xcode_build_test` | 활성 스킴을 빌드하거나, 필터링된 빌드 로그를 살펴보거나, Xcode의 웜 빌드 그래프 안에서 XCTest와 Swift Testing 스위트를 나열/실행합니다. | `action` (필수 — `build`/`build_log`/`list_tests`/`run_all_tests`/`run_some_tests`), `tests` (JSON 배열), `severity`, `pattern` |
| `xcode_render_preview` | SwiftUI `#Preview` 또는 `PreviewProvider` 스냅샷을 Xcode에서 네이티브로 렌더링하고, PNG를 `.dsh-xcode/previews/`에 저장해 Workbench 갤러리에 보여 주며, 멀티모달 모델 컨텍스트에 첨부합니다. | `sourceFilePath` (필수), `previewDefinitionIndexInFile` (기본값 `0`), `projectPath`, `tabIdentifier` |
| `xcode_search_docs` | Xcode에 내장된 Apple Developer Documentation과 WWDC 세션 스크립트 전체를 의미 기반으로 검색합니다(`DocumentationSearch`). | `query` (필수), `frameworks` (선택, 쉼표로 구분한 목록, 예: `"SwiftUI,Observation"`) |
| `xcode_sync_skills` | 활성 Xcode 앱에서 `xcrun agent skills export`로 Apple 공식 `SKILL.md` 번들을 내보내 현재 DSH 세션에 등록합니다. | — |
| `xcode_call_tool` | 해당 Xcode 버전이 노출하는 모든 날것 MCP 도구를 나열하거나(`action: "list"`), 임의의 날것 도구를 직접 호출합니다(`action: "call"`). | `action` (필수 — `list`/`call`), `toolName`, `argumentsJson` |

## 표시 영역

- **오른쪽 사이드바 패널 — “Xcode Workbench”.** 도구 행의 **Open Workbench** 버튼이나 오른쪽 사이드바 **`+`** 런처(**Xcode Workbench**)에서 엽니다. 실시간 Xcode 연결 배지 + PID, Xcode 버전/빌드, `dsh-ios` 실시간 기기 연결, 열려 있는 워크스페이스 창(`tabIdentifier`), 파일/줄 배지가 붙은 최신 컴파일러 진단, 최신 빌드/테스트 결과, 렌더링된 SwiftUI `#Preview` 썸네일, 동기화된 Apple Skills, 마운트된 MCP 도구를 표시합니다. 도구 모음 버튼(**Refresh**, **Open Project**, **Diagnostics**, **Build Scheme**, **Sync Apple Skills**)은 `/xcode` 세션 명령으로 실행되어 모델 토큰을 소모하지 않습니다.
- **간결한 대화 카드.** 도구 호출(`xcode_status`, `xcode_open_project`, `xcode_diagnostics`, `xcode_build_test`, `xcode_render_preview`, `xcode_sync_skills`)은 간결한 현지화 행(`zh` / `en`)으로 렌더링되며, 호출이 완료되면 열려 있는 Workbench 탭을 자동으로 새로 고칩니다.

## DSH iOS(`@zseven-w/dsh-ios`)와의 페어링

`dsh-xcode`와 [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios)는 **서로에 대한 하드 의존성이 전혀 없습니다** — 하나만 설치해도, 둘 다 설치해도 됩니다. 같은 DSH 프로필에 둘 다 로드되면 `Symbol.for('zseven.dsh.apple.peer.v1')`를 통해 같은 프로세스에서 서로를 발견합니다:

- **IDE와 컴파일러 작업에는 `dsh-xcode`(`xcode_*`)** — Swift/ObjC 파일 편집 중 `1초 미만`의 단일 파일 진단, 웜 증분 스킴 빌드와 유닛 테스트, `.xcodeproj` / `.xcworkspace` SwiftUI `#Preview` 스냅샷, 로컬 Apple 문서 조회.
- **라이브 기기 런타임과 UI 자동화에는 `dsh-ios`(`ios_sim_*`)** — 사이드바에서 인터랙티브 시뮬레이터와 USB 연결 실제 iPhone의 MJPEG 영상 스트리밍, AXe 접근성 트리(`ios_sim_ui_tree`, `ios_sim_tap_element`, `ios_sim_ui_rows`), Vision OCR 찾기/탭(`ios_sim_find_text`, `ios_sim_tap_text`), 통합 런타임 로그(`ios_sim_logs`), LLDB 백트레이스와 `leaks`.
- **스마트 크로스 플러그인 라우팅** — 에이전트가 `.xcodeproj` / `.xcworkspace`에 대해 `ios_sim_preview`(SwiftPM 다이내믹 라이브러리 핫 리로드)를 호출하면, `dsh-ios`가 `dsh-xcode`가 마운트되었음을 감지하고 에이전트를 `xcode_render_preview`로 안내합니다.

## 보안과 프라이버시

- **로컬 XPC 전송 전용** — `xcrun mcpbridge`는 macOS XPC를 통해 로컬의 Xcode 프로세스와만 통신합니다. 플러그인은 네트워크 리스너를 열지 않고 외부 HTTP 요청도 전혀 보내지 않습니다.
- **환경 변수 스크러빙** — `xcrun mcpbridge`나 `xcrun agent`를 시작하기 전에 `scrubEnvForMcpBridge`가 `*KEY*`, `*SECRET*`, `*TOKEN*`, `*PASSWORD*`, `DSH_*`와 일치하는 환경 변수를 모두 제거하고, 표준 macOS 개발/XPC 변수(`HOME`, `USER`, `PATH`, `TMPDIR`, `DEVELOPER_DIR`, `MCP_XCODE_PID`, `MCP_XCODE_SESSION_ID`)만 전달합니다.
- **Xcode 사용자의 명시적 동의** — 외부 에이전트 접근은 Xcode 자체의 **Settings → Intelligence → Model Context Protocol** 토글과 macOS/Xcode 권한 대화상자로 제어됩니다.
- **한계가 정해진 바이너리 처리** — MCP 이미지 블록은 디코딩 전에 정규 base64와 엄격한 20 MB 상한으로 검증됩니다. 날것 JSON 페이로드 안의 과대한 base64 문자열은 제거되어 모델 컨텍스트가 깨끗하게 유지됩니다.

## 요구 사항

- **macOS**에 **Xcode 26.3 이상**이 설치되어 있어야 합니다(`xcode-select -p`가 Command Line Tools가 아닌 `/Applications/Xcode.app/Contents/Developer`를 가리켜야 함).
- **DeepSeek Harness** `0.2.1-rc.5` 이상, Node.js `>= 24.11.0`.
- **최초 1회 Xcode 설정** — **Xcode → Settings → Intelligence → Model Context Protocol**을 열고 **Allow External Agents**를 켜세요(첫 연결 시 Xcode의 권한 프롬프트를 승인).

## DSH에 설치

```sh
dsh plugin --profile web add @zseven-w/dsh-xcode@latest
dsh web
```

Xcode IDE 도구와 함께 시뮬레이터 + USB iPhone 스트리밍을 완전하게 사용하려면 `dsh-ios`를 함께 설치하세요:

```sh
dsh plugin --profile web add @zseven-w/dsh-ios@latest
```

## 빠른 시작

1. **상태 확인과 프로젝트 열기** — “Xcode 상태를 확인하고 이 폴더의 iOS 프로젝트를 열어 줘.” → `xcode_status` / `xcode_open_project`. 처음 실행이라면 Xcode의 외부 에이전트 프롬프트를 승인하세요.
2. **1초 미만에 단일 파일 검사** — “`HomeView.swift`를 리팩터링하고 전체 빌드 없이 컴파일 오류를 확인해 줘.” → `xcode_diagnostics` (`filePath: "Sources/HomeView.swift"`).
3. **SwiftUI `#Preview` 렌더링** — “`HomeView.swift`의 SwiftUI 미리보기를 렌더링해서 레이아웃을 확인해 줘.” → `xcode_render_preview`. 오른쪽 사이드바의 **Xcode Workbench**를 열어 렌더링된 스냅샷을 확인하세요.
4. **Apple 문서 검색과 테스트 실행** — “Xcode 로컬 문서에서 `NavigationSplitView` 컬럼 표시를 검색한 다음 유닛 테스트를 실행해 줘.” → `xcode_search_docs` → `xcode_build_test` (`action: "run_all_tests"`).

## 설정

`cordis.patch.yml`의 `plugins.dsh-xcode` 아래에서 설정할 수 있는 선택적 옵션:

| 옵션 | 기본값 | 의미 |
| --- | --- | --- |
| `xcodePid` | 자동 해석 | `Xcode.app`과 `Xcode-beta.app`이 동시에 열려 있을 때 명시적으로 대상으로 할 실행 중 Xcode PID(`MCP_XCODE_PID`). |
| `callTimeoutMs` | `180000` | 오래 걸리는 Xcode MCP 작업(`BuildProject`, `RunAllTests`, `RenderPreview`)의 기본 타임아웃(ms). |
| `autoSyncSkills` | `true` | `xcode_status` 또는 `xcode_open_project`가 연결되면 Apple 내장 `SKILL.md` 번들을 자동으로 내보내 등록합니다. |
| `skillsCacheDir` | `~/.cache/dsh-xcode/skills` | 내보낸 Apple `SKILL.md` 번들을 Xcode 빌드 번호별로 캐시하는 디렉터리. |

## 문제 해결

- **`xcrun could not find mcpbridge` / Command Line Tools 오류** — `xcode-select -p`가 `/Library/Developer/CommandLineTools`나 이전 Xcode(< 26.3)를 가리키고 있습니다. `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`로 Xcode 26.3+로 전환하세요.
- **`Could not establish MCP tool session with Xcode`** — Xcode에서 프로젝트/워크스페이스 창이 하나 이상 열려 있는지(`xcode_open_project`), **Xcode → Settings → Intelligence → Model Context Protocol → Allow External Agents**가 켜져 있는지 확인하고, Xcode가 배경에서 에이전트 승인 대화상자를 띄웠다면 **Allow**를 클릭하세요.
- **여러 Xcode 인스턴스 실행 중** — `dsh-xcode`는 기본적으로 `xcode-select -p`와 일치하는 PID를 선택합니다. 같은 번들의 복사본이 두 개 열려 있으면 설정에 `xcodePid`를 넘기거나 `DSHPLUGIN_XCODE_PID=<pid>`를 설정하세요.
- **커스텀 타깃 구성에서 `#Preview` 매크로 실패** — Xcode의 미리보기 엔진은 복잡한 `#Preview` 매크로의 폼 팩터를 추론하지 못할 때가 있습니다. 파일에 표준 `PreviewProvider` 구조체를 추가하면 `xcode_render_preview`와 안정적으로 동작합니다.

## 개발

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run smoke:pack
```

로컬 체크아웃을 DSH Web 프로필에 연결합니다:

```sh
dsh plugin --profile web add link:/path/to/dsh-xcode
dsh web
```

| 스위트 | 다루는 범위 |
| --- | --- |
| `test/mcp-stdio.test.mjs` | STDIO JSON-RPC 핸드셰이크, 페이지 매김 `tools/list`, Xcode 26의 생략된 `structuredContent` 하이드레이션, 정규 PNG 디코딩, base64 제거, 환경 변수 스크러빙, 오류 분류. |
| `test/env-and-bridge.test.mjs` | `ps`의 Xcode vs Simulator 프로세스 필터링, PID 선택 규칙, `.xcworkspace`/`.xcodeproj`/`Package.swift` 탐지, `tabIdentifier` 자동 해석, 진단/빌드/미리보기 상태 지속성, `SKILL.md` 내보내기와 호스트 `apply()` 수명 주기. |
| `test/client-bundle.test.mjs` | `window.__ModuleLoader__.load` 번들 형태, 외부화된 호스트 React 불변식, `zh`/`en` 로케일 동등성, Workbench 리소스 주소 인코딩, 슬롯과 탭 등록. |
| `test/ios-peer-linkage.test.mjs` | `@zseven-w/dsh-ios`와의 라이브 크로스 플러그인 `Symbol.for('zseven.dsh.apple.peer.v1')` 디스커버리와 `.xcodeproj` → `xcode_render_preview` 스마트 라우팅. |

## 생태계

- [DSH iOS Simulator](https://github.com/ZSeven-W/dsh-ios) — 대화 속 라이브 인터랙티브 iOS 시뮬레이터와 USB 연결 실제 iPhone 스트리밍, AXe UI 트리, Vision OCR, SwiftPM 미리보기 핫 리로드
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — 대화 속 라이브 Android 에뮬레이터 또는 USB 기기, 전적으로 `adb`로 구동
- [DSH Computer](https://github.com/ZSeven-W/dsh-computer) — AX 우선 관측과 호스트 승인을 갖춘 헤드리스 우선 macOS Computer Use 드라이버
- [DSH Browser](https://github.com/ZSeven-W/dsh-browser) — 시맨틱 레퍼런스와 제한된 증거를 갖춘 격리 Chromium 세션
- [DSH QA](https://github.com/ZSeven-W/dsh-qa) — Browser, Desktop, iOS, Android에 걸친 에이전트 주도 탐색과 결정론적 시나리오 리플레이
- [DSH Game Studio](https://github.com/ZSeven-W/dsh-game-studio) — 한 문장으로 2D/3D 복셀 게임을 만들고 사이드바에서 플레이하고 AI 아트로 바꾸고 원클릭으로 게시
- [DSH Harbor](https://github.com/ZSeven-W/dsh-harbor) — 설치된 플러그인의 능력 인벤토리, 충돌 감지, DSH 업그레이드 사전 점검
- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — Claude Code / Codex에서 네이티브 서브에이전트로 DSH 에이전트에 작업 전달
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — DSH를 위한 내구성 있고 검사 가능한 장기 에이전트 메모리
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — DSH 대화 안에서 `.op` OpenPencil 디자인 문서를 미리보기·검사·편집

## 라이선스

MIT © ZSeven-W
