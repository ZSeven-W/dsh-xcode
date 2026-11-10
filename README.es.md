<p align="center">
  <img src="./docs/images/dsh-xcode-logo.png" alt="DSH Xcode" width="120" />
</p>

<h1 align="center">DSH Xcode</h1>

<p align="center">
  <strong>El puente MCP oficial de Xcode de Apple (<code>xcrun mcpbridge</code>) y las Apple Skills integradas dentro de una conversación de <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> — emparejado a la perfección con <a href="https://github.com/ZSeven-W/dsh-ios">DSH iOS</a>.</strong><br />
  <sub>8 herramientas de agente &bull; diagnóstico del compilador de un solo archivo en &lt; 1 s &bull; instantáneas nativas de <code>#Preview</code> de SwiftUI &bull; compilaciones &amp; pruebas de esquema en caliente &bull; búsqueda local en la documentación de Apple &bull; Workbench en la barra lateral derecha</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-xcode</code> &middot; Versión actual del plugin: <code>0.1.0-rc.3</code> &middot; Probado con DSH <code>0.2.1-rc.5</code></sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <b>Español</b> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-xcode/actions/workflows/check.yml"><img src="https://img.shields.io/github/actions/workflow/status/ZSeven-W/dsh-xcode/check.yml?label=CI" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@zseven-w/dsh-xcode"><img src="https://img.shields.io/npm/v/@zseven-w/dsh-xcode?color=1a78f2" alt="npm" /></a>
  <a href="https://github.com/ZSeven-W/dsh-xcode/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-xcode?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-xcode-banner.png" alt="DSH Xcode — Puente MCP oficial de Xcode &amp; Apple Skills dentro de DeepSeek Harness" width="100%" />
</p>

## Por qué DSH Xcode

A partir de Xcode 26.3, Apple incluye un puente oficial de Model Context Protocol (`xcrun mcpbridge`) sobre XPC local, además de paquetes de agente de primera parte en formato `SKILL.md` (`xcrun agent skills export`). Conectar `xcrun mcpbridge` en bruto directamente a un agente de código genérico, sin embargo, choca con tres muros prácticos:

1. **Desajuste de `structuredContent` en Xcode 26** — herramientas como `XcodeListWindows` declaran un `outputSchema` en `tools/list` pero devuelven el JSON dentro de `content[0].text` y omiten `structuredContent`, lo que hace que clientes estrictos del SDK de MCP rechacen respuestas válidas.
2. **Ciclo de vida del proceso y enrutamiento de PID con varios Xcode** — `mcpbridge` termina de inmediato cuando Xcode se cierra, cuando `Xcode.app` y `Xcode-beta.app` están corriendo a la vez, o antes de que se active el acceso de agentes externos en **Xcode → Settings → Intelligence**.
3. **Hinchazón de contexto** — Xcode expone más de 20 herramientas granulares y emite cadenas PNG en base64 de varios megabytes desde `RenderPreview`.

`DSH Xcode` envuelve el puente oficial de Apple en un plugin nativo de DeepSeek Harness sin dependencias, con un Workbench integrado en la barra lateral derecha y descubrimiento de pares sin acoplamiento junto a [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios).

| | |
| --- | --- |
| ⚡ **Diagnóstico de un solo archivo en &lt; 1 s** | `xcode_diagnostics` con `filePath` invoca `XcodeRefreshCodeIssuesInFile` contra el grafo del compilador en vivo de Xcode: comprueba ediciones de Swift/ObjC en menos de un segundo sin lanzar ejecuciones frías de `xcodebuild`. |
| 🖼️ **Instantáneas nativas de `#Preview` de SwiftUI** | `xcode_render_preview` maneja el propio motor `RenderPreview` de Xcode sobre `.xcodeproj`, `.xcworkspace` y paquetes de Swift, escribe PNG en `.dsh-xcode/previews/` y adjunta las imágenes directamente cuando hay modelos multimodales activos. |
| 🔨 **Compilaciones y pruebas incrementales en caliente** | `xcode_build_test` reutiliza el grafo de compilación en caliente del DerivedData de Xcode para `BuildProject`, `GetBuildLog`, `GetTestList`, `RunAllTests` y `RunSomeTests` (XCTest &amp; Swift Testing). |
| 🔧 **Normalización del protocolo de Xcode 26** | Hidrata automáticamente el `structuredContent` omitido a partir de bloques de texto JSON, resuelve el `tabIdentifier` entre varias ventanas de workspace abiertas y recorta las cadenas base64 sobredimensionadas de los resúmenes JSON. |
| 📘 **Sincronización oficial de `SKILL.md` de Apple** | Ejecuta `xcrun agent skills export`, analiza los paquetes `SKILL.md` integrados de Apple para tu compilación exacta de Xcode, los guarda en caché bajo `~/.cache/dsh-xcode/skills/` y los registra dinámicamente en `ctx.skills`. |
| 🪟 **Workbench de Xcode en la barra lateral derecha** | Píldora de estado de conexión en vivo, ventanas de workspace abiertas con sus `tabIdentifier`s, lista de diagnósticos del compilador, resumen de compilación/pruebas, galería de `#Preview` de SwiftUI renderizados y estado del dispositivo par de `dsh-ios`. |
| 📱 **Emparejado con `dsh-ios`** | Cero acoplamiento en tiempo de instalación mediante `Symbol.for('zseven.dsh.apple.peer.v1')`: `dsh-xcode` se encarga de la inteligencia del compilador del IDE mientras `dsh-ios` transmite y controla en vivo Simuladores &amp; iPhones conectados por USB. |
| 🧭 **Escotilla de escape a prueba de futuro** | `xcode_call_tool` lista e invoca cualquier herramienta `mcpbridge` en bruto (`ExecuteSnippet`, `XcodeUpdate`, `XcodeGlob` o las `DeviceInteraction*` de Xcode 27+) sin esperar a una actualización del plugin. |

## Herramientas

Las 8 herramientas se registran en cualquier host, resuelven automáticamente el `tabIdentifier` desde el workspace activo cuando se omite, y se degradan con instrucciones de configuración accionables en hosts que no son macOS o cuando Xcode está cerrado.

| Herramienta | Qué hace | Parámetros clave |
| --- | --- | --- |
| `xcode_status` | Inspecciona el directorio de desarrollador activo de `xcode-select`, la versión/compilación de Xcode, las capacidades de `xcrun mcpbridge` &amp; `agent`, los PIDs de `Xcode.app` en ejecución, las ventanas de workspace abiertas (sus `tabIdentifier`s), las skills de Apple sincronizadas y el estado del par `dsh-ios`. | `connect` (por defecto `true`) |
| `xcode_open_project` | Detecta y abre automáticamente un `.xcworkspace`, `.xcodeproj` o `Package.swift` en Xcode (`open -a Xcode`) y luego sondea hasta que `mcpbridge` se conecta y reporta el `tabIdentifier` de la ventana. | `projectPath` (opcional), `waitSeconds` (por defecto `20`) |
| `xcode_diagnostics` | Lee en vivo errores y advertencias del compilador de Xcode. Pasa `filePath` para la verificación de tipos de un solo archivo en `< 1 s` (`XcodeRefreshCodeIssuesInFile`), u omítelo para los diagnósticos de todo el workspace del Issue Navigator (`XcodeListNavigatorIssues`). | `filePath`, `projectPath`, `tabIdentifier`, `severity` (`error`/`warning`/`remark`), `pattern` |
| `xcode_build_test` | Compila el esquema activo, inspecciona registros de compilación filtrados, o lista/ejecuta suites de XCTest &amp; Swift Testing dentro del grafo de compilación en caliente de Xcode. | `action` (obligatorio — `build`/`build_log`/`list_tests`/`run_all_tests`/`run_some_tests`), `tests` (arreglo JSON), `severity`, `pattern` |
| `xcode_render_preview` | Renderiza de forma nativa en Xcode una instantánea de `#Preview` o `PreviewProvider` de SwiftUI, guarda el PNG bajo `.dsh-xcode/previews/` para la galería del Workbench y lo adjunta al contexto de modelos multimodales. | `sourceFilePath` (obligatorio), `previewDefinitionIndexInFile` (por defecto `0`), `projectPath`, `tabIdentifier` |
| `xcode_search_docs` | Búsqueda semántica en la Apple Developer Documentation y las transcripciones de sesiones de la WWDC integradas en Xcode (`DocumentationSearch`). | `query` (obligatorio), `frameworks` (lista opcional separada por comas, p. ej. `"SwiftUI,Observation"`) |
| `xcode_sync_skills` | Exporta los paquetes `SKILL.md` oficiales de Apple desde la app de Xcode activa vía `xcrun agent skills export` y los registra en la sesión actual de DSH. | — |
| `xcode_call_tool` | Lista todas las herramientas MCP en bruto que expone tu versión de Xcode (`action: "list"`) o invoca cualquier herramienta directamente (`action: "call"`). | `action` (obligatorio — `list`/`call`), `toolName`, `argumentsJson` |

## Superficies de visualización

- **Panel de la barra lateral derecha — “Xcode Workbench”.** Se abre desde el botón **Open Workbench** de cualquier fila de herramientas o desde el lanzador **`+`** de la barra lateral derecha (**Xcode Workbench**). Muestra la píldora de conexión en vivo a Xcode + PID, la versión/compilación de Xcode, el enlace al dispositivo en vivo de `dsh-ios`, las ventanas de workspace abiertas (`tabIdentifier`s), los últimos diagnósticos del compilador con distintivos de archivo/línea, el último resultado de compilación/pruebas, las miniaturas de `#Preview` de SwiftUI renderizadas, las Apple Skills sincronizadas y las herramientas MCP montadas. Los botones de la barra de herramientas (**Refresh**, **Open Project**, **Diagnostics**, **Build Scheme**, **Sync Apple Skills**) se ejecutan a través del comando de sesión `/xcode` sin gastar tokens del modelo.
- **Tarjetas compactas en la conversación.** Las llamadas a herramientas (`xcode_status`, `xcode_open_project`, `xcode_diagnostics`, `xcode_build_test`, `xcode_render_preview`, `xcode_sync_skills`) renderizan filas compactas localizadas (`zh` / `en`) que refrescan automáticamente las pestañas abiertas del Workbench cuando una llamada termina.

## Emparejamiento con DSH iOS (`@zseven-w/dsh-ios`)

`dsh-xcode` y [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios) **no tienen ninguna dependencia dura** entre sí: instala cualquiera de los dos por separado o ambos juntos. Cuando ambos están cargados en el mismo perfil de DSH, se descubren entre sí dentro del proceso mediante `Symbol.for('zseven.dsh.apple.peer.v1')`:

- **Usa `dsh-xcode` (`xcode_*`) para el trabajo de IDE &amp; compilador** — diagnóstico de un solo archivo en `< 1 s` mientras editas archivos Swift/ObjC, compilaciones y pruebas unitarias incrementales en caliente del esquema, instantáneas de `#Preview` de SwiftUI para `.xcodeproj` / `.xcworkspace`, y consulta local de la documentación de Apple.
- **Usa `dsh-ios` (`ios_sim_*`) para el runtime de dispositivos en vivo &amp; la automatización de UI** — streaming de vídeo MJPEG interactivo del Simulador y de iPhones reales conectados por USB en la barra lateral, árboles de accesibilidad AXe (`ios_sim_ui_tree`, `ios_sim_tap_element`, `ios_sim_ui_rows`), búsqueda/toque con Vision OCR (`ios_sim_find_text`, `ios_sim_tap_text`), registros unificados del runtime (`ios_sim_logs`), backtraces de LLDB y `leaks`.
- **Enrutamiento inteligente entre plugins** — si un agente llama a `ios_sim_preview` (hot-reload de dylibs de SwiftPM) sobre un `.xcodeproj` / `.xcworkspace`, `dsh-ios` detecta que `dsh-xcode` está montado y dirige al agente directo a `xcode_render_preview`.

## Seguridad y privacidad

- **Transporte XPC local únicamente** — `xcrun mcpbridge` se comunica exclusivamente con tu proceso local de Xcode por XPC de macOS; el plugin no abre escuchas de red ni hace peticiones HTTP externas.
- **Depuración del entorno** — antes de lanzar `xcrun mcpbridge` o `xcrun agent`, `scrubEnvForMcpBridge` elimina cualquier variable de entorno que coincida con `*KEY*`, `*SECRET*`, `*TOKEN*`, `*PASSWORD*` o `DSH_*`, y deja pasar solo las variables estándar de desarrollador/XPC de macOS (`HOME`, `USER`, `PATH`, `TMPDIR`, `DEVELOPER_DIR`, `MCP_XCODE_PID`, `MCP_XCODE_SESSION_ID`).
- **Consentimiento explícito del usuario en Xcode** — el acceso de agentes externos está protegido por el propio interruptor de Xcode **Settings → Intelligence → Model Context Protocol** y por el diálogo de permisos de macOS/Xcode.
- **Manejo binario acotado** — los bloques de imagen MCP se verifican contra base64 canónico y un techo estricto de 20 MB antes de decodificar; las cadenas base64 sobredimensionadas dentro de payloads JSON en bruto se recortan para mantener limpio el contexto del modelo.

## Requisitos

- **macOS** con **Xcode 26.3 o posterior** instalado (`xcode-select -p` apuntando a `/Applications/Xcode.app/Contents/Developer`, no a Command Line Tools).
- **DeepSeek Harness** `0.2.1-rc.5` o posterior, Node.js `>= 24.11.0`.
- **Configuración única de Xcode** — abre **Xcode → Settings → Intelligence → Model Context Protocol** y activa **Allow External Agents** (aprueba el aviso de permisos de Xcode en la primera conexión).

## Instalar en DSH

```sh
dsh plugin --profile web add @zseven-w/dsh-xcode@latest
dsh web
```

Emparéjalo con `dsh-ios` para tener streaming completo de Simulador + iPhone por USB junto a las herramientas IDE de Xcode:

```sh
dsh plugin --profile web add @zseven-w/dsh-ios@latest
```

## Inicio rápido

1. **Revisa el estado &amp; abre tu proyecto** — *«Revisa el estado de Xcode y abre el proyecto de iOS de esta carpeta.»* → `xcode_status` / `xcode_open_project`. Aprueba el aviso de agente externo de Xcode si es tu primera ejecución.
2. **Edita &amp; comprueba un solo archivo en `< 1 s`** — *«Refactoriza `HomeView.swift` y comprueba si tiene errores del compilador sin ejecutar una compilación completa.»* → `xcode_diagnostics` (`filePath: "Sources/HomeView.swift"`).
3. **Renderiza un `#Preview` de SwiftUI** — *«Renderiza la vista previa de SwiftUI de `HomeView.swift` y comprueba el diseño.»* → `xcode_render_preview`. Abre el **Xcode Workbench** en la barra lateral derecha para inspeccionar las instantáneas renderizadas.
4. **Busca en la documentación de Apple &amp; ejecuta las pruebas** — *«Busca en la documentación local de Xcode la visibilidad de columnas de `NavigationSplitView` y luego ejecuta las pruebas unitarias.»* → `xcode_search_docs` → `xcode_build_test` (`action: "run_all_tests"`).

## Configuración

Ajustes opcionales bajo `plugins.dsh-xcode` en `cordis.patch.yml`:

| Opción | Por defecto | Significado |
| --- | --- | --- |
| `xcodePid` | se resuelve automáticamente | PID explícito del Xcode en ejecución (`MCP_XCODE_PID`) cuando `Xcode.app` y `Xcode-beta.app` están abiertos a la vez. |
| `callTimeoutMs` | `180000` | Tiempo de espera (ms) por defecto para operaciones MCP de Xcode de larga duración (`BuildProject`, `RunAllTests`, `RenderPreview`). |
| `autoSyncSkills` | `true` | Exporta y registra automáticamente los paquetes `SKILL.md` integrados de Apple cuando `xcode_status` o `xcode_open_project` se conectan. |
| `skillsCacheDir` | `~/.cache/dsh-xcode/skills` | Directorio donde se guardan en caché los paquetes `SKILL.md` exportados de Apple, por número de compilación de Xcode. |

## Solución de problemas

- **Error `xcrun could not find mcpbridge` / de Command Line Tools** — `xcode-select -p` está apuntando a `/Library/Developer/CommandLineTools` o a un Xcode anterior (< 26.3). Cambia al Xcode 26.3+ completo: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.
- **`Could not establish MCP tool session with Xcode`** — asegúrate de que al menos una ventana de proyecto/workspace esté abierta en Xcode (`xcode_open_project`), activa **Xcode → Settings → Intelligence → Model Context Protocol → Allow External Agents** y haz clic en **Allow** si Xcode está mostrando en segundo plano un diálogo de autorización de agentes.
- **Varias instancias de Xcode en ejecución** — `dsh-xcode` elige automáticamente el PID que coincide con `xcode-select -p`; si hay dos copias del mismo bundle abiertas, pasa `xcodePid` en la configuración o define `DSHPLUGIN_XCODE_PID=<pid>`.
- **La macro `#Preview` falla con una configuración de destino personalizada** — el motor de vistas previas de Xcode ocasionalmente tiene problemas para inferir un factor de forma en macros `#Preview` complejas; añadir un struct `PreviewProvider` estándar en el archivo funciona de forma fiable con `xcode_render_preview`.

## Desarrollo

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run smoke:pack
```

Enlaza un checkout local en tu perfil de DSH Web:

```sh
dsh plugin --profile web add link:/path/to/dsh-xcode
dsh web
```

| Suite | Qué cubre |
| --- | --- |
| `test/mcp-stdio.test.mjs` | Handshake STDIO JSON-RPC, `tools/list` paginado, hidratación del `structuredContent` omitido de Xcode 26, decodificación canónica de PNG, recorte de base64, depuración del entorno, clasificación de errores. |
| `test/env-and-bridge.test.mjs` | Filtrado con `ps` de procesos Xcode vs Simulador, reglas de selección de PID, descubrimiento de `.xcworkspace`/`.xcodeproj`/`Package.swift`, auto-resolución del `tabIdentifier`, persistencia del estado de diagnósticos/compilación/vista previa, exportación de `SKILL.md` &amp; ciclo de vida del `apply()` del Host. |
| `test/client-bundle.test.mjs` | Forma del bundle de `window.__ModuleLoader__.load`, invariante del React del host externalizado, paridad de locales `zh`/`en`, codificación de direcciones de recursos del Workbench, registro de slots &amp; pestañas. |
| `test/ios-peer-linkage.test.mjs` | Descubrimiento cruzado en vivo entre plugins mediante `Symbol.for('zseven.dsh.apple.peer.v1')` con `@zseven-w/dsh-ios` y enrutamiento inteligente de `.xcodeproj` → `xcode_render_preview`. |

## Ecosistema

- [DSH iOS Simulator](https://github.com/ZSeven-W/dsh-ios) — streaming interactivo en vivo del Simulador de iOS &amp; de iPhones reales conectados por USB, árboles de UI AXe, OCR con Vision y hot reload de previas SwiftPM
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — un emulador de Android en vivo o un dispositivo USB dentro de la conversación, controlado por completo mediante `adb`
- [DSH Computer](https://github.com/ZSeven-W/dsh-computer) — controlador de Computer Use para macOS con enfoque headless-first, observaciones AX-first y aprobación controlada por el host
- [DSH Browser](https://github.com/ZSeven-W/dsh-browser) — sesiones aisladas de Chromium con referencias semánticas y evidencia acotada
- [DSH QA](https://github.com/ZSeven-W/dsh-qa) — exploración dirigida por el agente y repetición determinista de escenarios a través de Browser, Desktop, iOS &amp; Android
- [DSH Game Studio](https://github.com/ZSeven-W/dsh-game-studio) — describe un juego de vóxeles 2D o 3D en una frase, juégalo en la barra lateral, incorpórale arte de IA y publícalo en un clic
- [DSH Harbor](https://github.com/ZSeven-W/dsh-harbor) — inventario de capacidades, detección de conflictos y preflight de actualización de DSH para los plugins instalados
- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — envía trabajo a agentes de DSH desde Claude Code / Codex como subagentes nativos
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — memoria a largo plazo para agentes, duradera e inspeccionable, para DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — previsualiza, inspecciona y edita documentos de diseño `.op` de OpenPencil dentro de conversaciones de DSH

## Licencia

MIT © ZSeven-W
