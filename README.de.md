<p align="center">
  <img src="./docs/images/dsh-xcode-logo.png" alt="DSH Xcode" width="120" />
</p>

<h1 align="center">DSH Xcode</h1>

<p align="center">
  <strong>Apples offizielle Xcode-MCP-Bridge (<code>xcrun mcpbridge</code>) und eingebaute Apple-Skills innerhalb einer <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>-Konversation — nahtlos gekoppelt mit <a href="https://github.com/ZSeven-W/dsh-ios">DSH iOS</a>.</strong><br />
  <sub>8 Agent-Tools &bull; Compiler-Diagnose einzelner Dateien in &lt; 1 s &bull; native SwiftUI-<code>#Preview</code>-Schnappschüsse &bull; warme Schema-Builds &amp; Tests &bull; lokale Apple-Dokumentationssuche &bull; Workbench in der rechten Seitenleiste</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-xcode</code> &middot; Aktuelles Plugin-Release: <code>0.1.0-rc.2</code> &middot; Getestet mit DSH <code>0.2.1-rc.5</code></sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <b>Deutsch</b> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-xcode/actions/workflows/check.yml"><img src="https://img.shields.io/github/actions/workflow/status/ZSeven-W/dsh-xcode/check.yml?label=CI" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@zseven-w/dsh-xcode"><img src="https://img.shields.io/npm/v/@zseven-w/dsh-xcode?color=1a78f2" alt="npm" /></a>
  <a href="https://github.com/ZSeven-W/dsh-xcode/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-xcode?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-xcode-banner.png" alt="DSH Xcode — Offizielle Xcode-MCP-Bridge &amp; Apple-Skills innerhalb von DeepSeek Harness" width="100%" />
</p>

## Warum DSH Xcode

Ab Xcode 26.3 liefert Apple eine offizielle Model-Context-Protocol-Bridge (`xcrun mcpbridge`) über lokales XPC sowie eigene `SKILL.md`-Agent-Bundles (`xcrun agent skills export`). Wer `xcrun mcpbridge` roh direkt in einen generischen Coding-Agenten einhängt, stößt allerdings auf drei praktische Mauern:

1. **`structuredContent`-Abweichung in Xcode 26** — Tools wie `XcodeListWindows` deklarieren ein `outputSchema` in `tools/list`, liefern das JSON aber in `content[0].text` zurück und lassen `structuredContent` weg, wodurch strenge MCP-SDK-Clients gültige Antworten verwerfen.
2. **Prozesslebenszyklus &amp; Multi-Xcode-PID-Routing** — `mcpbridge` beendet sich sofort, wenn Xcode geschlossen wird, wenn `Xcode.app` und `Xcode-beta.app` gleichzeitig laufen oder bevor der externe Agentenzugriff unter **Xcode → Settings → Intelligence** aktiviert ist.
3. **Aufgeblähter Kontext** — Xcode legt über 20 feingranulare Tools offen und stößt mehrmegabytelange Base64-PNG-Strings aus `RenderPreview` aus.

`DSH Xcode` verpackt Apples offizielle Bridge in ein natives DeepSeek-Harness-Plugin ohne Abhängigkeiten, mit integriertem Workbench in der rechten Seitenleiste und kopplungsfreier Peer-Erkennung neben [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios).

| | |
| --- | --- |
| ⚡ **Diagnose einzelner Dateien in &lt; 1 s** | `xcode_diagnostics` mit `filePath` ruft `XcodeRefreshCodeIssuesInFile` gegen Xcodes lebenden Compiler-Graphen auf — prüft Swift-/ObjC-Änderungen in unter einer Sekunde, ohne kalte `xcodebuild`-Läufe zu starten. |
| 🖼️ **Native SwiftUI-`#Preview`-Schnappschüsse** | `xcode_render_preview` steuert Xcodes eigene `RenderPreview`-Engine über `.xcodeproj`, `.xcworkspace` und Swift-Pakete hinweg, schreibt PNGs nach `.dsh-xcode/previews/` und hängt Bilder direkt an, wenn multimodale Modelle aktiv sind. |
| 🔨 **Warme inkrementelle Builds &amp; Tests** | `xcode_build_test` verwertet Xcodes warmen DerivedData-Build-Graphen für `BuildProject`, `GetBuildLog`, `GetTestList`, `RunAllTests` und `RunSomeTests` (XCTest &amp; Swift Testing). |
| 🔧 **Wire-Normalisierung für Xcode 26** | Hydriert weggelassenes `structuredContent` automatisch aus JSON-Textblöcken, löst das `tabIdentifier` über mehrere offene Workspace-Fenster hinweg und entfernt übergroße Base64-Strings aus JSON-Zusammenfassungen. |
| 📘 **Offizielle Apple-`SKILL.md`-Synchronisierung** | Führt `xcrun agent skills export` aus, parst Apples eingebaute `SKILL.md`-Bundles für exakt dein Xcode-Build, cacht sie unter `~/.cache/dsh-xcode/skills/` und registriert sie dynamisch in `ctx.skills`. |
| 🪟 **Xcode-Workbench in der rechten Seitenleiste** | Live-Badge des Verbindungsstatus, offene Workspace-Fenster mit ihren `tabIdentifier`s, Liste der Compiler-Diagnosen, Build-/Test-Zusammenfassung, Galerie gerenderter SwiftUI-`#Preview`s und Status des `dsh-ios`-Peer-Geräts. |
| 📱 **Gekoppelt mit `dsh-ios`** | Null Kopplung zur Installationszeit über `Symbol.for('zseven.dsh.apple.peer.v1')`: `dsh-xcode` übernimmt die IDE-Compiler-Intelligenz, während `dsh-ios` live Simulatoren &amp; per USB angeschlossene iPhones streamt und steuert. |
| 🧭 **Zukunftssichere Ausstiegsluke** | `xcode_call_tool` listet und ruft jedes rohe `mcpbridge`-Tool auf (`ExecuteSnippet`, `XcodeUpdate`, `XcodeGlob` oder Xcode-27+-`DeviceInteraction*`), ohne auf ein Plugin-Update warten zu müssen. |

## Tools

Alle 8 Tools registrieren sich auf jedem Host, lösen das `tabIdentifier` automatisch aus dem aktiven Workspace auf, wenn es weggelassen wird, und greifen mit umsetzbaren Einrichtungshinweisen auf ein Degradationsverhalten zurück, wenn der Host kein macOS ist oder Xcode geschlossen ist.

| Tool | Was es tut | Zentrale Parameter |
| --- | --- | --- |
| `xcode_status` | Inspiziert das aktive `xcode-select`-Entwicklerverzeichnis, Xcode-Version/-Build, `xcrun mcpbridge`- &amp; `agent`-Fähigkeiten, laufende `Xcode.app`-PIDs, offene Workspace-Fenster (`tabIdentifier`s), synchronisierte Apple-Skills und den Peer-Status von `dsh-ios`. | `connect` (Standard `true`) |
| `xcode_open_project` | Erkennt und öffnet automatisch ein `.xcworkspace`, ein `.xcodeproj` oder eine `Package.swift` in Xcode (`open -a Xcode`) und pollt anschließend, bis `mcpbridge` verbunden ist und das `tabIdentifier` des Fensters meldet. | `projectPath` (optional), `waitSeconds` (Standard `20`) |
| `xcode_diagnostics` | Liest Live-Compiler-Fehler und -Warnungen aus Xcode. Übergib `filePath` für die Typprüfung einzelner Dateien in `< 1 s` (`XcodeRefreshCodeIssuesInFile`), oder lass es weg für Workspace-weite Diagnosen des Issue Navigators (`XcodeListNavigatorIssues`). | `filePath`, `projectPath`, `tabIdentifier`, `severity` (`error`/`warning`/`remark`), `pattern` |
| `xcode_build_test` | Baut das aktive Schema, inspiziert gefilterte Build-Logs oder listet/führt XCTest- &amp; Swift-Testing-Suiten innerhalb von Xcodes warmem Build-Graphen aus. | `action` (erforderlich — `build`/`build_log`/`list_tests`/`run_all_tests`/`run_some_tests`), `tests` (JSON-Array), `severity`, `pattern` |
| `xcode_render_preview` | Rendert nativ in Xcode einen SwiftUI-`#Preview`- oder `PreviewProvider`-Schnappschuss, speichert das PNG unter `.dsh-xcode/previews/` für die Workbench-Galerie und hängt es an den Kontext multimodaler Modelle an. | `sourceFilePath` (erforderlich), `previewDefinitionIndexInFile` (Standard `0`), `projectPath`, `tabIdentifier` |
| `xcode_search_docs` | Semantische Suche über die in Xcode eingebaute Apple-Developer-Dokumentation und WWDC-Sitzungstranskripte (`DocumentationSearch`). | `query` (erforderlich), `frameworks` (optionale kommagetrennte Liste, z. B. `"SwiftUI,Observation"`) |
| `xcode_sync_skills` | Exportiert Apples offizielle `SKILL.md`-Bundles aus der aktiven Xcode-App über `xcrun agent skills export` und registriert sie in der aktuellen DSH-Session. | — |
| `xcode_call_tool` | Listet alle rohen MCP-Tools deiner Xcode-Version auf (`action: "list"`) oder ruft jedes rohe Tool direkt auf (`action: "call"`). | `action` (erforderlich — `list`/`call`), `toolName`, `argumentsJson` |

## Anzeigeoberflächen

- **Panel in der rechten Seitenleiste — „Xcode Workbench“.** Öffnet sich über die Schaltfläche **Open Workbench** in jeder Tool-Zeile oder über den **`+`**-Launcher der rechten Seitenleiste (**Xcode Workbench**). Zeigt das Live-Badge der Xcode-Verbindung + PID, Xcode-Version/-Build, den Live-Geräte-Link von `dsh-ios`, offene Workspace-Fenster (`tabIdentifier`s), die neuesten Compiler-Diagnosen mit Datei-/Zeilen-Badges, das neueste Build-/Test-Ergebnis, Miniaturen gerenderter SwiftUI-`#Preview`s, synchronisierte Apple-Skills und gemountete MCP-Tools. Die Toolbar-Schaltflächen (**Refresh**, **Open Project**, **Diagnostics**, **Build Scheme**, **Sync Apple Skills**) laufen über den Session-Befehl `/xcode`, ohne Modell-Tokens zu verbrauchen.
- **Kompakte Konversationskarten.** Tool-Aufrufe (`xcode_status`, `xcode_open_project`, `xcode_diagnostics`, `xcode_build_test`, `xcode_render_preview`, `xcode_sync_skills`) rendern kompakte lokalisierte Zeilen (`zh` / `en`), die offene Workbench-Tabs automatisch aktualisieren, sobald ein Aufruf abgeschlossen ist.

## Kopplung mit DSH iOS (`@zseven-w/dsh-ios`)

`dsh-xcode` und [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios) haben **keinerlei harte Abhängigkeiten** voneinander — installiere entweder allein oder beide zusammen. Sind beide im selben DSH-Profil geladen, finden sie sich prozessintern über `Symbol.for('zseven.dsh.apple.peer.v1')`:

- **Nutze `dsh-xcode` (`xcode_*`) für IDE- &amp; Compiler-Arbeit** — `< 1 s`-Diagnose einzelner Dateien beim Bearbeiten von Swift-/ObjC-Dateien, warme inkrementelle Schema-Builds und Unit-Tests, SwiftUI-`#Preview`-Schnappschüsse für `.xcodeproj` / `.xcworkspace` und lokale Apple-Dokumentationssuche.
- **Nutze `dsh-ios` (`ios_sim_*`) für Live-Geräte-Runtime &amp; UI-Automatisierung** — interaktives MJPEG-Videostreaming des Simulators und echter USB-iPhones in der Seitenleiste, AXe-Zugänglichkeitsbäume (`ios_sim_ui_tree`, `ios_sim_tap_element`, `ios_sim_ui_rows`), Vision-OCR-Suchen/-Taps (`ios_sim_find_text`, `ios_sim_tap_text`), vereinheitlichte Runtime-Logs (`ios_sim_logs`), LLDB-Backtraces und `leaks`.
- **Smartes Cross-Plugin-Routing** — ruft ein Agent `ios_sim_preview` (SwiftPM-Dylib-Hot-Reload) auf einem `.xcodeproj` / `.xcworkspace` auf, merkt `dsh-ios`, dass `dsh-xcode` gemountet ist, und leitet den Agenten direkt zu `xcode_render_preview`.

## Sicherheit und Datenschutz

- **Ausschließlich lokaler XPC-Transport** — `xcrun mcpbridge` kommuniziert ausschließlich über macOS-XPC mit deinem lokalen Xcode-Prozess; das Plugin öffnet keine Netzwerk-Listener und stellt null externe HTTP-Anfragen.
- **Umgebungs-Säuberung** — vor dem Start von `xcrun mcpbridge` oder `xcrun agent` entfernt `scrubEnvForMcpBridge` jede Umgebungsvariable, die auf `*KEY*`, `*SECRET*`, `*TOKEN*`, `*PASSWORD*` oder `DSH_*` passt, und reicht nur die Standard-macOS-Entwickler-/XPC-Variablen durch (`HOME`, `USER`, `PATH`, `TMPDIR`, `DEVELOPER_DIR`, `MCP_XCODE_PID`, `MCP_XCODE_SESSION_ID`).
- **Ausdrückliche Xcode-Zustimmung des Nutzers** — der externe Agentenzugriff wird durch Xcodes eigenen Schalter **Settings → Intelligence → Model Context Protocol** und den macOS-/Xcode-Berechtigungsdialog abgesichert.
- **Begrenzte Binärbehandlung** — MCP-Bildblöcke werden vor dem Dekodieren gegen kanonisches Base64 und eine strikte 20-MB-Grenze geprüft; übergroße Base64-Strings in rohen JSON-Payloads werden entfernt, damit der Modellkontext sauber bleibt.

## Voraussetzungen

- **macOS** mit installiertem **Xcode 26.3 oder neuer** (`xcode-select -p` zeigt auf `/Applications/Xcode.app/Contents/Developer`, nicht auf die Command Line Tools).
- **DeepSeek Harness** `0.2.1-rc.5` oder neuer, Node.js `>= 24.11.0`.
- **Einmalige Xcode-Einstellung** — öffne **Xcode → Settings → Intelligence → Model Context Protocol** und aktiviere **Allow External Agents** (bestätige Xcodes Berechtigungsabfrage bei der ersten Verbindung).

## In DSH installieren

```sh
dsh plugin --profile web add @zseven-w/dsh-xcode@latest
dsh web
```

Koppel es mit `dsh-ios` für vollständiges Simulator- + USB-iPhone-Streaming neben den Xcode-IDE-Tools:

```sh
dsh plugin --profile web add @zseven-w/dsh-ios@latest
```

## Schnellstart

1. **Status prüfen &amp; Projekt öffnen** — *„Prüfe den Xcode-Status und öffne das iOS-Projekt in diesem Ordner."* → `xcode_status` / `xcode_open_project`. Bestätige Xcodes Abfrage für externe Agenten beim ersten Lauf.
2. **Eine Datei bearbeiten &amp; in `< 1 s` prüfen** — *„Refaktoriere `HomeView.swift` und prüfe es auf Compiler-Fehler, ohne einen vollständigen Build laufen zu lassen."* → `xcode_diagnostics` (`filePath: "Sources/HomeView.swift"`).
3. **Ein SwiftUI-`#Preview` rendern** — *„Rendere die SwiftUI-Vorschau von `HomeView.swift` und prüfe das Layout."* → `xcode_render_preview`. Öffne den **Xcode Workbench** in der rechten Seitenleiste, um die gerenderten Schnappschüsse zu betrachten.
4. **Apple-Doku durchsuchen &amp; Tests ausführen** — *„Suche in Xcodes lokaler Dokumentation nach der Spaltensichtbarkeit von `NavigationSplitView` und führe dann die Unit-Tests aus."* → `xcode_search_docs` → `xcode_build_test` (`action: "run_all_tests"`).

## Konfiguration

Optionale Einstellungen unter `plugins.dsh-xcode` in `cordis.patch.yml`:

| Option | Standard | Bedeutung |
| --- | --- | --- |
| `xcodePid` | wird automatisch ermittelt | Explizite PID des laufenden Xcode (`MCP_XCODE_PID`), wenn `Xcode.app` und `Xcode-beta.app` gleichzeitig geöffnet sind. |
| `callTimeoutMs` | `180000` | Standard-Timeout (ms) für langlaufende Xcode-MCP-Operationen (`BuildProject`, `RunAllTests`, `RenderPreview`). |
| `autoSyncSkills` | `true` | Exportiert und registriert Apples eingebaute `SKILL.md`-Bundles automatisch, sobald `xcode_status` oder `xcode_open_project` eine Verbindung herstellt. |
| `skillsCacheDir` | `~/.cache/dsh-xcode/skills` | Verzeichnis, in dem exportierte Apple-`SKILL.md`-Bundles pro Xcode-Build-Nummer gecacht werden. |

## Fehlerbehebung

- **`xcrun could not find mcpbridge` / Command-Line-Tools-Fehler** — `xcode-select -p` zeigt auf `/Library/Developer/CommandLineTools` oder ein älteres Xcode (< 26.3). Wechsle zum vollständigen Xcode 26.3+: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.
- **`Could not establish MCP tool session with Xcode`** — stelle sicher, dass mindestens ein Projekt-/Workspace-Fenster in Xcode offen ist (`xcode_open_project`), aktiviere **Xcode → Settings → Intelligence → Model Context Protocol → Allow External Agents** und klicke auf **Allow**, falls Xcode im Hintergrund einen Agenten-Autorisierungsdialog anzeigt.
- **Mehrere Xcode-Instanzen laufen** — `dsh-xcode` wählt automatisch die PID, die zu `xcode-select -p` passt; sind zwei Kopien desselben Bundles offen, übergib `xcodePid` in der Konfiguration oder setze `DSHPLUGIN_XCODE_PID=<pid>`.
- **`#Preview`-Makro schlägt bei einer benutzerdefinierten Target-Konfiguration fehl** — Xcodes Preview-Engine tut sich gelegentlich schwer, bei komplexen `#Preview`-Makros einen Formfaktor zu erschließen; eine Standard-`PreviewProvider`-Struktur in der Datei funktioniert mit `xcode_render_preview` zuverlässig.

## Entwicklung

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run smoke:pack
```

Verlinke einen lokalen Checkout in dein DSH-Web-Profil:

```sh
dsh plugin --profile web add link:/path/to/dsh-xcode
dsh web
```

| Suite | Was sie abdeckt |
| --- | --- |
| `test/mcp-stdio.test.mjs` | STDIO-JSON-RPC-Handshake, paginiertes `tools/list`, Hydrierung des in Xcode 26 weggelassenen `structuredContent`, kanonisches PNG-Dekodieren, Base64-Entfernung, Umgebungs-Säuberung, Fehlerklassifizierung. |
| `test/env-and-bridge.test.mjs` | `ps`-Prozessfilterung Xcode vs. Simulator, PID-Auswahlregeln, Erkennung von `.xcworkspace`/`.xcodeproj`/`Package.swift`, `tabIdentifier`-Autoauflösung, Persistenz des Diagnose-/Build-/Preview-Zustands, `SKILL.md`-Export &amp; Host-`apply()`-Lebenszyklus. |
| `test/client-bundle.test.mjs` | Bundle-Form von `window.__ModuleLoader__.load`, Invariante des externalisierten Host-React, `zh`/`en`-Locale-Parität, Adresskodierung der Workbench-Ressourcen, Slot- &amp; Tab-Registrierung. |
| `test/ios-peer-linkage.test.mjs` | Live-Cross-Plugin-Erkennung über `Symbol.for('zseven.dsh.apple.peer.v1')` mit `@zseven-w/dsh-ios` und Smart-Routing von `.xcodeproj` → `xcode_render_preview`. |

## Ökosystem

- [DSH iOS Simulator](https://github.com/ZSeven-W/dsh-ios) — Live-Streaming des interaktiven iOS-Simulators &amp; echter USB-iPhones, AXe-UI-Bäume, Vision-OCR und SwiftPM-Preview-Hot-Reload
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — ein Live-Android-Emulator oder ein USB-Gerät innerhalb der Konversation, komplett über `adb` gesteuert
- [DSH Computer](https://github.com/ZSeven-W/dsh-computer) — Headless-First-macOS-Computer-Use-Treiber mit AX-first-Beobachtungen und Freigabe über den Host
- [DSH Browser](https://github.com/ZSeven-W/dsh-browser) — isolierte Chromium-Sessions mit semantischen Referenzen und begrenzter Evidenz
- [DSH QA](https://github.com/ZSeven-W/dsh-qa) — agentengeführte Exploration und deterministisches Szenario-Replay über Browser, Desktop, iOS &amp; Android hinweg
- [DSH Game Studio](https://github.com/ZSeven-W/dsh-game-studio) — beschreibe ein 2D- oder 3D-Voxel-Spiel in einem Satz, spiele es in der Seitenleiste, tausche KI-Grafiken ein und veröffentliche mit einem Klick
- [DSH Harbor](https://github.com/ZSeven-W/dsh-harbor) — Fähigkeitsinventar, Konflikterkennung und DSH-Upgrade-Preflight für installierte Plugins
- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — Arbeit aus Claude Code / Codex als native Subagenten an DSH-Agenten verteilen
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — dauerhafter, einsehbarer Langzeit-Agentenspeicher für DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — `.op`-OpenPencil-Designdokumente in DSH-Konversationen ansehen, inspizieren und bearbeiten

## Lizenz

MIT © ZSeven-W
