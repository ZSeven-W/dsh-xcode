<p align="center">
  <img src="./docs/images/dsh-xcode-logo.png" alt="DSH Xcode" width="120" />
</p>

<h1 align="center">DSH Xcode</h1>

<p align="center">
  <strong>A ponte MCP oficial do Xcode da Apple (<code>xcrun mcpbridge</code>) e as Apple Skills integradas dentro de uma conversa do <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> — pareada sem costuras com o <a href="https://github.com/ZSeven-W/dsh-ios">DSH iOS</a>.</strong><br />
  <sub>8 ferramentas de agente &bull; diagnóstico do compilador em arquivo único em &lt; 1 s &bull; snapshots nativos de <code>#Preview</code> do SwiftUI &bull; builds &amp; testes de esquema a quente &bull; busca local na documentação da Apple &bull; Workbench na barra lateral direita</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-xcode</code> &middot; Versão atual do plugin: <code>0.1.0-rc.4</code> &middot; Testado com DSH <code>0.2.1-rc.5</code></sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <b>Português</b> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-xcode/actions/workflows/check.yml"><img src="https://img.shields.io/github/actions/workflow/status/ZSeven-W/dsh-xcode/check.yml?label=CI" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@zseven-w/dsh-xcode"><img src="https://img.shields.io/npm/v/@zseven-w/dsh-xcode?color=1a78f2" alt="npm" /></a>
  <a href="https://github.com/ZSeven-W/dsh-xcode/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-xcode?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-xcode-banner.png" alt="DSH Xcode — Ponte MCP oficial do Xcode &amp; Apple Skills dentro do DeepSeek Harness" width="100%" />
</p>

## Por que usar o DSH Xcode

A partir do Xcode 26.3, a Apple inclui uma ponte oficial de Model Context Protocol (`xcrun mcpbridge`) sobre XPC local, além de pacotes de agente próprios em `SKILL.md` (`xcrun agent skills export`). Conectar o `xcrun mcpbridge` cru diretamente a um agente de programação genérico, porém, esbarra em três muros práticos:

1. **Divergência de `structuredContent` no Xcode 26** — ferramentas como `XcodeListWindows` declaram um `outputSchema` em `tools/list`, mas devolvem o JSON dentro de `content[0].text` e omitem o `structuredContent`, fazendo com que clientes rigorosos do SDK de MCP rejeitem respostas válidas.
2. **Ciclo de vida do processo e roteamento de PID com vários Xcodes** — o `mcpbridge` encerra imediatamente quando o Xcode é fechado, quando `Xcode.app` e `Xcode-beta.app` estão em execução ao mesmo tempo, ou antes que o acesso de agentes externos seja ativado em **Xcode → Settings → Intelligence**.
3. **Inchaço de contexto** — o Xcode expõe 20+ ferramentas granulares e emite strings PNG em base64 de vários megabytes a partir de `RenderPreview`.

O `DSH Xcode` encapsula a ponte oficial da Apple em um plugin nativo do DeepSeek Harness sem dependências, com um Workbench integrado na barra lateral direita e descoberta de pares sem acoplamento junto ao [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios).

| | |
| --- | --- |
| ⚡ **Diagnóstico de arquivo único em &lt; 1 s** | `xcode_diagnostics` com `filePath` chama `XcodeRefreshCodeIssuesInFile` contra o grafo do compilador ativo do Xcode — verifica edições de Swift/ObjC em menos de um segundo sem disparar execuções frias de `xcodebuild`. |
| 🖼️ **Snapshots nativos de `#Preview` do SwiftUI** | `xcode_render_preview` aciona o próprio motor `RenderPreview` do Xcode em `.xcodeproj`, `.xcworkspace` e pacotes Swift, grava PNGs em `.dsh-xcode/previews/` e anexa as imagens diretamente quando há modelos multimodais ativos. |
| 🔨 **Builds e testes incrementais a quente** | `xcode_build_test` reutiliza o grafo de build aquecido do DerivedData do Xcode para `BuildProject`, `GetBuildLog`, `GetTestList`, `RunAllTests` e `RunSomeTests` (XCTest &amp; Swift Testing). |
| 🔧 **Normalização de protocolo do Xcode 26** | Hidrata automaticamente o `structuredContent` omitido a partir de blocos de texto JSON, resolve o `tabIdentifier` entre várias janelas de workspace abertas e remove strings base64 grandes demais dos resumos JSON. |
| 📘 **Sincronização oficial dos `SKILL.md` da Apple** | Executa `xcrun agent skills export`, analisa os pacotes `SKILL.md` integrados da Apple para a sua compilação exata do Xcode, guarda-os em cache em `~/.cache/dsh-xcode/skills/` e os registra dinamicamente em `ctx.skills`. |
| 🪟 **Workbench do Xcode na barra lateral direita** | Pílula de status de conexão ao vivo, janelas de workspace abertas com seus `tabIdentifier`s, lista de diagnósticos do compilador, resumo de build/testes, galeria de `#Preview` do SwiftUI renderizados e status do dispositivo par do `dsh-ios`. |
| 📱 **Pareado com o `dsh-ios`** | Zero acoplamento no momento da instalação via `Symbol.for('zseven.dsh.apple.peer.v1')`: o `dsh-xcode` cuida da inteligência do compilador do IDE enquanto o `dsh-ios` transmite e controla ao vivo Simuladores &amp; iPhones conectados por USB. |
| 🧭 **Saída de emergência à prova de futuro** | `xcode_call_tool` lista e invoca qualquer ferramenta `mcpbridge` crua (`ExecuteSnippet`, `XcodeUpdate`, `XcodeGlob` ou as `DeviceInteraction*` do Xcode 27+) sem esperar por uma atualização do plugin. |

## Ferramentas

Todas as 8 ferramentas se registram em qualquer host, resolvem automaticamente o `tabIdentifier` a partir do workspace ativo quando ele é omitido e degradam com instruções acionáveis de configuração em hosts que não são macOS ou quando o Xcode está fechado.

| Ferramenta | O que faz | Parâmetros principais |
| --- | --- | --- |
| `xcode_status` | Inspeciona o diretório de desenvolvedor ativo do `xcode-select`, a versão/build do Xcode, as capacidades de `xcrun mcpbridge` &amp; `agent`, os PIDs do `Xcode.app` em execução, as janelas de workspace abertas (os `tabIdentifier`s), as skills da Apple sincronizadas e o status do par `dsh-ios`. | `connect` (padrão `true`) |
| `xcode_open_project` | Detecta e abre automaticamente um `.xcworkspace`, `.xcodeproj` ou `Package.swift` no Xcode (`open -a Xcode`) e então faz polling até o `mcpbridge` conectar e reportar o `tabIdentifier` da janela. | `projectPath` (opcional), `waitSeconds` (padrão `20`) |
| `xcode_diagnostics` | Lê ao vivo erros e avisos do compilador do Xcode. Passe `filePath` para verificação de tipos de arquivo único em `< 1 s` (`XcodeRefreshCodeIssuesInFile`) ou omita o `filePath` para os diagnósticos de todo o workspace do Issue Navigator (`XcodeListNavigatorIssues`). | `filePath`, `projectPath`, `tabIdentifier`, `severity` (`error`/`warning`/`remark`), `pattern` |
| `xcode_build_test` | Compila o esquema ativo, inspeciona logs de build filtrados, ou lista/executa suites de XCTest &amp; Swift Testing dentro do grafo de build aquecido do Xcode. | `action` (obrigatório — `build`/`build_log`/`list_tests`/`run_all_tests`/`run_some_tests`), `tests` (array JSON), `severity`, `pattern` |
| `xcode_render_preview` | Renderiza nativamente no Xcode um snapshot de `#Preview` ou `PreviewProvider` do SwiftUI, salva o PNG em `.dsh-xcode/previews/` para a galeria do Workbench e o anexa ao contexto de modelos multimodais. | `sourceFilePath` (obrigatório), `previewDefinitionIndexInFile` (padrão `0`), `projectPath`, `tabIdentifier` |
| `xcode_search_docs` | Busca semântica na documentação do Apple Developer e nas transcrições das sessões da WWDC integradas ao Xcode (`DocumentationSearch`). | `query` (obrigatório), `frameworks` (lista opcional separada por vírgulas, p. ex. `"SwiftUI,Observation"`) |
| `xcode_sync_skills` | Exporta os pacotes `SKILL.md` oficiais da Apple a partir do app do Xcode ativo via `xcrun agent skills export` e os registra na sessão atual do DSH. | — |
| `xcode_call_tool` | Lista todas as ferramentas MCP cruas expostas pela sua versão do Xcode (`action: "list"`) ou invoca qualquer ferramenta crua diretamente (`action: "call"`). | `action` (obrigatório — `list`/`call`), `toolName`, `argumentsJson` |

## Superfícies de exibição

- **Painel da barra lateral direita — “Xcode Workbench”.** Abre pelo botão **Open Workbench** em qualquer linha de ferramenta ou pelo lançador **`+`** da barra lateral direita (**Xcode Workbench**). Exibe o selo de conexão ao vivo com o Xcode + PID, a versão/build do Xcode, o link do dispositivo ao vivo do `dsh-ios`, as janelas de workspace abertas (`tabIdentifier`s), os diagnósticos mais recentes do compilador com selos de arquivo/linha, o resultado mais recente de build/testes, as miniaturas de `#Preview` do SwiftUI renderizadas, as Apple Skills sincronizadas e as ferramentas MCP montadas. Os botões da barra de ferramentas (**Refresh**, **Open Project**, **Diagnostics**, **Build Scheme**, **Sync Apple Skills**) rodam por meio do comando de sessão `/xcode` sem gastar tokens do modelo.
- **Cartões compactos na conversa.** As chamadas de ferramentas (`xcode_status`, `xcode_open_project`, `xcode_diagnostics`, `xcode_build_test`, `xcode_render_preview`, `xcode_sync_skills`) renderizam linhas compactas localizadas (`zh` / `en`) que atualizam automaticamente as abas abertas do Workbench quando uma chamada conclui.

## Pareamento com DSH iOS (`@zseven-w/dsh-ios`)

O `dsh-xcode` e o [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios) **não têm nenhuma dependência rígida** um do outro — instale qualquer um sozinho ou os dois juntos. Quando ambos estão carregados no mesmo perfil do DSH, eles se descobrem no mesmo processo por meio de `Symbol.for('zseven.dsh.apple.peer.v1')`:

- **Use `dsh-xcode` (`xcode_*`) para trabalho de IDE e compilador** — diagnóstico de arquivo único em `< 1 s` enquanto você edita arquivos Swift/ObjC, builds incrementais a quente do esquema e testes de unidade, snapshots de `#Preview` do SwiftUI para `.xcodeproj` / `.xcworkspace` e consulta local à documentação da Apple.
- **Use `dsh-ios` (`ios_sim_*`) para o runtime de dispositivos ao vivo e automação de UI** — streaming de vídeo MJPEG interativo do Simulador e de iPhones reais conectados por USB na barra lateral, árvores de acessibilidade AXe (`ios_sim_ui_tree`, `ios_sim_tap_element`, `ios_sim_ui_rows`), localizar/tocar com Vision OCR (`ios_sim_find_text`, `ios_sim_tap_text`), logs unificados de runtime (`ios_sim_logs`), backtraces do LLDB e `leaks`.
- **Roteamento inteligente entre plugins** — se um agente chama `ios_sim_preview` (hot-reload de dylib do SwiftPM) em um `.xcodeproj` / `.xcworkspace`, o `dsh-ios` detecta que o `dsh-xcode` está montado e direciona o agente direto para `xcode_render_preview`.

## Segurança e privacidade

- **Somente transporte XPC local** — o `xcrun mcpbridge` se comunica exclusivamente com o seu processo local do Xcode por XPC do macOS; o plugin não abre escutas de rede nem faz nenhuma requisição HTTP externa.
- **Limpeza do ambiente** — antes de lançar `xcrun mcpbridge` ou `xcrun agent`, o `scrubEnvForMcpBridge` remove qualquer variável de ambiente que corresponda a `*KEY*`, `*SECRET*`, `*TOKEN*`, `*PASSWORD*` ou `DSH_*`, passando apenas as variáveis padrão de desenvolvedor/XPC do macOS (`HOME`, `USER`, `PATH`, `TMPDIR`, `DEVELOPER_DIR`, `MCP_XCODE_PID`, `MCP_XCODE_SESSION_ID`).
- **Consentimento explícito do usuário no Xcode** — o acesso de agentes externos é controlado pelo próprio interruptor do Xcode **Settings → Intelligence → Model Context Protocol** e pelo diálogo de permissões do macOS/Xcode.
- **Manipulação binária limitada** — os blocos de imagem MCP são verificados quanto a base64 canônico e um teto estrito de 20 MB antes da decodificação; strings base64 grandes demais dentro de payloads JSON crus são removidas para manter o contexto do modelo limpo.

## Requisitos

- **macOS** com o **Xcode 26.3 ou posterior** instalado (`xcode-select -p` apontando para `/Applications/Xcode.app/Contents/Developer`, e não para as Command Line Tools).
- **DeepSeek Harness** `0.2.1-rc.5` ou superior, Node.js `>= 24.11.0`.
- **Configuração única do Xcode** — abra **Xcode → Settings → Intelligence → Model Context Protocol** e ative **Allow External Agents** (aprove o pedido de permissão do Xcode na primeira conexão).

## Instalar no DSH

```sh
dsh plugin --profile web add @zseven-w/dsh-xcode@latest
dsh web
```

Pareie com o `dsh-ios` para ter streaming completo de Simulador + iPhone por USB junto com as ferramentas de IDE do Xcode:

```sh
dsh plugin --profile web add @zseven-w/dsh-ios@latest
```

## Início rápido

1. **Verifique o status e abra seu projeto** — *"Verifique o status do Xcode e abra o projeto de iOS nesta pasta."* → `xcode_status` / `xcode_open_project`. Aprove o aviso de agente externo do Xcode se for a sua primeira execução.
2. **Edite e verifique um único arquivo em `< 1 s`** — *"Refatore o `HomeView.swift` e verifique se há erros de compilador sem rodar um build completo."* → `xcode_diagnostics` (`filePath: "Sources/HomeView.swift"`).
3. **Renderize um `#Preview` do SwiftUI** — *"Renderize a prévia do SwiftUI de `HomeView.swift` e verifique o layout."* → `xcode_render_preview`. Abra o **Xcode Workbench** na barra lateral direita para inspecionar os snapshots renderizados.
4. **Busque na documentação da Apple e rode os testes** — *"Pesquise na documentação local do Xcode a visibilidade de colunas do `NavigationSplitView` e depois execute os testes de unidade."* → `xcode_search_docs` → `xcode_build_test` (`action: "run_all_tests"`).

## Configuração

Configurações opcionais sob `plugins.dsh-xcode` no `cordis.patch.yml`:

| Opção | Padrão | Significado |
| --- | --- | --- |
| `xcodePid` | resolvido automaticamente | PID explícito do Xcode em execução (`MCP_XCODE_PID`) quando `Xcode.app` e `Xcode-beta.app` estão abertos ao mesmo tempo. |
| `callTimeoutMs` | `180000` | Tempo limite (ms) padrão para operações MCP de longa duração do Xcode (`BuildProject`, `RunAllTests`, `RenderPreview`). |
| `autoSyncSkills` | `true` | Exporta e registra automaticamente os pacotes `SKILL.md` integrados da Apple quando `xcode_status` ou `xcode_open_project` conecta. |
| `skillsCacheDir` | `~/.cache/dsh-xcode/skills` | Diretório onde os pacotes `SKILL.md` exportados da Apple ficam em cache por número de build do Xcode. |

## Solução de problemas

- **Erro `xcrun could not find mcpbridge` / Command Line Tools** — o `xcode-select -p` está apontando para `/Library/Developer/CommandLineTools` ou para um Xcode antigo (< 26.3). Mude para o Xcode 26.3+ completo: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.
- **`Could not establish MCP tool session with Xcode`** — certifique-se de que pelo menos uma janela de projeto/workspace esteja aberta no Xcode (`xcode_open_project`), ative **Xcode → Settings → Intelligence → Model Context Protocol → Allow External Agents** e clique em **Allow** se o Xcode estiver exibindo em segundo plano um diálogo de autorização de agente.
- **Várias instâncias do Xcode em execução** — o `dsh-xcode` escolhe automaticamente o PID que corresponde ao `xcode-select -p`; se duas cópias do mesmo bundle estiverem abertas, passe `xcodePid` na configuração ou defina `DSHPLUGIN_XCODE_PID=<pid>`.
- **A macro `#Preview` falha em uma configuração de target personalizada** — o motor de prévias do Xcode ocasionalmente tem dificuldade para inferir um fator de forma em macros `#Preview` complexas; adicionar um struct `PreviewProvider` padrão no arquivo funciona de forma confiável com `xcode_render_preview`.

## Desenvolvimento

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run smoke:pack
```

Vincule um checkout local ao seu perfil do DSH Web:

```sh
dsh plugin --profile web add link:/path/to/dsh-xcode
dsh web
```

| Suite | O que cobre |
| --- | --- |
| `test/mcp-stdio.test.mjs` | Handshake STDIO JSON-RPC, `tools/list` paginado, hidratação do `structuredContent` omitido do Xcode 26, decodificação canônica de PNG, remoção de base64, limpeza do ambiente, classificação de erros. |
| `test/env-and-bridge.test.mjs` | Filtragem com `ps` de processos Xcode vs Simulador, regras de seleção de PID, descoberta de `.xcworkspace`/`.xcodeproj`/`Package.swift`, auto-resolução do `tabIdentifier`, persistência do estado de diagnóstico/build/preview, exportação de `SKILL.md` &amp; ciclo de vida do `apply()` do Host. |
| `test/client-bundle.test.mjs` | Formato do bundle de `window.__ModuleLoader__.load`, invariante do React do host externalizado, paridade de locales `zh`/`en`, codificação de endereços de recursos do Workbench, registro de slots &amp; abas. |
| `test/ios-peer-linkage.test.mjs` | Descoberta cruzada ao vivo entre plugins via `Symbol.for('zseven.dsh.apple.peer.v1')` com `@zseven-w/dsh-ios` e roteamento inteligente de `.xcodeproj` → `xcode_render_preview`. |

## Ecossistema

- [DSH iOS Simulator](https://github.com/ZSeven-W/dsh-ios) — streaming interativo ao vivo do Simulador de iOS &amp; de iPhones reais conectados por USB, árvores de UI AXe, OCR com Vision e hot reload de preview do SwiftPM
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — um emulador de Android ou dispositivo USB ao vivo dentro da conversa, controlado inteiramente por `adb`
- [DSH Computer](https://github.com/ZSeven-W/dsh-computer) — driver de Computer Use do macOS com prioridade ao modo headless, observações AX-first e aprovação pelo host
- [DSH Browser](https://github.com/ZSeven-W/dsh-browser) — sessões isoladas do Chromium com referências semânticas e evidência delimitada
- [DSH QA](https://github.com/ZSeven-W/dsh-qa) — exploração conduzida pelo agente e replay determinístico de cenários entre Browser, Desktop, iOS &amp; Android
- [DSH Game Studio](https://github.com/ZSeven-W/dsh-game-studio) — descreva um jogo de voxels 2D ou 3D em uma frase, jogue-o na barra lateral, troque por arte de IA e publique em um clique
- [DSH Harbor](https://github.com/ZSeven-W/dsh-harbor) — inventário de capacidades, detecção de conflitos e preflight de atualização do DSH para os plugins instalados
- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — envie trabalho para agentes do DSH a partir do Claude Code / Codex como subagentes nativos
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — memória de agente de longo prazo, durável e inspecionável, para o DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — pré-visualize, inspecione e edite documentos de design `.op` do OpenPencil dentro de conversas do DSH

## Licença

MIT © ZSeven-W
