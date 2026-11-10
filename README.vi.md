<p align="center">
  <img src="./docs/images/dsh-xcode-logo.png" alt="DSH Xcode" width="120" />
</p>

<h1 align="center">DSH Xcode</h1>

<p align="center">
  <strong>Cầu nối Xcode MCP chính thức của Apple (<code>xcrun mcpbridge</code>) và Apple Skills tích hợp sẵn ngay trong cuộc trò chuyện <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> — ghép đôi liền mạch với <a href="https://github.com/ZSeven-W/dsh-ios">DSH iOS</a>.</strong><br />
  <sub>8 công cụ agent &bull; chẩn đoán trình biên dịch một tệp trong &lt; 1 giây &bull; ảnh chụp nhanh SwiftUI <code>#Preview</code> gốc &bull; dựng &amp; kiểm thử scheme nóng &bull; tìm kiếm tài liệu Apple cục bộ &bull; Workbench thanh bên phải</sub>
</p>

<p align="center">
  <sub>Gói: <code>@zseven-w/dsh-xcode</code> &middot; Bản phát hành plugin hiện tại: <code>0.1.0-rc.3</code> &middot; Đã thử nghiệm với DSH <code>0.2.1-rc.5</code></sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <b>Tiếng Việt</b> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-xcode/actions/workflows/check.yml"><img src="https://img.shields.io/github/actions/workflow/status/ZSeven-W/dsh-xcode/check.yml?label=CI" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@zseven-w/dsh-xcode"><img src="https://img.shields.io/npm/v/@zseven-w/dsh-xcode?color=1a78f2" alt="npm" /></a>
  <a href="https://github.com/ZSeven-W/dsh-xcode/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-xcode?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-xcode-banner.png" alt="DSH Xcode — Cầu nối Xcode MCP chính thức &amp; Apple Skills tích hợp sẵn bên trong DeepSeek Harness" width="100%" />
</p>

## Tại sao chọn DSH Xcode

Bắt đầu từ Xcode 26.3, Apple cung cấp cầu nối Model Context Protocol chính thức (`xcrun mcpbridge`) chạy trên XPC cục bộ cùng các gói agent `SKILL.md` bên thứ nhất (`xcrun agent skills export`). Tuy nhiên, việc nối `xcrun mcpbridge` thô trực tiếp vào một agent lập trình tổng quát sẽ gặp ba bức tường thực tế:

1. **Không khớp `structuredContent` trên Xcode 26** — các công cụ như `XcodeListWindows` khai báo `outputSchema` trong `tools/list` nhưng lại trả về JSON bên trong `content[0].text` và bỏ qua `structuredContent`, khiến các client MCP SDK nghiêm ngặt từ chối cả những phản hồi hợp lệ.
2. **Vòng đời tiến trình &amp; định tuyến PID nhiều Xcode** — `mcpbridge` thoát ngay khi Xcode bị đóng, khi cả `Xcode.app` và `Xcode-beta.app` cùng chạy, hoặc trước khi truy cập agent bên ngoài được bật trong **Xcode → Settings → Intelligence**.
3. **Phình to ngữ cảnh** — Xcode cung cấp hơn 20 công cụ ở mức chi tiết và phát các chuỗi PNG base64 cỡ nhiều megabyte từ `RenderPreview`.

`DSH Xcode` bọc cầu nối chính thức của Apple thành một plugin DeepSeek Harness gốc, không phụ thuộc runtime, kèm Workbench thanh bên phải tích hợp sẵn và khám phá peer không coupling cùng [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios).

| | |
| --- | --- |
| ⚡ **Chẩn đoán một tệp trong &lt; 1 giây** | `xcode_diagnostics` với `filePath` gọi `XcodeRefreshCodeIssuesInFile` trên đồ thị trình biên dịch trực tiếp của Xcode — kiểm tra các chỉnh sửa Swift/ObjC trong chưa đầy một giây mà không phải chạy `xcodebuild` nguội. |
| 🖼️ **Ảnh chụp nhanh SwiftUI `#Preview` gốc** | `xcode_render_preview` điều khiển chính động cơ `RenderPreview` của Xcode trên `.xcodeproj`, `.xcworkspace` và các gói Swift, ghi PNG vào `.dsh-xcode/previews/` và đính kèm ảnh trực tiếp khi các mô hình đa phương thức hoạt động. |
| 🔨 **Dựng &amp; kiểm thử nóng tăng dần** | `xcode_build_test` tái sử dụng đồ thị dựng DerivedData nóng của Xcode cho `BuildProject`, `GetBuildLog`, `GetTestList`, `RunAllTests` và `RunSomeTests` (XCTest &amp; Swift Testing). |
| 🔧 **Chuẩn hóa giao thức Xcode 26** | Tự động đổ đầy `structuredContent` bị bỏ sót từ các khối văn bản JSON, giải quyết `tabIdentifier` qua nhiều cửa sổ workspace đang mở, và loại các chuỗi base64 quá cỡ khỏi các bản tóm tắt JSON. |
| 📘 **Đồng bộ `SKILL.md` chính thức của Apple** | Chạy `xcrun agent skills export`, phân tích các gói `SKILL.md` tích hợp sẵn của Apple cho đúng bản dựng Xcode của bạn, lưu vào `~/.cache/dsh-xcode/skills/` và đăng ký động vào `ctx.skills`. |
| 🪟 **Xcode Workbench thanh bên phải** | Huy hiệu trạng thái kết nối trực tiếp, các cửa sổ workspace đang mở (`tabIdentifier`), danh sách chẩn đoán trình biên dịch, tóm tắt dựng/kiểm thử, bộ sưu tập ảnh chụp nhanh SwiftUI `#Preview` đã kết xuất, và trạng thái thiết bị peer `dsh-ios`. |
| 📱 **Ghép đôi với `dsh-ios`** | Không coupling lúc cài đặt qua `Symbol.for('zseven.dsh.apple.peer.v1')`: `dsh-xcode` phụ trách trí tuệ trình biên dịch của IDE còn `dsh-ios` phát và điều khiển trực tiếp Simulator &amp; iPhone qua USB. |
| 🧭 **Cửa thoát bền vững cho tương lai** | `xcode_call_tool` liệt kê và gọi bất kỳ công cụ `mcpbridge` thô nào (`ExecuteSnippet`, `XcodeUpdate`, `XcodeGlob` hay `DeviceInteraction*` của Xcode 27+) mà không phải chờ plugin cập nhật. |

## Công cụ

Cả 8 công cụ đều đăng ký trên mọi máy chủ, tự giải quyết `tabIdentifier` từ workspace đang hoạt động khi bị bỏ trống, và hạ cấp kèm hướng dẫn cài đặt có thể hành động trên máy không phải macOS hoặc khi Xcode đang đóng.

| Công cụ | Chức năng | Tham số chính |
| --- | --- | --- |
| `xcode_status` | Kiểm tra thư mục nhà phát triển `xcode-select` đang hoạt động, phiên bản/bản dựng Xcode, năng lực `xcrun mcpbridge` &amp; `agent`, PID của `Xcode.app` đang chạy, các cửa sổ workspace đang mở (các `tabIdentifier`), Apple skills đã đồng bộ và trạng thái peer `dsh-ios`. | `connect` (mặc định `true`) |
| `xcode_open_project` | Tự phát hiện và mở `.xcworkspace`, `.xcodeproj` hoặc `Package.swift` trong Xcode (`open -a Xcode`), rồi vòng đợi cho tới khi `mcpbridge` kết nối và trả về `tabIdentifier` của cửa sổ đó. | `projectPath` (không bắt buộc), `waitSeconds` (mặc định `20`) |
| `xcode_diagnostics` | Đọc lỗi và cảnh báo trình biên dịch trực tiếp từ Xcode. Truyền `filePath` để kiểm tra kiểu một tệp trong `< 1 s` (`XcodeRefreshCodeIssuesInFile`), hoặc bỏ qua `filePath` để lấy chẩn đoán toàn workspace từ Issue Navigator (`XcodeListNavigatorIssues`). | `filePath`, `projectPath`, `tabIdentifier`, `severity` (`error`/`warning`/`remark`), `pattern` |
| `xcode_build_test` | Dựng scheme đang hoạt động, xem nhật ký dựng đã lọc, hoặc liệt kê/chạy bộ XCTest &amp; Swift Testing bên trong đồ thị dựng nóng của Xcode. | `action` (bắt buộc — `build`/`build_log`/`list_tests`/`run_all_tests`/`run_some_tests`), `tests` (mảng JSON), `severity`, `pattern` |
| `xcode_render_preview` | Kết xuất ảnh chụp nhanh SwiftUI `#Preview` hoặc `PreviewProvider` ngay trong Xcode, lưu PNG dưới `.dsh-xcode/previews/` cho bộ sưu tập Workbench, và đính kèm vào ngữ cảnh mô hình đa phương thức. | `sourceFilePath` (bắt buộc), `previewDefinitionIndexInFile` (mặc định `0`), `projectPath`, `tabIdentifier` |
| `xcode_search_docs` | Tìm kiếm ngữ nghĩa trên Apple Developer Documentation tích hợp sẵn của Xcode và bản chép các buổi WWDC (`DocumentationSearch`). | `query` (bắt buộc), `frameworks` (danh sách phân tách bằng dấu phẩy, không bắt buộc, vd. `"SwiftUI,Observation"`) |
| `xcode_sync_skills` | Xuất các gói `SKILL.md` chính thức của Apple từ ứng dụng Xcode đang hoạt động qua `xcrun agent skills export` và đăng ký vào phiên DSH hiện tại. | — |
| `xcode_call_tool` | Liệt kê tất cả công cụ MCP thô do phiên bản Xcode của bạn cung cấp (`action: "list"`) hoặc gọi trực tiếp bất kỳ công cụ thô nào (`action: "call"`). | `action` (bắt buộc — `list`/`call`), `toolName`, `argumentsJson` |

## Bề mặt hiển thị

- **Bảng điều khiển thanh bên phải — “Xcode Workbench”.** Mở từ nút **Open Workbench** trên bất kỳ hàng công cụ nào hoặc từ trình khởi chạy **`+`** ở thanh bên phải (**Xcode Workbench**). Hiển thị huy hiệu kết nối Xcode trực tiếp + PID, phiên bản/bản dựng Xcode, liên kết thiết bị trực tiếp `dsh-ios`, các cửa sổ workspace đang mở (các `tabIdentifier`), chẩn đoán trình biên dịch mới nhất kèm huy hiệu tệp/dòng, kết quả dựng/kiểm thử mới nhất, ảnh thu nhỏ SwiftUI `#Preview` đã kết xuất, Apple Skills đã đồng bộ và các công cụ MCP đã gắn. Các nút thanh công cụ (**Refresh**, **Open Project**, **Diagnostics**, **Build Scheme**, **Sync Apple Skills**) chạy qua lệnh phiên `/xcode` mà không tốn token của mô hình.
- **Thẻ hội thoại nhỏ gọn.** Các lượt gọi công cụ (`xcode_status`, `xcode_open_project`, `xcode_diagnostics`, `xcode_build_test`, `xcode_render_preview`, `xcode_sync_skills`) hiển thị các dòng bản địa hóa nhỏ gọn (`zh` / `en`) tự làm mới các tab Workbench đang mở khi một lượt gọi hoàn tất.

## Ghép đôi với DSH iOS (`@zseven-w/dsh-ios`)

`dsh-xcode` và [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios) **không phụ thuộc cứng vào nhau** — cài riêng một bên hoặc cả hai cùng lúc. Khi cả hai được nạp trong cùng một hồ sơ DSH, chúng khám phá lẫn nhau trong tiến trình qua `Symbol.for('zseven.dsh.apple.peer.v1')`:

- **Dùng `dsh-xcode` (`xcode_*`) cho công việc IDE &amp; trình biên dịch** — chẩn đoán một tệp trong `< 1 s` khi chỉnh sửa tệp Swift/ObjC, dựng và kiểm thử scheme nóng tăng dần, ảnh chụp nhanh SwiftUI `#Preview` của `.xcodeproj` / `.xcworkspace`, và tra cứu tài liệu Apple cục bộ.
- **Dùng `dsh-ios` (`ios_sim_*`) cho thời gian chạy thiết bị trực tiếp &amp; tự động hóa UI** — phát trực tuyến MJPEG Simulator tương tác và iPhone thật cắm USB trong thanh bên, cây trợ năng AXe (`ios_sim_ui_tree`, `ios_sim_tap_element`, `ios_sim_ui_rows`), tìm/chạm Vision OCR (`ios_sim_find_text`, `ios_sim_tap_text`), nhật ký thời gian chạy hợp nhất (`ios_sim_logs`), backtrace LLDB và `leaks`.
- **Định tuyến thông minh xuyên plugin** — nếu agent gọi `ios_sim_preview` (nạp lại nóng dylib SwiftPM) trên `.xcodeproj` / `.xcworkspace`, `dsh-ios` phát hiện `dsh-xcode` đã được gắn và dẫn agent thẳng tới `xcode_render_preview`.

## Bảo mật và quyền riêng tư

- **Chỉ truyền tải XPC cục bộ** — `xcrun mcpbridge` chỉ giao tiếp với tiến trình Xcode cục bộ của bạn qua XPC của macOS; plugin không mở bất kỳ trình lắng nghe mạng nào và không gửi yêu cầu HTTP bên ngoài.
- **Làm sạch biến môi trường** — trước khi khởi chạy `xcrun mcpbridge` hoặc `xcrun agent`, `scrubEnvForMcpBridge` loại mọi biến môi trường khớp `*KEY*`, `*SECRET*`, `*TOKEN*`, `*PASSWORD*` hay `DSH_*`, chỉ truyền các biến nhà phát triển/XPC chuẩn của macOS (`HOME`, `USER`, `PATH`, `TMPDIR`, `DEVELOPER_DIR`, `MCP_XCODE_PID`, `MCP_XCODE_SESSION_ID`).
- **Sự đồng ý rõ ràng của người dùng Xcode** — quyền truy cập agent bên ngoài được kiểm soát bởi chính công tắc **Settings → Intelligence → Model Context Protocol** của Xcode và hộp thoại cấp quyền macOS/Xcode.
- **Xử lý nhị phân có giới hạn** — các khối ảnh MCP được kiểm tra đối với base64 chuẩn và ngưỡng cứng 20 MB trước khi giải mã; các chuỗi base64 quá cỡ trong payload JSON thô bị loại bỏ để ngữ cảnh mô hình luôn gọn gàng.

## Yêu cầu hệ thống

- **macOS** với **Xcode 26.3 trở lên** đã cài (`xcode-select -p` trỏ tới `/Applications/Xcode.app/Contents/Developer`, không phải Command Line Tools).
- **DeepSeek Harness** `0.2.1-rc.5` trở lên, Node.js `>= 24.11.0`.
- **Thiết lập Xcode một lần** — mở **Xcode → Settings → Intelligence → Model Context Protocol** và bật **Allow External Agents** (chấp nhận lời nhắc cấp quyền của Xcode ở lần kết nối đầu tiên).

## Cài đặt vào DSH

```sh
dsh plugin --profile web add @zseven-w/dsh-xcode@latest
dsh web
```

Ghép thêm `dsh-ios` để có streaming Simulator + iPhone USB trọn vẹn bên cạnh các công cụ IDE của Xcode:

```sh
dsh plugin --profile web add @zseven-w/dsh-ios@latest
```

## Bắt đầu nhanh

1. **Kiểm tra trạng thái &amp; mở dự án** — *“Kiểm tra trạng thái Xcode và mở dự án iOS trong thư mục này.”* → `xcode_status` / `xcode_open_project`. Chấp nhận lời nhắc agent bên ngoài của Xcode nếu đây là lần chạy đầu tiên.
2. **Chỉnh sửa &amp; kiểm tra một tệp trong `< 1 s`** — *“Tái cấu trúc `HomeView.swift` và kiểm tra lỗi trình biên dịch mà không chạy bản dựng đầy đủ.”* → `xcode_diagnostics` (`filePath: "Sources/HomeView.swift"`).
3. **Kết xuất `#Preview` SwiftUI** — *“Kết xuất bản xem trước SwiftUI của `HomeView.swift` và xem bố cục.”* → `xcode_render_preview`. Mở **Xcode Workbench** ở thanh bên phải để xem các ảnh chụp nhanh đã kết xuất.
4. **Tìm tài liệu Apple &amp; chạy kiểm thử** — *“Tìm trong tài liệu cục bộ của Xcode về chế độ hiển thị cột của `NavigationSplitView`, rồi chạy unit test.”* → `xcode_search_docs` → `xcode_build_test` (`action: "run_all_tests"`).

## Cấu hình

Các thiết lập tùy chọn dưới `plugins.dsh-xcode` trong `cordis.patch.yml`:

| Tùy chọn | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `xcodePid` | tự giải quyết | PID Xcode đang chạy được nêu tường minh (`MCP_XCODE_PID`) khi cả `Xcode.app` và `Xcode-beta.app` cùng mở. |
| `callTimeoutMs` | `180000` | Thời gian chờ (ms) mặc định cho các thao tác Xcode MCP chạy lâu (`BuildProject`, `RunAllTests`, `RenderPreview`). |
| `autoSyncSkills` | `true` | Tự động xuất và đăng ký các gói `SKILL.md` tích hợp sẵn của Apple khi `xcode_status` hoặc `xcode_open_project` kết nối. |
| `skillsCacheDir` | `~/.cache/dsh-xcode/skills` | Thư mục lưu cache các gói `SKILL.md` của Apple đã xuất theo số bản dựng Xcode. |

## Xử lý sự cố

- **`xcrun could not find mcpbridge` / lỗi Command Line Tools** — `xcode-select -p` đang trỏ tới `/Library/Developer/CommandLineTools` hoặc Xcode cũ hơn (< 26.3). Chuyển sang Xcode 26.3+ đầy đủ: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.
- **`Could not establish MCP tool session with Xcode`** — đảm bảo ít nhất một cửa sổ dự án/workspace đang mở trong Xcode (`xcode_open_project`), bật **Xcode → Settings → Intelligence → Model Context Protocol → Allow External Agents**, và nhấn **Allow** nếu Xcode đang hiển thị hộp thoại cấp quyền cho agent ở nền.
- **Nhiều thực thể Xcode đang chạy** — `dsh-xcode` tự chọn PID khớp với `xcode-select -p`; nếu hai bản sao của cùng một bundle đang mở, truyền `xcodePid` trong cấu hình hoặc đặt `DSHPLUGIN_XCODE_PID=<pid>`.
- **Macro `#Preview` thất bại trên cấu hình target tùy chỉnh** — động cơ xem trước của Xcode thỉnh thoảng không suy luận được form factor cho các macro `#Preview` phức tạp; thêm một struct `PreviewProvider` chuẩn vào tệp sẽ hoạt động ổn định với `xcode_render_preview`.

## Phát triển

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run smoke:pack
```

Liên kết một bản checkout cục bộ vào hồ sơ DSH Web của bạn:

```sh
dsh plugin --profile web add link:/path/to/dsh-xcode
dsh web
```

| Bộ kiểm thử | Phạm vi bao phủ |
| --- | --- |
| `test/mcp-stdio.test.mjs` | Bắt tay STDIO JSON-RPC, `tools/list` phân trang, đổ đầy `structuredContent` bị bỏ sót trên Xcode 26, giải mã PNG chuẩn, loại base64, làm sạch môi trường, phân loại lỗi. |
| `test/env-and-bridge.test.mjs` | Lọc tiến trình Xcode và Simulator bằng `ps`, quy tắc chọn PID, phát hiện `.xcworkspace`/`.xcodeproj`/`Package.swift`, tự giải `tabIdentifier`, lưu trạng thái chẩn đoán/dựng/xem trước, xuất `SKILL.md` và vòng đời `apply()` của Host. |
| `test/client-bundle.test.mjs` | Hình dạng bundle `window.__ModuleLoader__.load`, bất biến React host bên ngoài, tính tương đương locale `zh`/`en`, mã hóa địa chỉ tài nguyên Workbench, đăng ký slot &amp; tab. |
| `test/ios-peer-linkage.test.mjs` | Khám phá xuyên plugin trực tiếp `Symbol.for('zseven.dsh.apple.peer.v1')` với `@zseven-w/dsh-ios` và định tuyến thông minh `.xcodeproj` → `xcode_render_preview`. |

## Hệ sinh thái

- [DSH iOS Simulator](https://github.com/ZSeven-W/dsh-ios) — streaming iOS Simulator tương tác trực tiếp và iPhone thật cắm USB, cây UI AXe, Vision OCR và nạp lại nóng bản xem trước SwiftPM
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — trình giả lập Android hoặc thiết bị USB trực tiếp ngay trong cuộc trò chuyện, điều khiển hoàn toàn qua `adb`
- [DSH Computer](https://github.com/ZSeven-W/dsh-computer) — trình điều khiển Computer Use macOS ưu tiên headless với quan sát ưu tiên AX và phê duyệt thuộc máy chủ
- [DSH Browser](https://github.com/ZSeven-W/dsh-browser) — phiên Chromium cách ly với tham chiếu ngữ nghĩa và bằng chứng có giới hạn
- [DSH QA](https://github.com/ZSeven-W/dsh-qa) — khám phá do agent dẫn dắt và phát lại kịch bản tất định xuyên Browser, Desktop, iOS &amp; Android
- [DSH Game Studio](https://github.com/ZSeven-W/dsh-game-studio) — mô tả một trò chơi voxel 2D hoặc 3D bằng một câu, chơi ngay trong thanh bên, thay đồ họa AI và xuất bản trong một cú nhấp
- [DSH Harbor](https://github.com/ZSeven-W/dsh-harbor) — kiểm kê năng lực, phát hiện xung đột và kiểm tra tiền hành nâng cấp DSH cho các plugin đã cài
- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — giao việc cho các agent DSH từ Claude Code / Codex với vai trò subagent bản địa
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — bộ nhớ agent dài hạn bền vững, dễ kiểm tra cho DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — xem trước, kiểm tra và chỉnh sửa tài liệu thiết kế `.op` OpenPencil trong các cuộc trò chuyện DSH

## Giấy phép

MIT © ZSeven-W
