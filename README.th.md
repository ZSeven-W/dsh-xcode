<p align="center">
  <img src="./docs/images/dsh-xcode-logo.png" alt="DSH Xcode" width="120" />
</p>

<h1 align="center">DSH Xcode</h1>

<p align="center">
  <strong>ใช้สะพานเชื่อม Xcode MCP อย่างเป็นทางการของ Apple (<code>xcrun mcpbridge</code>) พร้อม Apple Skills ในตัวภายในบทสนทนา <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> — จับคู่กับ <a href="https://github.com/ZSeven-W/dsh-ios">DSH iOS</a> ได้อย่างไร้รอยต่อ</strong><br />
  <sub>เครื่องมือเอเจนต์ 8 รายการ &bull; ตรวจวินิจฉัยคอมไพเลอร์รายไฟล์ใน &lt; 1 วินาที &bull; สแนปช็อต SwiftUI <code>#Preview</code> แบบเนทีฟ &bull; บิลด์ &amp; ทดสอบ scheme แบบ warm &bull; ค้นหาเอกสาร Apple ในเครื่อง &bull; Workbench ในแถบด้านข้างขวา</sub>
</p>

<p align="center">
  <sub>แพ็กเกจ: <code>@zseven-w/dsh-xcode</code> &middot; เวอร์ชันปลั๊กอินปัจจุบัน: <code>0.1.0-rc.4</code> &middot; ทดสอบกับ DSH <code>0.2.1-rc.5</code></sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <b>ไทย</b> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-xcode/actions/workflows/check.yml"><img src="https://img.shields.io/github/actions/workflow/status/ZSeven-W/dsh-xcode/check.yml?label=CI" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@zseven-w/dsh-xcode"><img src="https://img.shields.io/npm/v/@zseven-w/dsh-xcode?color=1a78f2" alt="npm" /></a>
  <a href="https://github.com/ZSeven-W/dsh-xcode/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-xcode?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-xcode-banner.png" alt="DSH Xcode — สะพานเชื่อม Xcode MCP อย่างเป็นทางการและ Apple Skills ในตัวภายใน DeepSeek Harness" width="100%" />
</p>

## ทำไมต้อง DSH Xcode

ตั้งแต่ Xcode 26.3 เป็นต้นมา Apple ได้ส่งสะพานเชื่อม Model Context Protocol อย่างเป็นทางการ (`xcrun mcpbridge`) ที่ทำงานผ่าน XPC ในเครื่อง พร้อมด้วยชุดเอเจนต์ `SKILL.md` ฝ่ายแรก (`xcrun agent skills export`) มาให้ด้วย อย่างไรก็ตาม การต่อ `xcrun mcpbridge` แบบดิบ ๆ เข้ากับเอเจนต์เขียนโค้ดแบบทั่วไปโดยตรงจะเจอกำแพงในทางปฏิบัติสามด้าน:

1. **`structuredContent` ไม่ตรงกันใน Xcode 26** — เครื่องมืออย่าง `XcodeListWindows` ประกาศ `outputSchema` ไว้ใน `tools/list` แต่กลับคืนค่า JSON ภายใน `content[0].text` และละเว้น `structuredContent` ทำให้ไคลเอนต์ MCP SDK แบบเข้มงวดปฏิเสธคำตอบที่ถูกต้อง
2. **วงจรชีวิตของโพรเซสและการกำหนดเส้นทาง PID แบบหลาย Xcode** — `mcpbridge` จะออกทันทีเมื่อ Xcode ถูกปิด เมื่อ `Xcode.app` และ `Xcode-beta.app` ทำงานพร้อมกัน หรือก่อนที่จะเปิดสิทธิ์การเข้าถึงของเอเจนต์ภายนอกที่ **Xcode → Settings → Intelligence**
3. **บริบทบวม** — Xcode เปิดเผยเครื่องมือระดับละเอียดราว 20+ รายการ และปล่อยสตริง base64 PNG ขนาดหลายเมกะไบต์จาก `RenderPreview`

`DSH Xcode` ห่อสะพานเชื่อมอย่างเป็นทางการของ Apple เป็นปลั๊กอิน DeepSeek Harness แบบเนทีฟที่ไม่มี dependency พร้อม Workbench ในแถบด้านข้างขวาแบบในตัว และการค้นหาปลั๊กอินคู่แบบ zero-coupling ร่วมกับ [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios)

| | |
| --- | --- |
| ⚡ **ตรวจวินิจฉัยรายไฟล์ใน &lt; 1 วินาที** | `xcode_diagnostics` เมื่อส่ง `filePath` จะเรียก `XcodeRefreshCodeIssuesInFile` บนกราฟคอมไพเลอร์สดของ Xcode — ตรวจการแก้ไข Swift/ObjC ให้เสร็จภายในหนึ่งวินาทีโดยไม่ต้องเปิด `xcodebuild` แบบเย็น (cold) เลย |
| 🖼️ **สแนปช็อต SwiftUI `#Preview` แบบเนทีฟ** | `xcode_render_preview` ขับเคลื่อนเอนจิน `RenderPreview` ของ Xcode เองบน `.xcodeproj`, `.xcworkspace` และ Swift package เขียนไฟล์ PNG ลง `.dsh-xcode/previews/` และแนบรูปภาพโดยตรงเมื่อใช้โมเดลแบบมัลติโมดัล |
| 🔨 **บิลด์ &amp; ทดสอบแบบ warm incremental** | `xcode_build_test` ใช้กราฟบิลด์ DerivedData แบบอุ่นของ Xcode ซ้ำสำหรับ `BuildProject`, `GetBuildLog`, `GetTestList`, `RunAllTests` และ `RunSomeTests` (XCTest &amp; Swift Testing) |
| 🔧 **การปรับมาตรฐานโปรโตคอล Xcode 26** | เติม `structuredContent` ที่หายไปให้อัตโนมัติจากบล็อกข้อความ JSON แก้ไข `tabIdentifier` ข้ามหน้าต่างเวิร์กสเปซที่เปิดหลายบาน และตัดสตริง base64 ขนาดใหญ่เกินไปออกจากสรุป JSON |
| 📘 **ซิงก์ `SKILL.md` อย่างเป็นทางการจาก Apple** | รัน `xcrun agent skills export` แยกวิเคราะห์ชุด `SKILL.md` ในตัวของ Apple สำหรับ Xcode บิลด์ที่คุณใช้อยู่ แคชไว้ที่ `~/.cache/dsh-xcode/skills/` และลงทะเบียนเข้า `ctx.skills` แบบไดนามิก |
| 🪟 **Xcode Workbench ในแถบด้านข้างขวา** | ป้ายสถานะการเชื่อมต่อแบบสด หน้าต่างเวิร์กสเปซที่เปิดอยู่ (`tabIdentifier`) รายการวินิจฉัยคอมไพเลอร์ สรุปผลบิลด์/ทดสอบ แกลเลอรีสแนปช็อต SwiftUI `#Preview` ที่เรนเดอร์แล้ว และสถานะอุปกรณ์คู่จาก `dsh-ios` |
| 📱 **จับคู่กับ `dsh-ios`** | ไม่ผูกกันตั้งแต่ตอนติดตั้งผ่าน `Symbol.for('zseven.dsh.apple.peer.v1')`: `dsh-xcode` ดูแลด้านความฉลาดคอมไพเลอร์ของ IDE ส่วน `dsh-ios` สตรีมและควบคุม Simulator สดและ iPhone ที่ต่อ USB |
| 🧭 **ทางรอดรองรับอนาคต** | `xcode_call_tool` แสดงรายการและเรียกใช้เครื่องมือ `mcpbridge` ดิบใดก็ได้ (`ExecuteSnippet`, `XcodeUpdate`, `XcodeGlob` หรือ `DeviceInteraction*` ใน Xcode 27+) โดยไม่ต้องรอปลั๊กอินอัปเดต |

## เครื่องมือ

เครื่องมือทั้ง 8 รายการจะลงทะเบียนบนทุกโฮสต์ แก้ไข `tabIdentifier` จากเวิร์กสเปซที่ใช้งานอยู่ให้อัตโนมัติเมื่อไม่ได้ระบุ และรายงานพร้อมคำแนะนำการตั้งค่าที่ลงมือทำได้บนโฮสต์ที่ไม่ใช่ macOS หรือเมื่อ Xcode ปิดอยู่

| เครื่องมือ | หน้าที่การทำงาน | พารามิเตอร์หลัก |
| --- | --- | --- |
| `xcode_status` | ตรวจสอบไดเรกทอรีนักพัฒนาของ `xcode-select` ที่ใช้งานอยู่ เวอร์ชัน/บิลด์ของ Xcode ความสามารถ `xcrun mcpbridge` &amp; `agent` PID ของ `Xcode.app` ที่กำลังทำงาน หน้าต่างเวิร์กสเปซที่เปิดอยู่ (`tabIdentifier` ต่าง ๆ) Apple skills ที่ซิงก์แล้ว และสถานะปลั๊กอินคู่ `dsh-ios` | `connect` (ค่าเริ่มต้น `true`) |
| `xcode_open_project` | ตรวจจับและเปิดไฟล์ `.xcworkspace`, `.xcodeproj` หรือ `Package.swift` ใน Xcode โดยอัตโนมัติ (`open -a Xcode`) จากนั้นวนรอจนกว่า `mcpbridge` จะเชื่อมต่อและรายงาน `tabIdentifier` ของหน้าต่างนั้น | `projectPath` (ไม่บังคับ), `waitSeconds` (ค่าเริ่มต้น `20`) |
| `xcode_diagnostics` | อ่านข้อผิดพลาดและคำเตือนจากคอมไพเลอร์แบบสดจาก Xcode ส่ง `filePath` เพื่อตรวจประเภทรายไฟล์ใน `< 1 s` (`XcodeRefreshCodeIssuesInFile`) หรือละเว้น `filePath` เพื่อรับการวินิจฉัยทั้งเวิร์กสเปซจาก Issue Navigator (`XcodeListNavigatorIssues`) | `filePath`, `projectPath`, `tabIdentifier`, `severity` (`error`/`warning`/`remark`), `pattern` |
| `xcode_build_test` | บิลด์ scheme ที่ใช้งานอยู่ ดูบันทึกบิลด์ที่กรองแล้ว หรือแสดงรายการ/รันชุดทดสอบ XCTest &amp; Swift Testing ภายในกราฟบิลด์แบบอุ่นของ Xcode | `action` (จำเป็น — `build`/`build_log`/`list_tests`/`run_all_tests`/`run_some_tests`), `tests` (อาร์เรย์ JSON), `severity`, `pattern` |
| `xcode_render_preview` | เรนเดอร์สแนปช็อต SwiftUI `#Preview` หรือ `PreviewProvider` แบบเนทีฟใน Xcode บันทึก PNG ไว้ที่ `.dsh-xcode/previews/` สำหรับแกลเลอรีใน Workbench และแนบเข้าบริบทของโมเดลมัลติโมดัล | `sourceFilePath` (จำเป็น), `previewDefinitionIndexInFile` (ค่าเริ่มต้น `0`), `projectPath`, `tabIdentifier` |
| `xcode_search_docs` | ค้นหาเชิงความหมายในเอกสาร Apple Developer Documentation ในตัวของ Xcode และบันทึกถอดความจาก WWDC (`DocumentationSearch`) | `query` (จำเป็น), `frameworks` (รายการคั่นด้วยจุลภาค ไม่บังคับ เช่น `"SwiftUI,Observation"`) |
| `xcode_sync_skills` | ส่งออกชุด `SKILL.md` อย่างเป็นทางการของ Apple จากแอป Xcode ที่ใช้งานอยู่ผ่าน `xcrun agent skills export` และลงทะเบียนเข้าสู่เซสชัน DSH ปัจจุบัน | — |
| `xcode_call_tool` | แสดงรายการเครื่องมือ MCP ดิบทั้งหมดที่เวอร์ชัน Xcode ของคุณเปิดเผย (`action: "list"`) หรือเรียกใช้เครื่องมือดิบใดก็ได้โดยตรง (`action: "call"`) | `action` (จำเป็น — `list`/`call`), `toolName`, `argumentsJson` |

## พื้นที่แสดงผล

- **แผงแถบด้านข้างขวา — “Xcode Workbench”** เปิดได้จากปุ่ม **Open Workbench** บนแถวเครื่องมือใดก็ได้ หรือจากตัวเปิด **`+`** ในแถบด้านข้างขวา (**Xcode Workbench**) แสดงป้ายสถานะการเชื่อมต่อ Xcode แบบสด + PID, เวอร์ชัน/บิลด์ของ Xcode, ลิงก์อุปกรณ์สดจาก `dsh-ios`, หน้าต่างเวิร์กสเปซที่เปิดอยู่ (`tabIdentifier` ต่าง ๆ), การวินิจฉัยคอมไพเลอร์ล่าสุดพร้อมป้ายกำกับไฟล์/บรรทัด, ผลบิลด์/ทดสอบล่าสุด, ภาพตัวอย่าง SwiftUI `#Preview` ที่เรนเดอร์แล้ว, Apple Skills ที่ซิงก์แล้ว และเครื่องมือ MCP ที่เมานต์ไว้ ปุ่มบนแถบเครื่องมือ (**Refresh**, **Open Project**, **Diagnostics**, **Build Scheme**, **Sync Apple Skills**) ทำงานผ่านคำสั่งเซสชัน `/xcode` โดยไม่เปลืองโทเคนของโมเดล
- **การ์ดสนทนาแบบกระชับ** การเรียกเครื่องมือ (`xcode_status`, `xcode_open_project`, `xcode_diagnostics`, `xcode_build_test`, `xcode_render_preview`, `xcode_sync_skills`) จะแสดงเป็นแถวโลคัลไลซ์แบบกระชับ (`zh` / `en`) ซึ่งรีเฟรชแท็บ Workbench ที่เปิดอยู่โดยอัตโนมัติเมื่อการเรียกเสร็จสิ้น

## การจับคู่กับ DSH iOS (`@zseven-w/dsh-ios`)

`dsh-xcode` และ [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios) **ไม่มีการพึ่งพากันแบบเข้มงวดเลย** — ติดตั้งอย่างใดอย่างหนึ่งหรือทั้งคู่พร้อมกันก็ได้ เมื่อโหลดทั้งสองในโปรไฟล์ DSH เดียวกัน ทั้งคู่จะค้นหากันในโพรเซสเดียวกันผ่าน `Symbol.for('zseven.dsh.apple.peer.v1')`:

- **ใช้ `dsh-xcode` (`xcode_*`) สำหรับงาน IDE &amp; คอมไพเลอร์** — การวินิจฉัยรายไฟล์ใน `< 1 s` ขณะแก้ไขไฟล์ Swift/ObjC บิลด์และยูนิตเทสต์ scheme แบบ warm incremental สแนปช็อต SwiftUI `#Preview` ของ `.xcodeproj` / `.xcworkspace` และการค้นหาเอกสาร Apple ในเครื่อง
- **ใช้ `dsh-ios` (`ios_sim_*`) สำหรับรันไทม์อุปกรณ์สด &amp; ระบบอัตโนมัติ UI** — สตรีมวิดีโอ MJPEG ของ Simulator แบบโต้ตอบและ iPhone จริงที่ต่อ USB ในแถบด้านข้าง โครงสร้างการเข้าถึง AXe (`ios_sim_ui_tree`, `ios_sim_tap_element`, `ios_sim_ui_rows`) ค้นหา/แตะข้อความด้วย Vision OCR (`ios_sim_find_text`, `ios_sim_tap_text`) บันทึกรันไทม์แบบรวม (`ios_sim_logs`) backtrace ของ LLDB และ `leaks`
- **การกำหนดเส้นทางข้ามปลั๊กอินอย่างชาญฉลาด** — หากเอเจนต์เรียก `ios_sim_preview` (hot-reload ของ dylib SwiftPM) บนโปรเจกต์ `.xcodeproj` / `.xcworkspace` ฝ่าย `dsh-ios` จะตรวจพบว่า `dsh-xcode` เมานต์อยู่แล้วนำเอเจนต์ไปสู่ `xcode_render_preview` โดยตรง

## ความปลอดภัยและความเป็นส่วนตัว

- **สื่อสารผ่าน XPC ในเครื่องเท่านั้น** — `xcrun mcpbridge` สื่อสารเฉพาะกับโพรเซส Xcode ในเครื่องของคุณผ่าน XPC ของ macOS เท่านั้น ปลั๊กอินไม่เปิดพอร์ตรอรับการเชื่อมต่อเครือข่ายใด ๆ และไม่ส่งคำขอ HTTP ภายนอกเลย
- **ล้างตัวแปรสภาพแวดล้อม** — ก่อนเปิด `xcrun mcpbridge` หรือ `xcrun agent` ฟังก์ชัน `scrubEnvForMcpBridge` จะตัดตัวแปรสภาพแวดล้อมทุกตัวที่ชื่อตรงกับ `*KEY*`, `*SECRET*`, `*TOKEN*`, `*PASSWORD*` หรือ `DSH_*` ออก ส่งต่อเฉพาะตัวแปรมาตรฐานสำหรับนักพัฒนา/XPC ของ macOS (`HOME`, `USER`, `PATH`, `TMPDIR`, `DEVELOPER_DIR`, `MCP_XCODE_PID`, `MCP_XCODE_SESSION_ID`)
- **การยินยอมอย่างชัดเจนจากผู้ใช้ Xcode** — การเข้าถึงของเอเจนต์ภายนอกถูกควบคุมด้วยสวิตช์ **Settings → Intelligence → Model Context Protocol** ของ Xcode เองและกล่องโต้ตอบการอนุญาตของ macOS/Xcode
- **การจัดการข้อมูลไบนารีแบบมีขอบเขต** — บล็อกรูปภาพของ MCP จะถูกตรวจสอบกับ base64 มาตรฐานและเพดานขนาด 20 MB ที่เข้มงวดก่อนถอดรหัส สตริง base64 ขนาดใหญ่เกินไปในเพย์โหลด JSON ดิบจะถูกตัดออกเพื่อให้บริบทของโมเดลสะอาดอยู่เสมอ

## ความต้องการของระบบ

- **macOS** ที่ติดตั้ง **Xcode 26.3 หรือใหม่กว่า** (`xcode-select -p` ต้องชี้ไปที่ `/Applications/Xcode.app/Contents/Developer` ไม่ใช่ Command Line Tools)
- **DeepSeek Harness** `0.2.1-rc.5` หรือใหม่กว่า, Node.js `>= 24.11.0`
- **ตั้งค่า Xcode ครั้งเดียว** — เปิด **Xcode → Settings → Intelligence → Model Context Protocol** แล้วเปิด **Allow External Agents** (อนุมัติข้อความขอสิทธิ์ของ Xcode เมื่อเชื่อมต่อครั้งแรก)

## การติดตั้งลงใน DSH

```sh
dsh plugin --profile web add @zseven-w/dsh-xcode@latest
dsh web
```

ติดตั้ง `dsh-ios` เพิ่มเพื่อใช้สตรีมมิ่ง Simulator + iPhone USB ครบวงจรควบคู่กับเครื่องมือ IDE ของ Xcode:

```sh
dsh plugin --profile web add @zseven-w/dsh-ios@latest
```

## เริ่มต้นใช้งานอย่างรวดเร็ว

1. **ตรวจสอบสถานะและเปิดโปรเจกต์** — *“ตรวจสอบสถานะ Xcode แล้วเปิดโปรเจกต์ iOS ในโฟลเดอร์นี้”* → `xcode_status` / `xcode_open_project` หากเป็นการรันครั้งแรกให้อนุมัติข้อความขออนุญาตเอเจนต์ภายนอกของ Xcode
2. **แก้ไขและตรวจไฟล์เดียวใน `< 1 s`** — *“รีแฟกเตอร์ `HomeView.swift` แล้วตรวจข้อผิดพลาดคอมไพเลอร์โดยไม่ต้องบิลด์ทั้งโปรเจกต์”* → `xcode_diagnostics` (`filePath: "Sources/HomeView.swift"`)
3. **เรนเดอร์ `#Preview` ของ SwiftUI** — *“เรนเดอร์พรีวิว SwiftUI ของ `HomeView.swift` แล้วดูเลย์เอาต์”* → `xcode_render_preview` เปิด **Xcode Workbench** ในแถบด้านข้างขวาเพื่อดูสแนปช็อตที่เรนเดอร์แล้ว
4. **ค้นเอกสาร Apple และรันทดสอบ** — *“ค้นเอกสารในเครื่องของ Xcode เรื่องการควบคุมการมองเห็นคอลัมน์ของ `NavigationSplitView` แล้วรันยูนิตเทสต์”* → `xcode_search_docs` → `xcode_build_test` (`action: "run_all_tests"`)

## การตั้งค่า

การตั้งค่าเพิ่มเติม (ไม่บังคับ) ภายใต้ `plugins.dsh-xcode` ในไฟล์ `cordis.patch.yml`:

| ตัวเลือก | ค่าเริ่มต้น | ความหมาย |
| --- | --- | --- |
| `xcodePid` | แก้ไขอัตโนมัติ | ระบุ PID ของ Xcode ที่กำลังทำงาน (`MCP_XCODE_PID`) เมื่อเปิด `Xcode.app` และ `Xcode-beta.app` พร้อมกัน |
| `callTimeoutMs` | `180000` | ค่าหมดเวลา (ms) เริ่มต้นสำหรับการดำเนินการ Xcode MCP ที่ใช้เวลานาน (`BuildProject`, `RunAllTests`, `RenderPreview`) |
| `autoSyncSkills` | `true` | ส่งออกและลงทะเบียนชุด `SKILL.md` ในตัวของ Apple โดยอัตโนมัติเมื่อ `xcode_status` หรือ `xcode_open_project` เชื่อมต่อสำเร็จ |
| `skillsCacheDir` | `~/.cache/dsh-xcode/skills` | ไดเรกทอรีสำหรับแคชชุด `SKILL.md` ของ Apple ที่ส่งออกตามหมายเลขบิลด์ของ Xcode |

## การแก้ไขปัญหา

- **`xcrun could not find mcpbridge` / ข้อผิดพลาด Command Line Tools** — `xcode-select -p` กำลังชี้ไปที่ `/Library/Developer/CommandLineTools` หรือ Xcode เก่ากว่า 26.3 ให้สลับไปใช้ Xcode 26.3+ แบบเต็ม: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
- **`Could not establish MCP tool session with Xcode`** — ตรวจสอบว่ามีหน้าต่างโปรเจกต์/เวิร์กสเปซเปิดอยู่ใน Xcode อย่างน้อยหนึ่งบาน (`xcode_open_project`) เปิด **Xcode → Settings → Intelligence → Model Context Protocol → Allow External Agents** และกด **Allow** หาก Xcode แสดงกล่องโต้ตอบขออนุญาตเอเจนต์อยู่เบื้องหลัง
- **มี Xcode ทำงานพร้อมกันหลายตัว** — `dsh-xcode` เลือก PID ที่ตรงกับ `xcode-select -p` โดยอัตโนมัติ หากเปิดสำเนาของ bundle เดียวกันสองชุด ให้ระบุ `xcodePid` ในคอนฟิกหรือตั้ง `DSHPLUGIN_XCODE_PID=<pid>`
- **มาโคร `#Preview` ล้มเหลวบนการตั้งค่า target แบบกำหนดเอง** — เอนจินพรีวิวของ Xcode บางครั้งอนุมาน form factor ของมาโคร `#Preview` ที่ซับซ้อนไม่สำเร็จ การเพิ่ม struct `PreviewProvider` มาตรฐานลงในไฟล์จะทำงานได้อย่างน่าเชื่อถือกับ `xcode_render_preview`

## การพัฒนา

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run smoke:pack
```

ลิงก์โค้ดในเครื่องเข้ากับโปรไฟล์ DSH Web ของคุณ:

```sh
dsh plugin --profile web add link:/path/to/dsh-xcode
dsh web
```

| ชุดทดสอบ | ครอบคลุมเนื้อหา |
| --- | --- |
| `test/mcp-stdio.test.mjs` | การจับมือ STDIO JSON-RPC, `tools/list` แบบแบ่งหน้า, การเติม `structuredContent` ที่ Xcode 26 ละเว้น, การถอดรหัส PNG มาตรฐาน, การตัด base64, การล้างตัวแปรสภาพแวดล้อม, การจำแนกข้อผิดพลาด |
| `test/env-and-bridge.test.mjs` | การกรองโพรเซส Xcode กับ Simulator จาก `ps`, กฎการเลือก PID, การค้นหา `.xcworkspace`/`.xcodeproj`/`Package.swift`, การแก้ไข `tabIdentifier` อัตโนมัติ, การเก็บสถานะการวินิจฉัย/บิลด์/พรีวิว, การส่งออก `SKILL.md` และวงจรชีวิต `apply()` ของ Host |
| `test/client-bundle.test.mjs` | รูปแบบบันเดิลของ `window.__ModuleLoader__.load`, เงื่อนไขไม่เปลี่ยนแปลงของ React โฮสต์แบบ externalized, ความสอดคล้องของ locale `zh`/`en`, การเข้ารหัสที่อยู่ทรัพยากรของ Workbench, การลงทะเบียน slot และแท็บ |
| `test/ios-peer-linkage.test.mjs` | การค้นหาข้ามปลั๊กอินแบบสดผ่าน `Symbol.for('zseven.dsh.apple.peer.v1')` ร่วมกับ `@zseven-w/dsh-ios` และการกำหนดเส้นทางอัจฉริยะ `.xcodeproj` → `xcode_render_preview` |

## ระบบนิเวศ

- [DSH iOS Simulator](https://github.com/ZSeven-W/dsh-ios) — สตรีมสด iOS Simulator แบบโต้ตอบและ iPhone จริงที่ต่อ USB, โครงสร้าง UI แบบ AXe, Vision OCR และ hot reload พรีวิวแบบ SwiftPM
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — โปรแกรมจำลอง Android หรืออุปกรณ์ USB แบบสดภายในบทสนทนา ควบคุมทั้งหมดผ่าน `adb`
- [DSH Computer](https://github.com/ZSeven-W/dsh-computer) — ไดรเวอร์ Computer Use บน macOS แบบ headless-first พร้อมการสังเกตแบบ AX-first และการอนุมัติที่โฮสต์เป็นผู้ถือ
- [DSH Browser](https://github.com/ZSeven-W/dsh-browser) — เซสชัน Chromium แบบแยกขัดแย้งพร้อม semantic reference และหลักฐานที่จำกัดปริมาณ
- [DSH QA](https://github.com/ZSeven-W/dsh-qa) — การสำรวจแบบ agent-led และการเล่นซ้ำสถานการณ์แบบ deterministic ข้าม Browser, Desktop, iOS และ Android
- [DSH Game Studio](https://github.com/ZSeven-W/dsh-game-studio) — อธิบายเกม voxel 2D หรือ 3D ในประโยคเดียว เล่นในแถบด้านข้าง สลับภาพอาร์ตจาก AI และเผยแพร่ในคลิกเดียว
- [DSH Harbor](https://github.com/ZSeven-W/dsh-harbor) — สรุปความสามารถ การตรวจจับความขัดแย้ง และการตรวจก่อนอัปเกรด DSH สำหรับปลั๊กอินที่ติดตั้งไว้
- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — ส่งงานให้เอเจนต์ DSH จาก Claude Code / Codex ในรูปแบบ subagent ดั้งเดิม
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — หน่วยความจำเอเจนต์ระยะยาวที่คงทนและตรวจสอบได้สำหรับ DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — ดูตัวอย่าง ตรวจสอบและแก้ไขเอกสารดีไซน์ `.op` ของ OpenPencil ภายในบทสนทนา DSH

## สัญญาอนุญาต

MIT © ZSeven-W
