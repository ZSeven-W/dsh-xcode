<p align="center">
  <img src="./docs/images/dsh-xcode-logo.png" alt="DSH Xcode" width="120" />
</p>

<h1 align="center">DSH Xcode</h1>

<p align="center">
  <strong><a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> वार्तालाप के भीतर Apple का आधिकारिक Xcode MCP ब्रिज (<code>xcrun mcpbridge</code>) और बिल्ट-इन Apple Skills — <a href="https://github.com/ZSeven-W/dsh-ios">DSH iOS</a> के साथ सहज जुड़ाव के साथ।</strong><br />
  <sub>8 एजेंट टूल्स &bull; &lt; 1 सेकंड में सिंगल-फ़ाइल कंपाइलर डायग्नोस्टिक्स &bull; नेटिव SwiftUI <code>#Preview</code> स्नैपशॉट्स &bull; वॉर्म स्कीम बिल्ड &amp; टेस्ट &bull; लोकल Apple डॉक्स सर्च &bull; राइट-साइडबार वर्कबेंच</sub>
</p>

<p align="center">
  <sub>पैकेज: <code>@zseven-w/dsh-xcode</code> &middot; वर्तमान प्लगइन रिलीज़: <code>0.1.0-rc.4</code> &middot; DSH <code>0.2.1-rc.5</code> के साथ परीक्षित</sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <b>हिन्दी</b> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-xcode/actions/workflows/check.yml"><img src="https://img.shields.io/github/actions/workflow/status/ZSeven-W/dsh-xcode/check.yml?label=CI" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@zseven-w/dsh-xcode"><img src="https://img.shields.io/npm/v/@zseven-w/dsh-xcode?color=1a78f2" alt="npm" /></a>
  <a href="https://github.com/ZSeven-W/dsh-xcode/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-xcode?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-xcode-banner.png" alt="DSH Xcode — DeepSeek Harness के अंदर आधिकारिक Xcode MCP ब्रिज और Apple Skills" width="100%" />
</p>

## DSH Xcode क्यों

Xcode 26.3 से शुरू होकर Apple, लोकल XPC पर चलने वाला आधिकारिक Model Context Protocol ब्रिज (`xcrun mcpbridge`) और फ़र्स्ट-पार्टी `SKILL.md` एजेंट बंडल्स (`xcrun agent skills export`) शिप करता है। हालाँकि, रॉ `xcrun mcpbridge` को किसी जेनरिक कोडिंग एजेंट से सीधे जोड़ने पर तीन व्यावहारिक दीवारें आती हैं:

1. **Xcode 26 `structuredContent` बेमेल** — `XcodeListWindows` जैसे टूल `tools/list` में `outputSchema` तो घोषित करते हैं, लेकिन जवाब में JSON को `content[0].text` के अंदर लौटाते हैं और `structuredContent` छोड़ देते हैं, जिसके चलते सख़्त MCP SDK क्लाइंट वैध रिस्पॉन्स को ठुकरा देते हैं।
2. **प्रोसेस लाइफ़साइकिल और मल्टी-Xcode PID राउटिंग** — Xcode बंद होने पर, `Xcode.app` और `Xcode-beta.app` दोनों एक साथ चल रहे होने पर, या **Xcode → Settings → Intelligence** में एक्सटर्नल एजेंट एक्सेस चालू होने से पहले `mcpbridge` तुरंत एग्ज़िट हो जाता है।
3. **कॉन्टेक्स्ट ब्लोट** — Xcode लगभग 20+ बारीक (granular) टूल एक्सपोज़ करता है और `RenderPreview` से मल्टी-मेगाबाइट base64 PNG स्ट्रिंग्स निकलती हैं।

`DSH Xcode`, Apple के आधिकारिक ब्रिज को एक ज़ीरो-डिपेंडेंसी नेटिव DeepSeek Harness प्लगइन में लपेटता है — साथ में इंटीग्रेटेड राइट-साइडबार वर्कबेंच और [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios) के साथ ज़ीरो-कपलिंग पीयर डिस्कवरी।

| | |
| --- | --- |
| ⚡ **&lt; 1 सेकंड में सिंगल-फ़ाइल डायग्नोस्टिक्स** | `filePath` के साथ `xcode_diagnostics`, Xcode के लाइव कंपाइलर ग्राफ़ पर `XcodeRefreshCodeIssuesInFile` कॉल करता है — बिना ठंडे `xcodebuild` रन स्पॉन किए Swift/ObjC बदलावों की एक सेकंड से कम समय में जाँच। |
| 🖼️ **नेटिव SwiftUI `#Preview` स्नैपशॉट्स** | `xcode_render_preview`, `.xcodeproj`, `.xcworkspace` और Swift पैकेजेज़ में Xcode के अपने `RenderPreview` इंजन को चलाता है, PNGs को `.dsh-xcode/previews/` में लिखता है, और मल्टीमॉडल मॉडल सक्रिय होने पर इमेज सीधे अटैच करता है। |
| 🔨 **वॉर्म इंक्रीमेंटल बिल्ड &amp; टेस्ट** | `xcode_build_test`, `BuildProject`, `GetBuildLog`, `GetTestList`, `RunAllTests` और `RunSomeTests` (XCTest &amp; Swift Testing) के लिए Xcode का वॉर्म DerivedData बिल्ड ग्राफ़ दोबारा इस्तेमाल करता है। |
| 🔧 **Xcode 26 वायर नॉर्मलाइज़ेशन** | छूटे हुए `structuredContent` को JSON टेक्स्ट ब्लॉक्स से अपने-आप भरता (hydrate) है, कई खुले वर्कस्पेस विंडोज़ के बीच `tabIdentifier` रिज़ॉल्व करता है, और JSON समरीज़ से ज़्यादा बड़ी base64 स्ट्रिंग्स हटा देता है। |
| 📘 **Apple का आधिकारिक `SKILL.md` सिंक** | `xcrun agent skills export` चलाता है, आपके Xcode बिल्ड के लिए Apple के बिल्ट-इन `SKILL.md` बंडल्स पार्स करता है, उन्हें `~/.cache/dsh-xcode/skills/` में कैश करता है, और उन्हें `ctx.skills` में डायनामिकली रजिस्टर करता है। |
| 🪟 **राइट-साइडबार Xcode वर्कबेंच** | लाइव कनेक्शन स्टेटस पिल, खुले वर्कस्पेस की `tabIdentifier` विंडोज़, कंपाइलर डायग्नोस्टिक्स लिस्ट, बिल्ड/टेस्ट समरी, रेंडर किए SwiftUI `#Preview` की गैलरी, और `dsh-ios` पीयर डिवाइस स्टेटस। |
| 📱 **`dsh-ios` के साथ जोड़ी** | `Symbol.for('zseven.dsh.apple.peer.v1')` के ज़रिए ज़ीरो इंस्टॉल-टाइम कपलिंग: `dsh-xcode` IDE कंपाइलर इंटेलिजेंस संभालता है जबकि `dsh-ios` लाइव सिम्युलेटर और USB से जुड़े iPhone को स्ट्रीम व चलाता है। |
| 🧭 **फ़्यूचर-प्रूफ एस्केप हैच** | `xcode_call_tool` किसी भी रॉ `mcpbridge` टूल (`ExecuteSnippet`, `XcodeUpdate`, `XcodeGlob` या Xcode 27+ के `DeviceInteraction*`) को प्लगइन अपडेट का इंतज़ार किए बिना लिस्ट और इनवोक करता है। |

## टूल्स

सभी 8 टूल हर होस्ट पर रजिस्टर होते हैं, छोड़े जाने पर एक्टिव वर्कस्पेस से `tabIdentifier` को अपने-आप रिज़ॉल्व करते हैं, और नॉन-macOS होस्ट्स पर या Xcode बंद होने पर कार्रवाई-योग्य सेटअप निर्देशों के साथ डिग्रेड होते हैं।

| टूल | यह क्या करता है | मुख्य पैरामीटर्स |
| --- | --- | --- |
| `xcode_status` | एक्टिव `xcode-select` डेवलपर डायरेक्टरी, Xcode वर्ज़न/बिल्ड, `xcrun mcpbridge` &amp; `agent` क्षमताएँ, चल रहे `Xcode.app` PID, खुले वर्कस्पेस विंडोज़ (`tabIdentifier`s), सिंक किए Apple स्किल्स, और `dsh-ios` पीयर स्टेटस की जाँच करता है। | `connect` (डिफ़ॉल्ट `true`) |
| `xcode_open_project` | `.xcworkspace`, `.xcodeproj` या `Package.swift` को Xcode में अपने-आप पहचानकर खोलता है (`open -a Xcode`), फिर `mcpbridge` कनेक्ट होने और विंडो का `tabIdentifier` मिलने तक पोल करता है। | `projectPath` (वैकल्पिक), `waitSeconds` (डिफ़ॉल्ट `20`) |
| `xcode_diagnostics` | Xcode से लाइव कंपाइलर एरर और वॉर्निंग्स पढ़ता है। `< 1 s` सिंगल-फ़ाइल टाइपचेकिंग के लिए `filePath` दें (`XcodeRefreshCodeIssuesInFile`), या वर्कस्पेस-व्यापी Issue Navigator डायग्नोस्टिक्स के लिए `filePath` छोड़ दें (`XcodeListNavigatorIssues`)। | `filePath`, `projectPath`, `tabIdentifier`, `severity` (`error`/`warning`/`remark`), `pattern` |
| `xcode_build_test` | एक्टिव स्कीम बिल्ड करता है, फ़िल्टर किए बिल्ड लॉग्स देखता है, या Xcode के वॉर्म बिल्ड ग्राफ़ में XCTest &amp; Swift Testing सूट्स लिस्ट/रन करता है। | `action` (आवश्यक — `build`/`build_log`/`list_tests`/`run_all_tests`/`run_some_tests`), `tests` (JSON ऐरे), `severity`, `pattern` |
| `xcode_render_preview` | SwiftUI `#Preview` या `PreviewProvider` स्नैपशॉट Xcode में नेटिव रूप से रेंडर करता है, PNG को वर्कबेंच गैलरी के लिए `.dsh-xcode/previews/` में सेव करता है, और उसे मल्टीमॉडल मॉडल कॉन्टेक्स्ट में अटैच करता है। | `sourceFilePath` (आवश्यक), `previewDefinitionIndexInFile` (डिफ़ॉल्ट `0`), `projectPath`, `tabIdentifier` |
| `xcode_search_docs` | Xcode के बिल्ट-इन Apple Developer Documentation और WWDC सेशन ट्रांसक्रिप्ट्स में सिमेंटिक सर्च (`DocumentationSearch`)। | `query` (आवश्यक), `frameworks` (वैकल्पिक कॉमा-सेपरेटेड लिस्ट, जैसे `"SwiftUI,Observation"`) |
| `xcode_sync_skills` | एक्टिव Xcode ऐप से `xcrun agent skills export` के ज़रिए Apple के आधिकारिक `SKILL.md` बंडल्स एक्सपोर्ट करता है और मौजूदा DSH सेशन में रजिस्टर करता है। | — |
| `xcode_call_tool` | आपके Xcode वर्ज़न के सारे रॉ MCP टूल्स लिस्ट करता है (`action: "list"`) या किसी रॉ टूल को सीधे इनवोक करता है (`action: "call"`)। | `action` (आवश्यक — `list`/`call`), `toolName`, `argumentsJson` |

## डिस्प्ले सरफ़ेसेज़

- **राइट-साइडबार पैनल — “Xcode Workbench”।** किसी भी टूल रो के **Open Workbench** बटन से या राइट-साइडबार **`+`** लॉन्चर (**Xcode Workbench**) से खुलता है। लाइव Xcode कनेक्शन बैज + PID, Xcode वर्ज़न/बिल्ड, `dsh-ios` लाइव डिवाइस लिंक, खुले वर्कस्पेस विंडोज़ (`tabIdentifier`s), फ़ाइल/लाइन बैज के साथ नवीनतम कंपाइलर डायग्नोस्टिक्स, नवीनतम बिल्ड/टेस्ट नतीजा, रेंडर किए SwiftUI `#Preview` थंबनेल्स, सिंक किए Apple Skills, और माउंटेड MCP टूल्स दिखाता है। टूलबार बटन (**Refresh**, **Open Project**, **Diagnostics**, **Build Scheme**, **Sync Apple Skills**) मॉडल टोकन खर्च किए बिना `/xcode` सेशन कमांड से चलते हैं।
- **कॉम्पैक्ट कन्वर्सेशन कार्ड्स।** टूल कॉल्स (`xcode_status`, `xcode_open_project`, `xcode_diagnostics`, `xcode_build_test`, `xcode_render_preview`, `xcode_sync_skills`) कॉम्पैक्ट लोकलाइज़्ड रोज़ (`zh` / `en`) रेंडर करते हैं जो कॉल पूरा होने पर खुले वर्कबेंच टैब्स को अपने-आप रिफ़्रेश करते हैं।

## DSH iOS (`@zseven-w/dsh-ios`) के साथ जोड़ी

`dsh-xcode` और [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios) एक-दूसरे पर **कोई हार्ड डिपेंडेंसी नहीं** रखते — कोई भी अकेले या दोनों साथ इंस्टॉल करें। जब दोनों एक ही DSH प्रोफ़ाइल में लोड होते हैं, तो वे `Symbol.for('zseven.dsh.apple.peer.v1')` के ज़रिए इन-प्रोसेस एक-दूसरे को खोज लेते हैं:

- **IDE और कंपाइलर काम के लिए `dsh-xcode` (`xcode_*`) इस्तेमाल करें** — Swift/ObjC फ़ाइलों के एडिट के दौरान `< 1 s` सिंगल-फ़ाइल डायग्नोस्टिक्स, वॉर्म इंक्रीमेंटल स्कीम बिल्ड और यूनिट टेस्ट, `.xcodeproj` / `.xcworkspace` SwiftUI `#Preview` स्नैपशॉट्स, और लोकल Apple डॉक्यूमेंटेशन लुकअप।
- **लाइव डिवाइस रनटाइम और UI ऑटोमेशन के लिए `dsh-ios` (`ios_sim_*`) इस्तेमाल करें** — साइडबार में इंटरैक्टिव सिम्युलेटर और USB-कनेक्टेड असली iPhone की MJPEG वीडियो स्ट्रीमिंग, AXe एक्सेसिबिलिटी ट्रीज़ (`ios_sim_ui_tree`, `ios_sim_tap_element`, `ios_sim_ui_rows`), Vision OCR खोज/टैप (`ios_sim_find_text`, `ios_sim_tap_text`), यूनिफ़ाइड रनटाइम लॉग्स (`ios_sim_logs`), LLDB बैकट्रेसेज़, और `leaks`।
- **स्मार्ट क्रॉस-प्लगइन राउटिंग** — अगर एजेंट किसी `.xcodeproj` / `.xcworkspace` पर `ios_sim_preview` (SwiftPM dylib हॉट-रीलोड) कॉल करे, तो `dsh-ios` पहचानता है कि `dsh-xcode` माउंटेड है और एजेंट को सीधे `xcode_render_preview` की ओर भेजता है।

## सुरक्षा और गोपनीयता

- **केवल लोकल XPC ट्रांसपोर्ट** — `xcrun mcpbridge` आपके लोकल Xcode प्रोसेस से विशेष रूप से macOS XPC पर बात करता है; प्लगइन कोई नेटवर्क लिसनर नहीं खोलता और शून्य एक्सटर्नल HTTP रिक्वेस्ट करता है।
- **एनवायरनमेंट स्क्रबिंग** — `xcrun mcpbridge` या `xcrun agent` स्पॉन करने से पहले, `scrubEnvForMcpBridge` `*KEY*`, `*SECRET*`, `*TOKEN*`, `*PASSWORD*` या `DSH_*` से मैच होने वाले हर एनवायरनमेंट वेरिएबल को हटा देता है और केवल स्टैंडर्ड macOS डेवलपर/XPC वेरिएबल्स (`HOME`, `USER`, `PATH`, `TMPDIR`, `DEVELOPER_DIR`, `MCP_XCODE_PID`, `MCP_XCODE_SESSION_ID`) पास करता है।
- **Xcode यूज़र की स्पष्ट सहमति** — एक्सटर्नल एजेंट एक्सेस Xcode के अपने **Settings → Intelligence → Model Context Protocol** टॉगल और macOS/Xcode परमिशन डायलॉग से नियंत्रित होता है।
- **सीमाबद्ध बाइनरी हैंडलिंग** — MCP इमेज ब्लॉक्स को डिकोड होने से पहले कैनोनिकल base64 और सख़्त 20 MB सीमा के ख़िलाफ़ जाँचा जाता है; रॉ JSON पेलोड्स के अंदर की ज़्यादा बड़ी base64 स्ट्रिंग्स हटा दी जाती हैं ताकि मॉडल कॉन्टेक्स्ट साफ़ रहे।

## आवश्यकताएँ

- **macOS** जिसमें **Xcode 26.3 या बाद का** इंस्टॉल हो (`xcode-select -p` का इशारा `/Applications/Xcode.app/Contents/Developer` की ओर हो, Command Line Tools की ओर नहीं)।
- **DeepSeek Harness** `0.2.1-rc.5` या बाद का, Node.js `>= 24.11.0`।
- **एक बार की Xcode सेटिंग** — **Xcode → Settings → Intelligence → Model Context Protocol** खोलें और **Allow External Agents** चालू करें (पहले कनेक्शन पर Xcode का परमिशन प्रॉम्प्ट मंज़ूर करें)।

## DSH में इंस्टॉल करें

```sh
dsh plugin --profile web add @zseven-w/dsh-xcode@latest
dsh web
```

Xcode IDE टूल्स के साथ पूरी सिम्युलेटर + USB iPhone स्ट्रीमिंग पाने के लिए `dsh-ios` को जोड़ें:

```sh
dsh plugin --profile web add @zseven-w/dsh-ios@latest
```

## त्वरित शुरुआत

1. **स्टेटस जाँचें और प्रोजेक्ट खोलें** — *“Xcode की स्थिति जाँचो और इस फ़ोल्डर का iOS प्रोजेक्ट खोलो।”* → `xcode_status` / `xcode_open_project`। पहली बार चलाने पर Xcode का एक्सटर्नल एजेंट प्रॉम्प्ट मंज़ूर करें।
2. **एक फ़ाइल को `< 1 s` में एडिट और जाँचें** — *“`HomeView.swift` रिफ़ैक्टर करो और पूरा बिल्ड चलाए बिना कंपाइलर एरर जाँचो।”* → `xcode_diagnostics` (`filePath: "Sources/HomeView.swift"`)।
3. **SwiftUI `#Preview` रेंडर करें** — *“`HomeView.swift` का SwiftUI प्रीव्यू रेंडर करो और लेआउट देखो।”* → `xcode_render_preview`। रेंडर किए स्नैपशॉट देखने के लिए राइट साइडबार में **Xcode Workbench** खोलें।
4. **Apple डॉक्स खोजें और टेस्ट चलाएँ** — *“Xcode के लोकल डॉक्स में `NavigationSplitView` का कॉलम विज़िबिलिटी ढूँढो, फिर यूनिट टेस्ट चलाओ।”* → `xcode_search_docs` → `xcode_build_test` (`action: "run_all_tests"`)।

## कॉन्फ़िगरेशन

`cordis.patch.yml` में `plugins.dsh-xcode` के अंतर्गत वैकल्पिक सेटिंग्स:

| विकल्प | डिफ़ॉल्ट | अर्थ |
| --- | --- | --- |
| `xcodePid` | अपने-आप रिज़ॉल्व | `Xcode.app` और `Xcode-beta.app` दोनों एक साथ खुले होने पर स्पष्ट रूप से चल रहे Xcode का PID (`MCP_XCODE_PID`)। |
| `callTimeoutMs` | `180000` | लंबे चलने वाले Xcode MCP ऑपरेशन्स (`BuildProject`, `RunAllTests`, `RenderPreview`) के लिए डिफ़ॉल्ट टाइमआउट (ms)। |
| `autoSyncSkills` | `true` | `xcode_status` या `xcode_open_project` कनेक्ट होने पर Apple के बिल्ट-इन `SKILL.md` बंडल्स अपने-आप एक्सपोर्ट और रजिस्टर करें। |
| `skillsCacheDir` | `~/.cache/dsh-xcode/skills` | एक्सपोर्ट किए Apple `SKILL.md` बंडल्स को Xcode बिल्ड नंबर के हिसाब से कैश करने वाली डायरेक्टरी। |

## समस्या निवारण

- **`xcrun could not find mcpbridge` / Command Line Tools एरर** — `xcode-select -p` का इशारा `/Library/Developer/CommandLineTools` या 26.3 से पुराने Xcode की ओर है। पूरे Xcode 26.3+ पर स्विच करें: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`।
- **`Could not establish MCP tool session with Xcode`** — सुनिश्चित करें कि Xcode में कम से कम एक प्रोजेक्ट/वर्कस्पेस विंडो खुली हो (`xcode_open_project`), **Xcode → Settings → Intelligence → Model Context Protocol → Allow External Agents** चालू करें, और अगर Xcode बैकग्राउंड में एजेंट ऑथराइज़ेशन डायलॉग दिखा रहा हो तो **Allow** दबाएँ।
- **एक साथ कई Xcode इंस्टेंस चल रहे हैं** — `dsh-xcode` अपने-आप `xcode-select -p` से मैच होने वाला PID चुनता है; अगर एक ही बंडल की दो कॉपियाँ खुली हैं, तो कॉन्फ़िग में `xcodePid` पास करें या `DSHPLUGIN_XCODE_PID=<pid>` सेट करें।
- **कस्टम टारगेट कॉन्फ़िगरेशन पर `#Preview` मैक्रो फेल** — Xcode का प्रीव्यू इंजन कभी-कभी जटिल `#Preview` मैक्रोज़ के लिए फ़ॉर्म फ़ैक्टर इन्फ़र नहीं पाता; फ़ाइल में एक स्टैंडर्ड `PreviewProvider` स्ट्रक्ट जोड़ना `xcode_render_preview` के साथ भरोसेमंद काम करता है।

## डेवलपमेंट

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run smoke:pack
```

लोकल चेकआउट को अपने DSH Web प्रोफ़ाइल से लिंक करें:

```sh
dsh plugin --profile web add link:/path/to/dsh-xcode
dsh web
```

| सूट | यह क्या कवर करता है |
| --- | --- |
| `test/mcp-stdio.test.mjs` | STDIO JSON-RPC हैंडशेक, पेजिनेटेड `tools/list`, Xcode 26 में छूटे `structuredContent` की हाइड्रेशन, कैनोनिकल PNG डिकोडिंग, base64 स्ट्रिपिंग, एनवायरनमेंट स्क्रबिंग, एरर क्लासिफ़िकेशन। |
| `test/env-and-bridge.test.mjs` | `ps` में Xcode बनाम सिम्युलेटर प्रोसेस फ़िल्टरिंग, PID चयन नियम, `.xcworkspace`/`.xcodeproj`/`Package.swift` डिस्कवरी, `tabIdentifier` ऑटो-रिज़ॉल्यूशन, डायग्नोस्टिक्स/बिल्ड/प्रीव्यू स्टेट परसिस्टेंस, `SKILL.md` एक्सपोर्ट और Host `apply()` लाइफ़साइकिल। |
| `test/client-bundle.test.mjs` | `window.__ModuleLoader__.load` बंडल शेप, एक्सटर्नलाइज़्ड होस्ट React इनवेरिएंट, `zh`/`en` लोकेल पैरिटी, वर्कबेंच रिसोर्स एड्रेस एन्कोडिंग, स्लॉट और टैब रजिस्ट्रेशन। |
| `test/ios-peer-linkage.test.mjs` | `@zseven-w/dsh-ios` के साथ लाइव क्रॉस-प्लगइन `Symbol.for('zseven.dsh.apple.peer.v1')` डिस्कवरी और `.xcodeproj` → `xcode_render_preview` स्मार्ट राउटिंग। |

## इकोसिस्टम

- [DSH iOS Simulator](https://github.com/ZSeven-W/dsh-ios) — लाइव इंटरैक्टिव iOS सिम्युलेटर &amp; USB-कनेक्टेड असली iPhone स्ट्रीमिंग, AXe UI ट्रीज़, Vision OCR, और SwiftPM प्रीव्यू हॉट रीलोड
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — बातचीत के अंदर लाइव Android एमुलेटर या USB डिवाइस, पूरी तरह `adb` से चालित
- [DSH Computer](https://github.com/ZSeven-W/dsh-computer) — AX-फ़र्स्ट ऑब्ज़र्वेशन और होस्ट-ओनड अप्रूवल के साथ हेडलेस-फ़र्स्ट macOS Computer Use ड्राइवर
- [DSH Browser](https://github.com/ZSeven-W/dsh-browser) — सिमेंटिक रेफ़रेंस और सीमित एविडेंस के साथ आइसोलेटेड Chromium सेशन्स
- [DSH QA](https://github.com/ZSeven-W/dsh-qa) — Browser, Desktop, iOS और Android में एजेंट-नेतृत्व एक्सप्लोरेशन और डिटरमिनिस्टिक सीनारियो रीप्ले
- [DSH Game Studio](https://github.com/ZSeven-W/dsh-game-studio) — एक वाक्य में 2D या 3D वॉक्सेल गेम बताएँ, उसे साइडबार में खेलें, AI आर्ट लगाएँ, और एक क्लिक में पब्लिश करें
- [DSH Harbor](https://github.com/ZSeven-W/dsh-harbor) — इंस्टॉल किए प्लगइन्स के लिए क्षमता इन्वेंटरी, कॉन्फ़्लिक्ट डिटेक्शन, और DSH अपग्रेड प्रीफ़्लाइट
- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — Claude Code / Codex से DSH एजेंट्स को नेटिव सबएजेंट की तरह काम भेजें
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — DSH के लिए टिकाऊ, जाँचने-योग्य दीर्घकालिक एजेंट मेमोरी
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — DSH बातचीत के अंदर `.op` OpenPencil डिज़ाइन डॉक्यूमेंट्स का प्रीव्यू, निरीक्षण और संपादन

## लाइसेंस

MIT © ZSeven-W
