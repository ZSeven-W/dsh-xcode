<p align="center">
  <img src="./docs/images/dsh-xcode-logo.png" alt="DSH Xcode" width="120" />
</p>

<h1 align="center">DSH Xcode</h1>

<p align="center">
  <strong>Jembatan Xcode MCP resmi Apple (<code>xcrun mcpbridge</code>) dan Apple Skills bawaan di dalam percakapan <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> — berpasangan secara mulus dengan <a href="https://github.com/ZSeven-W/dsh-ios">DSH iOS</a>.</strong><br />
  <sub>8 alat agen &bull; diagnostik kompiler satu file &lt; 1 detik &bull; cuplikan SwiftUI <code>#Preview</code> natif &bull; build &amp; uji skema hangat &bull; pencarian dokumentasi Apple lokal &bull; Workbench bilah sisi kanan</sub>
</p>

<p align="center">
  <sub>Paket: <code>@zseven-w/dsh-xcode</code> &middot; Rilis plugin saat ini: <code>0.1.0-rc.1</code> &middot; Diuji dengan DSH <code>0.2.1-rc.5</code></sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <b>Bahasa Indonesia</b>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-xcode/actions/workflows/check.yml"><img src="https://img.shields.io/github/actions/workflow/status/ZSeven-W/dsh-xcode/check.yml?label=CI" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@zseven-w/dsh-xcode"><img src="https://img.shields.io/npm/v/@zseven-w/dsh-xcode?color=1a78f2" alt="npm" /></a>
  <a href="https://github.com/ZSeven-W/dsh-xcode/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-xcode?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-xcode-banner.png" alt="DSH Xcode — Jembatan Xcode MCP resmi &amp; Apple Skills bawaan di dalam DeepSeek Harness" width="100%" />
</p>

## Mengapa DSH Xcode

Mulai dari Xcode 26.3, Apple menyertakan jembatan Model Context Protocol resmi (`xcrun mcpbridge`) melalui XPC lokal plus bundel agen `SKILL.md` pihak pertama (`xcrun agent skills export`). Namun, menyambungkan `xcrun mcpbridge` mentah langsung ke agen pengodean generik menabrak tiga dinding praktis:

1. **Ketidakcocokan `structuredContent` Xcode 26** — alat seperti `XcodeListWindows` mendeklarasikan `outputSchema` di `tools/list` tetapi mengembalikan JSON di dalam `content[0].text` dan menghilangkan `structuredContent`, sehingga klien MCP SDK yang ketat menolak respons yang valid.
2. **Daur hidup proses &amp; perutean PID multi-Xcode** — `mcpbridge` langsung keluar ketika Xcode ditutup, ketika `Xcode.app` dan `Xcode-beta.app` sama-sama berjalan, atau sebelum akses agen eksternal diaktifkan di **Xcode → Settings → Intelligence**.
3. **Konteks membengkak** — Xcode mengekspos 20+ alat granular dan memancarkan string PNG base64 berukuran multi-megabyte dari `RenderPreview`.

`DSH Xcode` membungkus jembatan resmi Apple menjadi plugin DeepSeek Harness natif tanpa dependensi dengan Workbench bilah sisi kanan terintegrasi dan penemuan peer tanpa kopling bersama [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios).

| | |
| --- | --- |
| ⚡ **Diagnostik satu file &lt; 1 detik** | `xcode_diagnostics` dengan `filePath` memanggil `XcodeRefreshCodeIssuesInFile` pada graf kompiler langsung Xcode — memeriksa editan Swift/ObjC dalam waktu kurang dari satu detik tanpa memunculkan `xcodebuild` dingin. |
| 🖼️ **Cuplikan SwiftUI `#Preview` natif** | `xcode_render_preview` menggerakkan mesin `RenderPreview` milik Xcode sendiri lintas `.xcodeproj`, `.xcworkspace`, dan paket Swift, menulis PNG ke `.dsh-xcode/previews/`, dan melampirkan gambar secara langsung saat model multimodal aktif. |
| 🔨 **Build &amp; uji inkremental hangat** | `xcode_build_test` menggunakan kembali graf build DerivedData hangat Xcode untuk `BuildProject`, `GetBuildLog`, `GetTestList`, `RunAllTests`, dan `RunSomeTests` (XCTest &amp; Swift Testing). |
| 🔧 **Normalisasi protokol Xcode 26** | Menghidrasi `structuredContent` yang hilang dari blok teks JSON secara otomatis, me-resolve `tabIdentifier` lintas beberapa jendela ruang kerja yang terbuka, dan memangkas string base64 berukuran berlebih dari ringkasan JSON. |
| 📘 **Sinkronisasi `SKILL.md` resmi Apple** | Menjalankan `xcrun agent skills export`, mengurai bundel `SKILL.md` bawaan Apple untuk versi build Xcode Anda persis, menyimpannya di cache `~/.cache/dsh-xcode/skills/`, dan mendaftarkannya secara dinamis ke `ctx.skills`. |
| 🪟 **Xcode Workbench bilah sisi kanan** | Pil status koneksi langsung, jendela ruang kerja terbuka (`tabIdentifier`), daftar diagnostik kompiler, ringkasan build/uji, galeri cuplikan SwiftUI `#Preview` yang dirender, dan status perangkat peer `dsh-ios`. |
| 📱 **Berpasangan dengan `dsh-ios`** | Tanpa kopling saat instalasi melalui `Symbol.for('zseven.dsh.apple.peer.v1')`: `dsh-xcode` menangani kecerdasan kompiler IDE sementara `dsh-ios` menyalurkan dan menggerakkan Simulator langsung &amp; iPhone yang terhubung USB. |
| 🧭 **Pintu darurat masa depan** | `xcode_call_tool` mendaftar dan memanggil alat `mcpbridge` mentah apa pun (`ExecuteSnippet`, `XcodeUpdate`, `XcodeGlob`, atau `DeviceInteraction*` di Xcode 27+) tanpa menunggu pembaruan plugin. |

## Alat

Semua 8 alat terdaftar di setiap host, me-resolve `tabIdentifier` dari ruang kerja aktif secara otomatis saat dihilangkan, dan menurunkan kemampuan dengan instruksi penyiapan yang dapat ditindaklanjuti pada host non-macOS atau saat Xcode tertutup.

| Alat | Fungsi | Parameter utama |
| --- | --- | --- |
| `xcode_status` | Memeriksa direktori pengembang `xcode-select` aktif, versi/build Xcode, kapabilitas `xcrun mcpbridge` &amp; `agent`, PID `Xcode.app` yang berjalan, jendela ruang kerja terbuka (`tabIdentifier`), Apple skills yang disinkronkan, dan status peer `dsh-ios`. | `connect` (default `true`) |
| `xcode_open_project` | Mendeteksi otomatis dan membuka `.xcworkspace`, `.xcodeproj`, atau `Package.swift` di Xcode (`open -a Xcode`), lalu melakukan polling hingga `mcpbridge` terhubung dan melaporkan `tabIdentifier` jendela tersebut. | `projectPath` (opsional), `waitSeconds` (default `20`) |
| `xcode_diagnostics` | Membaca kesalahan dan peringatan kompiler langsung dari Xcode. Berikan `filePath` untuk pemeriksaan tipe satu file `< 1 s` (`XcodeRefreshCodeIssuesInFile`), atau hilangkan `filePath` untuk diagnostik seluruh ruang kerja dari Issue Navigator (`XcodeListNavigatorIssues`). | `filePath`, `projectPath`, `tabIdentifier`, `severity` (`error`/`warning`/`remark`), `pattern` |
| `xcode_build_test` | Membangun skema aktif, memeriksa log build yang difilter, atau mendaftar/menjalankan suite XCTest &amp; Swift Testing di dalam graf build hangat Xcode. | `action` (wajib — `build`/`build_log`/`list_tests`/`run_all_tests`/`run_some_tests`), `tests` (array JSON), `severity`, `pattern` |
| `xcode_render_preview` | Merender cuplikan SwiftUI `#Preview` atau `PreviewProvider` secara natif di Xcode, menyimpan PNG di `.dsh-xcode/previews/` untuk galeri Workbench, dan melampirkannya ke konteks model multimodal. | `sourceFilePath` (wajib), `previewDefinitionIndexInFile` (default `0`), `projectPath`, `tabIdentifier` |
| `xcode_search_docs` | Pencarian semantik di Apple Developer Documentation bawaan Xcode dan transkripsi sesi WWDC (`DocumentationSearch`). | `query` (wajib), `frameworks` (daftar dipisah koma opsional, mis. `"SwiftUI,Observation"`) |
| `xcode_sync_skills` | Mengekspor bundel `SKILL.md` resmi Apple dari aplikasi Xcode aktif melalui `xcrun agent skills export` dan mendaftarkannya ke sesi DSH saat ini. | — |
| `xcode_call_tool` | Mendaftar semua alat MCP mentah yang diekspos versi Xcode Anda (`action: "list"`) atau memanggil alat mentah mana pun secara langsung (`action: "call"`). | `action` (wajib — `list`/`call`), `toolName`, `argumentsJson` |

## Permukaan tampilan

- **Panel bilah sisi kanan — “Xcode Workbench”.** Dibuka dari tombol **Open Workbench** pada baris alat mana pun atau dari peluncur **`+`** bilah sisi kanan (**Xcode Workbench**). Menampilkan lencana koneksi Xcode langsung + PID, versi/build Xcode, tautan perangkat langsung `dsh-ios`, jendela ruang kerja terbuka (`tabIdentifier`), diagnostik kompiler terbaru dengan lencana berkas/baris, hasil build/uji terbaru, thumbnail SwiftUI `#Preview` yang dirender, Apple Skills yang disinkronkan, dan alat MCP yang dipasang. Tombol bilah alat (**Refresh**, **Open Project**, **Diagnostics**, **Build Scheme**, **Sync Apple Skills**) berjalan melalui perintah sesi `/xcode` tanpa menghabiskan token model.
- **Kartu percakapan ringkas.** Panggilan alat (`xcode_status`, `xcode_open_project`, `xcode_diagnostics`, `xcode_build_test`, `xcode_render_preview`, `xcode_sync_skills`) merender baris terlokalisasi ringkas (`zh` / `en`) yang otomatis menyegarkan tab Workbench terbuka saat sebuah panggilan selesai.

## Berpasangan dengan DSH iOS (`@zseven-w/dsh-ios`)

`dsh-xcode` dan [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios) **tidak memiliki dependensi keras satu sama lain** — pasang salah satu saja atau keduanya sekaligus. Saat keduanya dimuat dalam profil DSH yang sama, keduanya saling menemukan dalam proses melalui `Symbol.for('zseven.dsh.apple.peer.v1')`:

- **Gunakan `dsh-xcode` (`xcode_*`) untuk pekerjaan IDE &amp; kompiler** — diagnostik satu file `< 1 s` saat mengedit berkas Swift/ObjC, build dan uji unit skema inkremental hangat, cuplikan SwiftUI `#Preview` untuk `.xcodeproj` / `.xcworkspace`, dan pencarian dokumentasi Apple lokal.
- **Gunakan `dsh-ios` (`ios_sim_*`) untuk runtime perangkat langsung &amp; otomasi UI** — streaming video MJPEG Simulator interaktif dan iPhone asli terhubung USB di bilah sisi, pohon aksesibilitas AXe (`ios_sim_ui_tree`, `ios_sim_tap_element`, `ios_sim_ui_rows`), cari/ketuk Vision OCR (`ios_sim_find_text`, `ios_sim_tap_text`), log runtime terpadu (`ios_sim_logs`), backtrace LLDB, dan `leaks`.
- **Perutean cerdas antar-plugin** — jika agen memanggil `ios_sim_preview` (hot-reload dylib SwiftPM) pada `.xcodeproj` / `.xcworkspace`, `dsh-ios` mendeteksi bahwa `dsh-xcode` terpasang dan mengarahkan agen langsung ke `xcode_render_preview`.

## Keamanan dan privasi

- **Hanya transport XPC lokal** — `xcrun mcpbridge` berkomunikasi secara eksklusif dengan proses Xcode lokal Anda melalui XPC macOS; plugin tidak membuka pendengar jaringan apa pun dan tidak melakukan permintaan HTTP eksternal.
- **Pembersihan lingkungan** — sebelum memunculkan `xcrun mcpbridge` atau `xcrun agent`, `scrubEnvForMcpBridge` menghapus variabel lingkungan apa pun yang cocok dengan `*KEY*`, `*SECRET*`, `*TOKEN*`, `*PASSWORD*`, atau `DSH_*`, hanya meneruskan variabel pengembang/XPC macOS standar (`HOME`, `USER`, `PATH`, `TMPDIR`, `DEVELOPER_DIR`, `MCP_XCODE_PID`, `MCP_XCODE_SESSION_ID`).
- **Persetujuan eksplisit pengguna Xcode** — akses agen eksternal dibatasi oleh sakelar **Settings → Intelligence → Model Context Protocol** milik Xcode sendiri dan dialog izin macOS/Xcode.
- **Penanganan biner berbatas** — blok gambar MCP diverifikasi terhadap base64 kanonik dan batas ketat 20 MB sebelum didekodekan; string base64 berukuran berlebih di dalam payload JSON mentah dipangkas agar konteks model tetap bersih.

## Persyaratan

- **macOS** dengan **Xcode 26.3 atau lebih baru** terpasang (`xcode-select -p` menunjuk ke `/Applications/Xcode.app/Contents/Developer`, bukan Command Line Tools).
- **DeepSeek Harness** `0.2.1-rc.5` atau lebih baru, Node.js `>= 24.11.0`.
- **Pengaturan Xcode sekali saja** — buka **Xcode → Settings → Intelligence → Model Context Protocol** dan aktifkan **Allow External Agents** (setujui permintaan izin Xcode saat koneksi pertama).

## Instal ke DSH

```sh
dsh plugin --profile web add @zseven-w/dsh-xcode@latest
dsh web
```

Pasangkan dengan `dsh-ios` untuk streaming Simulator + iPhone USB lengkap di samping alat IDE Xcode:

```sh
dsh plugin --profile web add @zseven-w/dsh-ios@latest
```

## Mulai cepat

1. **Periksa status &amp; buka proyek Anda** — *“Periksa status Xcode dan buka proyek iOS di folder ini.”* → `xcode_status` / `xcode_open_project`. Setujui permintaan agen eksternal Xcode jika ini adalah jalankan pertama Anda.
2. **Edit &amp; periksa satu file dalam `< 1 s`** — *“Refaktor `HomeView.swift` dan periksa kesalahan kompiler tanpa menjalankan build penuh.”* → `xcode_diagnostics` (`filePath: "Sources/HomeView.swift"`).
3. **Render `#Preview` SwiftUI** — *“Render pratinjau SwiftUI dari `HomeView.swift` dan periksa tata letaknya.”* → `xcode_render_preview`. Buka **Xcode Workbench** di bilah sisi kanan untuk memeriksa cuplikan yang dirender.
4. **Cari dokumentasi Apple &amp; jalankan uji** — *“Cari di dokumentasi lokal Xcode tentang visibilitas kolom `NavigationSplitView`, lalu jalankan unit test.”* → `xcode_search_docs` → `xcode_build_test` (`action: "run_all_tests"`).

## Konfigurasi

Pengaturan opsional di bawah `plugins.dsh-xcode` dalam `cordis.patch.yml`:

| Opsi | Default | Arti |
| --- | --- | --- |
| `xcodePid` | resolve otomatis | PID Xcode yang berjalan secara eksplisit (`MCP_XCODE_PID`) saat `Xcode.app` dan `Xcode-beta.app` terbuka bersamaan. |
| `callTimeoutMs` | `180000` | Batas waktu (ms) default untuk operasi Xcode MCP yang berjalan lama (`BuildProject`, `RunAllTests`, `RenderPreview`). |
| `autoSyncSkills` | `true` | Mengekspor dan mendaftarkan bundel `SKILL.md` bawaan Apple secara otomatis saat `xcode_status` atau `xcode_open_project` terhubung. |
| `skillsCacheDir` | `~/.cache/dsh-xcode/skills` | Direktori tempat bundel `SKILL.md` Apple yang diekspor di-cache per nomor build Xcode. |

## Penyelesaian masalah

- **`xcrun could not find mcpbridge` / kesalahan Command Line Tools** — `xcode-select -p` sedang menunjuk ke `/Library/Developer/CommandLineTools` atau Xcode yang lebih lama (< 26.3). Beralihlah ke Xcode 26.3+ penuh: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.
- **`Could not establish MCP tool session with Xcode`** — pastikan setidaknya satu jendela proyek/ruang kerja terbuka di Xcode (`xcode_open_project`), aktifkan **Xcode → Settings → Intelligence → Model Context Protocol → Allow External Agents**, dan klik **Allow** jika Xcode sedang menampilkan dialog otorisasi agen di latar belakang.
- **Beberapa instans Xcode berjalan** — `dsh-xcode` otomatis memilih PID yang cocok dengan `xcode-select -p`; jika dua salinan bundel yang sama terbuka, berikan `xcodePid` di konfigurasi atau setel `DSHPLUGIN_XCODE_PID=<pid>`.
- **Makro `#Preview` gagal pada konfigurasi target khusus** — mesin pratinjau Xcode sesekali kesulitan menyimpulkan faktor bentuk untuk makro `#Preview` yang kompleks; menambahkan struct `PreviewProvider` standar dalam berkas berfungsi andal dengan `xcode_render_preview`.

## Pengembangan

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run smoke:pack
```

Tautkan checkout lokal ke profil DSH Web Anda:

```sh
dsh plugin --profile web add link:/path/to/dsh-xcode
dsh web
```

| Suite | Cakupan |
| --- | --- |
| `test/mcp-stdio.test.mjs` | Jabat tangan STDIO JSON-RPC, `tools/list` berhalaman, hidrasi `structuredContent` yang dihilangkan di Xcode 26, dekode PNG kanonik, pemangkasan base64, pembersihan lingkungan, klasifikasi kesalahan. |
| `test/env-and-bridge.test.mjs` | Pemfilteran proses Xcode vs Simulator dari `ps`, aturan pemilihan PID, penemuan `.xcworkspace`/`.xcodeproj`/`Package.swift`, resolusi otomatis `tabIdentifier`, persistensi status diagnostik/build/pratinjau, ekspor `SKILL.md` &amp; daur hidup `apply()` Host. |
| `test/client-bundle.test.mjs` | Bentuk bundel `window.__ModuleLoader__.load`, invarian React host ter-eksternalisasi, paritas locale `zh`/`en`, pengodean alamat sumber daya Workbench, registrasi slot &amp; tab. |
| `test/ios-peer-linkage.test.mjs` | Penemuan antar-plugin langsung `Symbol.for('zseven.dsh.apple.peer.v1')` dengan `@zseven-w/dsh-ios` dan perutean cerdas `.xcodeproj` → `xcode_render_preview`. |

## Ekosistem

- [DSH iOS Simulator](https://github.com/ZSeven-W/dsh-ios) — streaming Simulator iOS interaktif langsung &amp; iPhone asli terhubung USB, pohon UI AXe, Vision OCR, dan hot reload pratinjau SwiftPM
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — emulator Android atau perangkat USB langsung di dalam percakapan, digerakkan sepenuhnya melalui `adb`
- [DSH Computer](https://github.com/ZSeven-W/dsh-computer) — pengandar Computer Use macOS headless-first dengan observasi AX-first dan persetujuan milik host
- [DSH Browser](https://github.com/ZSeven-W/dsh-browser) — sesi Chromium terisolasi dengan referensi semantik dan bukti berbatas
- [DSH QA](https://github.com/ZSeven-W/dsh-qa) — eksplorasi dipimpin agen dan pemutaran ulang skenario deterministik lintas Browser, Desktop, iOS &amp; Android
- [DSH Game Studio](https://github.com/ZSeven-W/dsh-game-studio) — deskripsikan game voxel 2D atau 3D dalam satu kalimat, mainkan di bilah sisi, ganti dengan seni AI, dan publikasikan sekali klik
- [DSH Harbor](https://github.com/ZSeven-W/dsh-harbor) — inventarisasi kapabilitas, deteksi konflik, dan preflight peningkatan DSH untuk plugin yang terpasang
- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — delegasikan pekerjaan ke agen DSH dari Claude Code / Codex sebagai subagen natif
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — memori agen jangka panjang yang tahan lama dan dapat diperiksa untuk DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — pratinjau, periksa, dan edit dokumen desain `.op` OpenPencil di dalam percakapan DSH

## Lisensi

MIT © ZSeven-W
