<p align="center">
  <img src="./docs/images/dsh-xcode-logo.png" alt="DSH Xcode" width="120" />
</p>

<h1 align="center">DSH Xcode</h1>

<p align="center">
  <strong>Официальный MCP-мост Xcode от Apple (<code>xcrun mcpbridge</code>) и встроенные Apple Skills внутри диалога <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> — в бесшовной связке с <a href="https://github.com/ZSeven-W/dsh-ios">DSH iOS</a>.</strong><br />
  <sub>8 инструментов агента &bull; диагностика компилятора по одному файлу за &lt; 1 с &bull; нативные снимки <code>#Preview</code> SwiftUI &bull; тёплые сборки и тесты схемы &bull; локальный поиск по документации Apple &bull; Workbench в правой боковой панели</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-xcode</code> &middot; Текущий релиз плагина: <code>0.1.0-rc.2</code> &middot; Протестировано с DSH <code>0.2.1-rc.5</code></sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <b>Русский</b> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-xcode/actions/workflows/check.yml"><img src="https://img.shields.io/github/actions/workflow/status/ZSeven-W/dsh-xcode/check.yml?label=CI" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@zseven-w/dsh-xcode"><img src="https://img.shields.io/npm/v/@zseven-w/dsh-xcode?color=1a78f2" alt="npm" /></a>
  <a href="https://github.com/ZSeven-W/dsh-xcode/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-xcode?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-xcode-banner.png" alt="DSH Xcode — официальный MCP-мост Xcode и Apple Skills внутри DeepSeek Harness" width="100%" />
</p>

## Почему DSH Xcode

Начиная с Xcode 26.3, Apple поставляет официальный мост Model Context Protocol (`xcrun mcpbridge`) поверх локального XPC, а также собственные агентные пакеты `SKILL.md` (`xcrun agent skills export`). Однако если подключить `xcrun mcpbridge` в сыром виде напрямую к универсальному кодинг-агенту, вы упрётесь в три практические стены:

1. **Несоответствие `structuredContent` в Xcode 26** — такие инструменты, как `XcodeListWindows`, объявляют `outputSchema` в `tools/list`, но возвращают JSON внутри `content[0].text` и не заполняют `structuredContent`, из-за чего строгие клиенты MCP SDK отклоняют корректные ответы.
2. **Жизненный цикл процесса и маршрутизация PID при нескольких Xcode** — `mcpbridge` немедленно завершается при закрытии Xcode, при одновременной работе `Xcode.app` и `Xcode-beta.app` или пока внешний доступ агентов не включён в **Xcode → Settings → Intelligence**.
3. **Раздувание контекста** — Xcode предоставляет ~20+ узкоспециализированных инструментов и выдаёт мегабайтные строки base64-PNG из `RenderPreview`.

`DSH Xcode` оборачивает официальный мост Apple в нативный плагин DeepSeek Harness без зависимостей — со встроенной панелью Workbench в правой боковой панели и обнаружением плагина-партнёра без жёсткого связывания рядом с [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios).

| | |
| --- | --- |
| ⚡ **Диагностика одного файла менее чем за 1 с** | `xcode_diagnostics` с параметром `filePath` вызывает `XcodeRefreshCodeIssuesInFile` поверх живого графа компилятора Xcode — проверка правок Swift/ObjC занимает меньше секунды без запуска «холодных» прогонов `xcodebuild`. |
| 🖼️ **Нативные снимки `#Preview` SwiftUI** | `xcode_render_preview` управляет собственным движком Xcode `RenderPreview` для `.xcodeproj`, `.xcworkspace` и Swift-пакетов, записывает PNG в `.dsh-xcode/previews/` и напрямую прикрепляет изображения при активных мультимодальных моделях. |
| 🔨 **Тёплые инкрементальные сборки и тесты** | `xcode_build_test` переиспользует тёплый граф сборки DerivedData Xcode для `BuildProject`, `GetBuildLog`, `GetTestList`, `RunAllTests` и `RunSomeTests` (XCTest и Swift Testing). |
| 🔧 **Нормализация протокола Xcode 26** | Автоматически восстанавливает пропущенный `structuredContent` из текстовых JSON-блоков, разрешает `tabIdentifier` между несколькими открытыми окнами рабочих областей и вырезает сверхбольшие строки base64 из JSON-сводок. |
| 📘 **Синхронизация официальных `SKILL.md` Apple** | Запускает `xcrun agent skills export`, разбирает встроенные пакеты `SKILL.md` Apple для вашей точной сборки Xcode, кэширует их в `~/.cache/dsh-xcode/skills/` и динамически регистрирует в `ctx.skills`. |
| 🪟 **Xcode Workbench в правой боковой панели** | Живой значок состояния подключения, открытые окна рабочих областей с их `tabIdentifier`, список диагностик компилятора, сводка сборки/тестов, галерея отрендеренных `#Preview` SwiftUI и статус устройства-пира `dsh-ios`. |
| 📱 **В связке с `dsh-ios`** | Нулевое связывание на этапе установки через `Symbol.for('zseven.dsh.apple.peer.v1')`: `dsh-xcode` отвечает за интеллектуальную работу с компилятором в IDE, а `dsh-ios` стримит и управляет живыми Симуляторами и iPhone, подключёнными по USB. |
| 🧭 **Запасной выход с заделом на будущее** | `xcode_call_tool` перечисляет и вызывает любой сырой инструмент `mcpbridge` (`ExecuteSnippet`, `XcodeUpdate`, `XcodeGlob` или `DeviceInteraction*` из Xcode 27+), не дожидаясь обновления плагина. |

## Инструменты

Все 8 инструментов регистрируются на любом хосте, автоматически подставляют `tabIdentifier` из активной рабочей области, если он опущен, и деградируют с практическими инструкциями по настройке на хостах без macOS или когда Xcode закрыт.

| Инструмент | Что он делает | Ключевые параметры |
| --- | --- | --- |
| `xcode_status` | Проверяет активный каталог разработчика `xcode-select`, версию/сборку Xcode, возможности `xcrun mcpbridge` и `agent`, PID запущенных `Xcode.app`, открытые окна рабочих областей (`tabIdentifier`), синхронизированные Apple Skills и статус пира `dsh-ios`. | `connect` (по умолчанию `true`) |
| `xcode_open_project` | Автоматически находит и открывает `.xcworkspace`, `.xcodeproj` или `Package.swift` в Xcode (`open -a Xcode`), затем опрашивает, пока `mcpbridge` не подключится и не сообщит `tabIdentifier` окна. | `projectPath` (необязательный), `waitSeconds` (по умолчанию `20`) |
| `xcode_diagnostics` | Читает живые ошибки и предупреждения компилятора Xcode. Передайте `filePath` для проверки типов одного файла за `< 1 s` (`XcodeRefreshCodeIssuesInFile`) или опустите `filePath` для диагностики всей рабочей области из Issue Navigator (`XcodeListNavigatorIssues`). | `filePath`, `projectPath`, `tabIdentifier`, `severity` (`error`/`warning`/`remark`), `pattern` |
| `xcode_build_test` | Собирает активную схему, просматривает отфильтрованные логи сборки, а также выводит список/запускает наборы XCTest и Swift Testing внутри тёплого графа сборки Xcode. | `action` (обязательный — `build`/`build_log`/`list_tests`/`run_all_tests`/`run_some_tests`), `tests` (JSON-массив), `severity`, `pattern` |
| `xcode_render_preview` | Рендерит снимок SwiftUI `#Preview` или `PreviewProvider` нативно в Xcode, сохраняет PNG в `.dsh-xcode/previews/` для галереи Workbench и прикрепляет его к контексту мультимодальных моделей. | `sourceFilePath` (обязательный), `previewDefinitionIndexInFile` (по умолчанию `0`), `projectPath`, `tabIdentifier` |
| `xcode_search_docs` | Семантический поиск по встроенной в Xcode документации Apple Developer и расшифровкам сессий WWDC (`DocumentationSearch`). | `query` (обязательный), `frameworks` (необязательный список через запятую, напр. `"SwiftUI,Observation"`) |
| `xcode_sync_skills` | Экспортирует официальные пакеты `SKILL.md` Apple из активного приложения Xcode через `xcrun agent skills export` и регистрирует их в текущей сессии DSH. | — |
| `xcode_call_tool` | Выводит список всех сырых MCP-инструментов вашей версии Xcode (`action: "list"`) или вызывает любой сырой инструмент напрямую (`action: "call"`). | `action` (обязательный — `list`/`call`), `toolName`, `argumentsJson` |

## Поверхности отображения

- **Панель в правой боковой панели — «Xcode Workbench».** Открывается кнопкой **Open Workbench** в строке любого инструмента или из лончера **`+`** правой боковой панели (**Xcode Workbench**). Показывает живой значок подключения к Xcode + PID, версию/сборку Xcode, живую связь с устройством через `dsh-ios`, открытые окна рабочих областей (`tabIdentifier`), последние диагностики компилятора с метками файла/строки, последний результат сборки/тестов, миниатюры отрендеренных `#Preview` SwiftUI, синхронизированные Apple Skills и подключённые MCP-инструменты. Кнопки панели инструментов (**Refresh**, **Open Project**, **Diagnostics**, **Build Scheme**, **Sync Apple Skills**) выполняются через сессионную команду `/xcode`, не расходуя токены модели.
- **Компактные карточки в диалоге.** Вызовы инструментов (`xcode_status`, `xcode_open_project`, `xcode_diagnostics`, `xcode_build_test`, `xcode_render_preview`, `xcode_sync_skills`) отрисовывают компактные локализованные строки (`zh` / `en`), которые автоматически обновляют открытые вкладки Workbench по завершении вызова.

## Связка с DSH iOS (`@zseven-w/dsh-ios`)

`dsh-xcode` и [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios) **не имеют ни одной жёсткой зависимости** друг от друга — установите любой из них по отдельности или оба вместе. Когда оба загружены в один профиль DSH, они обнаруживают друг друга внутри процесса через `Symbol.for('zseven.dsh.apple.peer.v1')`:

- **Используйте `dsh-xcode` (`xcode_*`) для работы с IDE и компилятором** — диагностика одного файла за `< 1 s` во время редактирования файлов Swift/ObjC, тёплые инкрементальные сборки схемы и юнит-тесты, снимки SwiftUI `#Preview` для `.xcodeproj` / `.xcworkspace` и локальный поиск по документации Apple.
- **Используйте `dsh-ios` (`ios_sim_*`) для рантайма живых устройств и UI-автоматизации** — интерактивный MJPEG-видеострим Симулятора и настоящих iPhone, подключённых по USB, в боковой панели, деревья доступности AXe (`ios_sim_ui_tree`, `ios_sim_tap_element`, `ios_sim_ui_rows`), поиск/тап через Vision OCR (`ios_sim_find_text`, `ios_sim_tap_text`), единые логи рантайма (`ios_sim_logs`), бэктрейсы LLDB и `leaks`.
- **Умная маршрутизация между плагинами** — если агент вызывает `ios_sim_preview` (горячая перезагрузка dylib SwiftPM) для `.xcodeproj` / `.xcworkspace`, `dsh-ios` обнаруживает, что подключён `dsh-xcode`, и сразу направляет агента к `xcode_render_preview`.

## Безопасность и конфиденциальность

- **Только локальный XPC-транспорт** — `xcrun mcpbridge` общается исключительно с вашим локальным процессом Xcode по XPC macOS; плагин не открывает сетевых слушателей и не выполняет ни одного внешнего HTTP-запроса.
- **Очистка окружения** — перед запуском `xcrun mcpbridge` или `xcrun agent` функция `scrubEnvForMcpBridge` удаляет все переменные окружения, соответствующие `*KEY*`, `*SECRET*`, `*TOKEN*`, `*PASSWORD*` или `DSH_*`, пропуская только стандартные переменные разработчика/XPC macOS (`HOME`, `USER`, `PATH`, `TMPDIR`, `DEVELOPER_DIR`, `MCP_XCODE_PID`, `MCP_XCODE_SESSION_ID`).
- **Явное согласие пользователя в Xcode** — доступ внешних агентов контролируется собственным переключателем Xcode **Settings → Intelligence → Model Context Protocol** и системным диалогом разрешений macOS/Xcode.
- **Ограниченная обработка бинарных данных** — блоки изображений MCP перед декодированием проверяются на канонический base64 и жёсткий потолок в 20 МБ; сверхбольшие строки base64 внутри сырых JSON-полезных нагрузок вырезаются, чтобы контекст модели оставался чистым.

## Требования

- **macOS** с установленным **Xcode 26.3 или новее** (`xcode-select -p` указывает на `/Applications/Xcode.app/Contents/Developer`, а не на Command Line Tools).
- **DeepSeek Harness** `0.2.1-rc.5` или новее, Node.js `>= 24.11.0`.
- **Разовая настройка Xcode** — откройте **Xcode → Settings → Intelligence → Model Context Protocol** и включите **Allow External Agents** (подтвердите запрос разрешений Xcode при первом подключении).

## Установка в DSH

```sh
dsh plugin --profile web add @zseven-w/dsh-xcode@latest
dsh web
```

Добавьте `dsh-ios` для полного стриминга Симулятора + iPhone по USB в дополнение к инструментам IDE Xcode:

```sh
dsh plugin --profile web add @zseven-w/dsh-ios@latest
```

## Быстрый старт

1. **Проверьте статус и откройте проект** — *«Проверь статус Xcode и открой iOS-проект в этой папке.»* → `xcode_status` / `xcode_open_project`. При первом запуске подтвердите запрос Xcode о внешнем агенте.
2. **Отредактируйте и проверьте один файл за `< 1 s`** — *«Отрефактори `HomeView.swift` и проверь его на ошибки компилятора без полного билда.»* → `xcode_diagnostics` (`filePath: "Sources/HomeView.swift"`).
3. **Отрендерите `#Preview` SwiftUI** — *«Отрендери SwiftUI-превью `HomeView.swift` и проверь макет.»* → `xcode_render_preview`. Откройте **Xcode Workbench** в правой боковой панели, чтобы рассмотреть отрендеренные снимки.
4. **Поиск по документации Apple и запуск тестов** — *«Поищи в локальной документации Xcode про видимость колонок `NavigationSplitView`, затем запусти юнит-тесты.»* → `xcode_search_docs` → `xcode_build_test` (`action: "run_all_tests"`).

## Конфигурация

Необязательные параметры в разделе `plugins.dsh-xcode` файла `cordis.patch.yml`:

| Параметр | По умолчанию | Значение |
| --- | --- | --- |
| `xcodePid` | определяется автоматически | Явный PID запущенного Xcode (`MCP_XCODE_PID`), когда `Xcode.app` и `Xcode-beta.app` открыты одновременно. |
| `callTimeoutMs` | `180000` | Тайм-аут по умолчанию (мс) для длительных MCP-операций Xcode (`BuildProject`, `RunAllTests`, `RenderPreview`). |
| `autoSyncSkills` | `true` | Автоматически экспортирует и регистрирует встроенные пакеты `SKILL.md` Apple при подключении `xcode_status` или `xcode_open_project`. |
| `skillsCacheDir` | `~/.cache/dsh-xcode/skills` | Каталог, в котором экспортированные пакеты `SKILL.md` Apple кэшируются по номеру сборки Xcode. |

## Устранение неполадок

- **Ошибка `xcrun could not find mcpbridge` / связанная с Command Line Tools** — `xcode-select -p` указывает на `/Library/Developer/CommandLineTools` или на старый Xcode (< 26.3). Переключитесь на полный Xcode 26.3+: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.
- **`Could not establish MCP tool session with Xcode`** — убедитесь, что в Xcode открыто хотя бы одно окно проекта/рабочей области (`xcode_open_project`), включите **Xcode → Settings → Intelligence → Model Context Protocol → Allow External Agents** и нажмите **Allow**, если Xcode показывает в фоне диалог авторизации агента.
- **Запущено несколько экземпляров Xcode** — `dsh-xcode` автоматически выбирает PID, совпадающий с `xcode-select -p`; если открыты две копии одного бандла, передайте `xcodePid` в конфигурации или задайте `DSHPLUGIN_XCODE_PID=<pid>`.
- **Макрос `#Preview` падает на нестандартной конфигурации таргета** — движку превью Xcode иногда не удаётся вывести форм-фактор для сложных макросов `#Preview`; добавление стандартной структуры `PreviewProvider` в файл надёжно работает с `xcode_render_preview`.

## Разработка

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run smoke:pack
```

Подключите локальный чекаут в профиль DSH Web:

```sh
dsh plugin --profile web add link:/path/to/dsh-xcode
dsh web
```

| Набор тестов | Что покрывает |
| --- | --- |
| `test/mcp-stdio.test.mjs` | Рукопожатие STDIO JSON-RPC, постраничный `tools/list`, восстановление пропущенного в Xcode 26 `structuredContent`, каноническое декодирование PNG, вырезание base64, очистка окружения, классификация ошибок. |
| `test/env-and-bridge.test.mjs` | Фильтрация процессов Xcode и Симулятора через `ps`, правила выбора PID, обнаружение `.xcworkspace`/`.xcodeproj`/`Package.swift`, автоподстановка `tabIdentifier`, сохранение состояния диагностики/сборки/превью, экспорт `SKILL.md` и жизненный цикл `apply()` хоста. |
| `test/client-bundle.test.mjs` | Структура бандла `window.__ModuleLoader__.load`, инвариант внешнего host-React, парность локалей `zh`/`en`, кодировка адресов ресурсов Workbench, регистрация слотов и вкладок. |
| `test/ios-peer-linkage.test.mjs` | Живое межплагинное обнаружение через `Symbol.for('zseven.dsh.apple.peer.v1')` вместе с `@zseven-w/dsh-ios` и умная маршрутизация `.xcodeproj` → `xcode_render_preview`. |

## Экосистема

- [DSH iOS Simulator](https://github.com/ZSeven-W/dsh-ios) — живой интерактивный стриминг iOS-Симулятора и настоящих iPhone по USB, AXe-деревья UI, Vision OCR и горячая перезагрузка превью SwiftPM
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — живой эмулятор Android или USB-устройство прямо внутри диалога, полностью управляемое через `adb`
- [DSH Computer](https://github.com/ZSeven-W/dsh-computer) — драйвер Computer Use для macOS в headless-first-стиле с AX-first-наблюдениями и одобрением на стороне хоста
- [DSH Browser](https://github.com/ZSeven-W/dsh-browser) — изолированные сессии Chromium с семантическими ссылками и ограниченными доказательствами
- [DSH QA](https://github.com/ZSeven-W/dsh-qa) — исследование под руководством агента и детерминированное воспроизведение сценариев между Browser, Desktop, iOS и Android
- [DSH Game Studio](https://github.com/ZSeven-W/dsh-game-studio) — опишите 2D- или 3D-воксельную игру одним предложением, играйте в неё на боковой панели, подключайте ИИ-графику и публикуйте в один клик
- [DSH Harbor](https://github.com/ZSeven-W/dsh-harbor) — инвентаризация возможностей, обнаружение конфликтов и предпроверка обновления DSH для установленных плагинов
- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — отправка задач агентам DSH из Claude Code / Codex как нативные субагенты
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — надёжная, инспектируемая долговременная память агентов для DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — предпросмотр, инспекция и редактирование дизайн-документов `.op` OpenPencil внутри диалогов DSH

## Лицензия

MIT © ZSeven-W
