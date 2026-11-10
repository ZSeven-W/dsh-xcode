<p align="center">
  <img src="./docs/images/dsh-xcode-logo.png" alt="DSH Xcode" width="120" />
</p>

<h1 align="center">DSH Xcode</h1>

<p align="center">
  <strong>Apple'ın resmî Xcode MCP köprüsü (<code>xcrun mcpbridge</code>) ve yerleşik Apple Skills, bir <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> sohbetinin içinde — <a href="https://github.com/ZSeven-W/dsh-ios">DSH iOS</a> ile kusursuz eşleşme.</strong><br />
  <sub>8 ajan aracı &bull; &lt; 1 sn tek dosya derleyici tanılaması &bull; yerel SwiftUI <code>#Preview</code> anlık görüntüleri &bull; sıcak şema derlemeleri &amp; testleri &bull; yerel Apple belge araması &bull; sağ kenar çubuğu Workbench</sub>
</p>

<p align="center">
  <sub>Paket: <code>@zseven-w/dsh-xcode</code> &middot; Güncel eklenti sürümü: <code>0.1.0-rc.3</code> &middot; DSH <code>0.2.1-rc.5</code> ile test edildi</sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <b>Türkçe</b> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-xcode/actions/workflows/check.yml"><img src="https://img.shields.io/github/actions/workflow/status/ZSeven-W/dsh-xcode/check.yml?label=CI" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@zseven-w/dsh-xcode"><img src="https://img.shields.io/npm/v/@zseven-w/dsh-xcode?color=1a78f2" alt="npm" /></a>
  <a href="https://github.com/ZSeven-W/dsh-xcode/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-xcode?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-xcode-banner.png" alt="DSH Xcode — DeepSeek Harness içinde resmî Xcode MCP köprüsü &amp; Apple Skills" width="100%" />
</p>

## Neden DSH Xcode

Xcode 26.3'ten itibaren Apple, yerel XPC üzerinden resmî bir Model Context Protocol köprüsü (`xcrun mcpbridge`) ve birinci taraf `SKILL.md` ajan paketleri (`xcrun agent skills export`) sunuyor. Ancak ham `xcrun mcpbridge`'i doğrudan genel amaçlı bir kodlama ajanına bağlamak üç pratik duvara toslar:

1. **Xcode 26 `structuredContent` uyumsuzluğu** — `XcodeListWindows` gibi araçlar `tools/list` içinde bir `outputSchema` bildirir ama JSON'u `content[0].text` içinde döndürüp `structuredContent`'i atlar; katı MCP SDK istemcileri geçerli yanıtları reddeder.
2. **İşlem yaşam döngüsü ve çoklu Xcode PID yönlendirmesi** — Xcode kapatıldığında, `Xcode.app` ile `Xcode-beta.app` aynı anda çalıştığında veya **Xcode → Settings → Intelligence** içinde dış ajan erişimi etkinleştirilmeden önce `mcpbridge` anında çıkar.
3. **Bağlam şişmesi** — Xcode yaklaşık 20+ ince taneli araç açığa çıkarır ve `RenderPreview` çok megabaytlık base64 PNG dizgileri yayımlar.

`DSH Xcode`, Apple'ın resmî köprüsünü sıfır bağımlılıklı, yerel bir DeepSeek Harness eklentisine sarar; içine tümleşik sağ kenar çubuğu Workbench'i ve [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios) ile sıfır bağlılıklı akran keşfini ekler.

| | |
| --- | --- |
| ⚡ **&lt; 1 sn tek dosya tanılaması** | `filePath` ile `xcode_diagnostics`, Xcode'un canlı derleyici grafiğinde `XcodeRefreshCodeIssuesInFile` çağırır — soğuk `xcodebuild` çalıştırmaları başlatmadan Swift/ObjC düzenlemelerini bir saniyenin altında denetler. |
| 🖼️ **Yerel SwiftUI `#Preview` anlık görüntüleri** | `xcode_render_preview`, `.xcodeproj`, `.xcworkspace` ve Swift paketlerinde Xcode'un kendi `RenderPreview` motorunu çalıştırır, PNG'leri `.dsh-xcode/previews/` altına yazar ve çok kipli modeller etkin olduğunda görüntüleri doğrudan ekler. |
| 🔨 **Sıcak artımlı derlemeler &amp; testler** | `xcode_build_test`, `BuildProject`, `GetBuildLog`, `GetTestList`, `RunAllTests` ve `RunSomeTests` (XCTest &amp; Swift Testing) için Xcode'un sıcak DerivedData derleme grafiğini yeniden kullanır. |
| 🔧 **Xcode 26 tel normalizasyonu** | Atlanan `structuredContent`'i JSON metin bloklarından otomatik olarak doldurur, birden çok açık çalışma alanı penceresi arasında `tabIdentifier`'ı çözer ve JSON özetlerinden aşırı büyük base64 dizgilerini ayıklar. |
| 📘 **Apple'ın resmî `SKILL.md` eşitlemesi** | `xcrun agent skills export` çalıştırır, tam Xcode yapınız için Apple'ın yerleşik `SKILL.md` paketlerini ayrıştırır, `~/.cache/dsh-xcode/skills/` altında önbelleğe alır ve `ctx.skills` içine dinamik olarak kaydeder. |
| 🪟 **Sağ kenar çubuğu Xcode Workbench** | Canlı bağlantı durumu hapı, açık çalışma alanı `tabIdentifier` pencereleri, derleyici tanılama listesi, derleme/test özeti, işlenmiş SwiftUI `#Preview` galerisi ve `dsh-ios` akran cihaz durumu. |
| 📱 **`dsh-ios` ile eşleşme** | `Symbol.for('zseven.dsh.apple.peer.v1')` üzerinden sıfır kurulum zamanı bağlanması: IDE derleyici zekâsını `dsh-xcode`, canlı Simülatör ve USB'ye bağlı iPhone akışlarını `dsh-ios` üstlenir. |
| 🧭 **Geleceğe hazır çıkış kapısı** | `xcode_call_tool`, herhangi bir ham `mcpbridge` aracını (`ExecuteSnippet`, `XcodeUpdate`, `XcodeGlob` veya Xcode 27+ `DeviceInteraction*`) eklenti güncellemesini beklemeden listeler ve çağırır. |

## Araçlar

8 aracın tamamı her ana makinede kayıtlıdır; atlandığında `tabIdentifier` etkin çalışma alanından otomatik çözülür ve macOS olmayan ana makinelerde ya da Xcode kapalıyken eyleme dönüştürülebilir kurulum yönergeleriyle yetkisini yitirir.

| Araç | Ne yapar | Temel parametreler |
| --- | --- | --- |
| `xcode_status` | Etkin `xcode-select` geliştirici dizinini, Xcode sürüm/yapısını, `xcrun mcpbridge` &amp; `agent` yeteneklerini, çalışan `Xcode.app` PID'lerini, açık çalışma alanı pencerelerini (`tabIdentifier`lar), eşitlenmiş Apple becerilerini ve `dsh-ios` akran durumunu inceler. | `connect` (varsayılan `true`) |
| `xcode_open_project` | Bir `.xcworkspace`, `.xcodeproj` veya `Package.swift` dosyasını Xcode'da otomatik algılayıp açar (`open -a Xcode`), ardından `mcpbridge` bağlanana ve pencerenin `tabIdentifier`'ını bildirene kadar yoklar. | `projectPath` (isteğe bağlı), `waitSeconds` (varsayılan `20`) |
| `xcode_diagnostics` | Xcode'tan canlı derleyici hatalarını ve uyarılarını okur. `< 1 sn` tek dosya tür denetimi için `filePath` verin (`XcodeRefreshCodeIssuesInFile`) ya da çalışma alanı geneli Issue Navigator tanılamaları için `filePath`'ı atlayın (`XcodeListNavigatorIssues`). | `filePath`, `projectPath`, `tabIdentifier`, `severity` (`error`/`warning`/`remark`), `pattern` |
| `xcode_build_test` | Etkin şemayı derler, süzülmüş derleme günlüklerini inceler ya da Xcode'un sıcak derleme grafiğinde XCTest &amp; Swift Testing takımlarını listeler/çalıştırır. | `action` (gerekli — `build`/`build_log`/`list_tests`/`run_all_tests`/`run_some_tests`), `tests` (JSON dizisi), `severity`, `pattern` |
| `xcode_render_preview` | SwiftUI `#Preview` veya `PreviewProvider` anlık görüntüsünü Xcode içinde yerel olarak işler, PNG'yi Workbench galerisi için `.dsh-xcode/previews/` altına kaydeder ve çok kipli model bağlamına ekler. | `sourceFilePath` (gerekli), `previewDefinitionIndexInFile` (varsayılan `0`), `projectPath`, `tabIdentifier` |
| `xcode_search_docs` | Xcode'un yerleşik Apple Developer Documentation ve WWDC oturum transkriptlerinde anlamsal arama (`DocumentationSearch`). | `query` (gerekli), `frameworks` (isteğe bağlı virgülle ayrılmış liste, örn. `"SwiftUI,Observation"`) |
| `xcode_sync_skills` | Etkin Xcode uygulamasından `xcrun agent skills export` ile Apple'ın resmî `SKILL.md` paketlerini dışa aktarır ve geçerli DSH oturumuna kaydeder. | — |
| `xcode_call_tool` | Xcode sürümünüzün açığa çıkardığı tüm ham MCP araçlarını listeler (`action: "list"`) veya herhangi bir ham aracı doğrudan çağırır (`action: "call"`). | `action` (gerekli — `list`/`call`), `toolName`, `argumentsJson` |

## Gösterim yüzeyleri

- **Sağ kenar çubuğu paneli — “Xcode Workbench”.** Herhangi bir araç satırındaki **Open Workbench** düğmesinden ya da sağ kenar çubuğu **`+`** başlatıcısından (**Xcode Workbench**) açılır. Canlı Xcode bağlantı rozeti + PID, Xcode sürüm/yapısı, `dsh-ios` canlı cihaz bağlantısı, açık çalışma alanı pencereleri (`tabIdentifier`lar), dosya/satır rozetli son derleyici tanılamaları, son derleme/test sonucu, işlenmiş SwiftUI `#Preview` küçük resimleri, eşitlenmiş Apple Skills ve bağlı MCP araçlarını gösterir. Araç çubuğu düğmeleri (**Refresh**, **Open Project**, **Diagnostics**, **Build Scheme**, **Sync Apple Skills**) model jetonu harcamadan `/xcode` oturum komutu üzerinden çalışır.
- **Kompakt sohbet kartları.** Araç çağrıları (`xcode_status`, `xcode_open_project`, `xcode_diagnostics`, `xcode_build_test`, `xcode_render_preview`, `xcode_sync_skills`) kompakt yerelleştirilmiş satırlar (`zh` / `en`) oluşturur ve bir çağrı tamamlandığında açık Workbench sekmelerini otomatik yeniler.

## DSH iOS (`@zseven-w/dsh-ios`) ile eşleştirme

`dsh-xcode` ve [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios) birbirleri üzerinde **hiçbir sert bağımlılığa sahip değil** — yalnız birini ya da ikisini birlikte kurun. İkisi aynı DSH profilinde yüklendiğinde `Symbol.for('zseven.dsh.apple.peer.v1')` üzerinden süreç içinde birbirlerini keşfederler:

- **IDE &amp; derleyici işleri için `dsh-xcode` (`xcode_*`) kullanın** — Swift/ObjC dosyaları düzenlerken `< 1 sn` tek dosya tanılamaları, sıcak artımlı şema derlemeleri ve birim testleri, `.xcodeproj` / `.xcworkspace` SwiftUI `#Preview` anlık görüntüleri ve yerel Apple belge araması.
- **Canlı cihaz çalışma zamanı &amp; UI otomasyonu için `dsh-ios` (`ios_sim_*`) kullanın** — kenar çubuğunda etkileşimli Simülatör ve USB'ye bağlı gerçek iPhone MJPEG video akışı, AXe erişilebilirlik ağaçları (`ios_sim_ui_tree`, `ios_sim_tap_element`, `ios_sim_ui_rows`), Vision OCR bul/dokun (`ios_sim_find_text`, `ios_sim_tap_text`), birleşik çalışma zamanı günlükleri (`ios_sim_logs`), LLDB geri izlemeleri ve `leaks`.
- **Akıllı eklentiler arası yönlendirme** — bir ajan `.xcodeproj` / `.xcworkspace` üzerinde `ios_sim_preview` (SwiftPM dylib sıcak yeniden yükleme) çağırırsa, `dsh-ios` `dsh-xcode`'un bağlı olduğunu algılar ve ajanı doğrudan `xcode_render_preview`'a yönlendirir.

## Güvenlik ve gizlilik

- **Yalnızca yerel XPC taşıması** — `xcrun mcpbridge` yalnızca yerel Xcode sürecinizle macOS XPC üzerinden haberleşir; eklenti hiçbir ağ dinleyicisi açmaz ve sıfır dış HTTP isteği yapar.
- **Ortam temizleme** — `xcrun mcpbridge` veya `xcrun agent` başlatılmadan önce `scrubEnvForMcpBridge`, `*KEY*`, `*SECRET*`, `*TOKEN*`, `*PASSWORD*` veya `DSH_*` ile eşleşen tüm ortam değişkenlerini ayıklar ve yalnızca standart macOS geliştirici/XPC değişkenlerini (`HOME`, `USER`, `PATH`, `TMPDIR`, `DEVELOPER_DIR`, `MCP_XCODE_PID`, `MCP_XCODE_SESSION_ID`) geçirir.
- **Açık Xcode kullanıcı onayı** — dış ajan erişimi, Xcode'un kendi **Settings → Intelligence → Model Context Protocol** anahtarı ile macOS/Xcode izin penceresi aracılığıyla denetlenir.
- **Sınırlı ikili işleme** — MCP görüntü blokları, kod çözülmeden önce kanonik base64 ve katı 20 MB tavanı karşısında doğrulanır; ham JSON yükleri içindeki aşırı büyük base64 dizgileri ayıklanır ki model bağlamı temiz kalsın.

## Gereksinimler

- Üzerinde **Xcode 26.3 veya daha yenisi** kurulu **macOS** (`xcode-select -p`'nin `/Applications/Xcode.app/Contents/Developer` göstermesi gerekir, Command Line Tools değil).
- **DeepSeek Harness** `0.2.1-rc.5` veya daha yenisi, Node.js `>= 24.11.0`.
- **Tek seferlik Xcode ayarı** — **Xcode → Settings → Intelligence → Model Context Protocol**'ü açın ve **Allow External Agents**'ı etkinleştirin (ilk bağlantıda Xcode'un izin istemini onaylayın).

## DSH'ye kurulum

```sh
dsh plugin --profile web add @zseven-w/dsh-xcode@latest
dsh web
```

Xcode IDE araçlarının yanına tam Simülatör + USB iPhone akışı için `dsh-ios` ile eşleştirin:

```sh
dsh plugin --profile web add @zseven-w/dsh-ios@latest
```

## Hızlı başlangıç

1. **Durumu denetleyin &amp; projenizi açın** — *“Xcode durumunu denetle ve bu klasördeki iOS projesini aç.”* → `xcode_status` / `xcode_open_project`. İlk çalıştırmanızsa Xcode'un dış ajan istemini onaylayın.
2. **Tek dosyayı `< 1 sn` içinde düzenleyin &amp; denetleyin** — *“`HomeView.swift` dosyasını yeniden düzenle ve tam derleme çalıştırmadan derleyici hatalarını denetle.”* → `xcode_diagnostics` (`filePath: "Sources/HomeView.swift"`).
3. **SwiftUI `#Preview` işleyin** — *“`HomeView.swift` dosyasının SwiftUI önizlemesini işle ve düzeni denetle.”* → `xcode_render_preview`. İşlenmiş anlık görüntüleri incelemek için sağ kenar çubuğundaki **Xcode Workbench**'i açın.
4. **Apple belgelerini arayın &amp; testleri çalıştırın** — *“Xcode'un yerel belgelerinde `NavigationSplitView` sütun görünürlüğünü ara, sonra birim testlerini çalıştır.”* → `xcode_search_docs` → `xcode_build_test` (`action: "run_all_tests"`).

## Yapılandırma

`cordis.patch.yml` içinde `plugins.dsh-xcode` altındaki isteğe bağlı ayarlar:

| Seçenek | Varsayılan | Anlamı |
| --- | --- | --- |
| `xcodePid` | otomatik çözülür | `Xcode.app` ve `Xcode-beta.app` aynı anda açıksa açıkça çalışan Xcode PID'i (`MCP_XCODE_PID`). |
| `callTimeoutMs` | `180000` | Uzun süren Xcode MCP işlemleri (`BuildProject`, `RunAllTests`, `RenderPreview`) için varsayılan zaman aşımı (ms). |
| `autoSyncSkills` | `true` | `xcode_status` veya `xcode_open_project` bağlandığında Apple'ın yerleşik `SKILL.md` paketlerini otomatik dışa aktar ve kaydet. |
| `skillsCacheDir` | `~/.cache/dsh-xcode/skills` | Dışa aktarılan Apple `SKILL.md` paketlerinin Xcode yapı numarasına göre önbelleklendiği dizin. |

## Sorun giderme

- **`xcrun could not find mcpbridge` / Command Line Tools hatası** — `xcode-select -p`, `/Library/Developer/CommandLineTools`'u ya da 26.3'ten eski bir Xcode'u gösteriyor. Tam Xcode 26.3+'e geçin: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.
- **`Could not establish MCP tool session with Xcode`** — Xcode'ta en az bir proje/çalışma alanı penceresinin açık olduğundan emin olun (`xcode_open_project`), **Xcode → Settings → Intelligence → Model Context Protocol → Allow External Agents**'ı etkinleştirin ve Xcode arka planda bir ajan yetkilendirme penceresi gösteriyorsa **Allow**'a tıklayın.
- **Birden çok Xcode örneği çalışıyor** — `dsh-xcode` otomatik olarak `xcode-select -p` ile eşleşen PID'i seçer; aynı paketin iki kopyası açıksa yapılandırmada `xcodePid` geçirin veya `DSHPLUGIN_XCODE_PID=<pid>` belirleyin.
- **Özel bir hedef yapılandırmasında `#Preview` makrosu başarısız oluyor** — Xcode'un önizleme motoru karmaşık `#Preview` makroları için bazen form faktörünü çıkaramaz; dosyaya standart bir `PreviewProvider` yapısı eklemek `xcode_render_preview` ile güvenle çalışır.

## Geliştirme

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run smoke:pack
```

Yerel bir kopyayı DSH Web profilinize bağlayın:

```sh
dsh plugin --profile web add link:/path/to/dsh-xcode
dsh web
```

| Takım | Kapsadığı konular |
| --- | --- |
| `test/mcp-stdio.test.mjs` | STDIO JSON-RPC el sıkışması, sayfalanmış `tools/list`, Xcode 26'da atlanan `structuredContent` doldurma, kanonik PNG kod çözme, base64 ayıklama, ortam temizleme, hata sınıflandırma. |
| `test/env-and-bridge.test.mjs` | `ps` ile Xcode/Simülatör süreç filtreleme, PID seçim kuralları, `.xcworkspace`/`.xcodeproj`/`Package.swift` keşfi, `tabIdentifier` otomatik çözümü, tanılama/derleme/önizleme durum kalıcılığı, `SKILL.md` dışa aktarımı ve Host `apply()` yaşam döngüsü. |
| `test/client-bundle.test.mjs` | `window.__ModuleLoader__.load` paket biçimi, dışsallaştırılmış ana makine React değişmezi, `zh`/`en` yerel eşliği, Workbench kaynak adresi kodlaması, yuva ve sekme kaydı. |
| `test/ios-peer-linkage.test.mjs` | `@zseven-w/dsh-ios` ile canlı eklentiler arası `Symbol.for('zseven.dsh.apple.peer.v1')` keşfi ve `.xcodeproj` → `xcode_render_preview` akıllı yönlendirmesi. |

## Ekosistem

- [DSH iOS Simulator](https://github.com/ZSeven-W/dsh-ios) — canlı etkileşimli iOS Simülatörü &amp; USB'ye bağlı gerçek iPhone akışı, AXe UI ağaçları, Vision OCR ve SwiftPM önizleme sıcak yeniden yüklemesi
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — sohbet içinde canlı Android emülatörü veya USB cihazı, tamamen `adb` üzerinden yönetilir
- [DSH Computer](https://github.com/ZSeven-W/dsh-computer) — AX öncelikli gözlemler ve ana makine onayı ile başsız öncelikli macOS Computer Use sürücüsü
- [DSH Browser](https://github.com/ZSeven-W/dsh-browser) — anlamsal referanslar ve sınırlı kanıtlarla yalıtılmış Chromium oturumları
- [DSH QA](https://github.com/ZSeven-W/dsh-qa) — Browser, Masaüstü, iOS &amp; Android genelinde ajan öncüllü keşif ve deterministik senaryo yeniden oynatma
- [DSH Game Studio](https://github.com/ZSeven-W/dsh-game-studio) — bir 2D ya da 3D voksel oyunu tek cümleyle tarif edin, kenar çubuğunda oynayın, yapay zekâ görselleriyle değiştirin ve tek tıkla yayınlayın
- [DSH Harbor](https://github.com/ZSeven-W/dsh-harbor) — kurulu eklentiler için yetenek envanteri, çakışma algılama ve DSH yükseltme ön denetimi
- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — Claude Code / Codex'ten DSH ajanlarına yerel alt ajanlar olarak iş gönderin
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — DSH için kalıcı, incelenebilir uzun vadeli ajan belleği
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — DSH sohbetleri içinde `.op` OpenPencil tasarım belgelerini önizleyin, inceleyin ve düzenleyin

## Lisans

MIT © ZSeven-W
