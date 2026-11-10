<p align="center">
  <img src="./docs/images/dsh-xcode-logo.png" alt="DSH Xcode" width="120" />
</p>

<h1 align="center">DSH Xcode</h1>

<p align="center">
  <strong>Le pont MCP officiel d'Apple pour Xcode (<code>xcrun mcpbridge</code>) et les Apple Skills intégrées au cœur d'une conversation <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> — en binôme avec <a href="https://github.com/ZSeven-W/dsh-ios">DSH iOS</a>.</strong><br />
  <sub>8 outils d'agent &bull; diagnostics du compilateur en moins d'une seconde sur un seul fichier &bull; instantanés SwiftUI <code>#Preview</code> natifs &bull; builds et tests de scheme à chaud &bull; recherche locale dans la doc Apple &bull; Xcode Workbench dans la barre latérale droite</sub>
</p>

<p align="center">
  <sub>npm : <code>@zseven-w/dsh-xcode</code> &middot; Version actuelle du plugin : <code>0.1.0-rc.2</code> &middot; Testé avec DSH <code>0.2.1-rc.5</code></sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <b>Français</b> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-xcode/actions/workflows/check.yml"><img src="https://img.shields.io/github/actions/workflow/status/ZSeven-W/dsh-xcode/check.yml?label=CI" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@zseven-w/dsh-xcode"><img src="https://img.shields.io/npm/v/@zseven-w/dsh-xcode?color=1a78f2" alt="npm" /></a>
  <a href="https://github.com/ZSeven-W/dsh-xcode/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-xcode?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-xcode-banner.png" alt="DSH Xcode — pont MCP Xcode officiel et Apple Skills au cœur de DeepSeek Harness" width="100%" />
</p>

## Pourquoi DSH Xcode

Depuis Xcode 26.3, Apple livre un pont Model Context Protocol officiel (`xcrun mcpbridge`) au-dessus de XPC local, ainsi que des bundles d'agents `SKILL.md` de première partie (`xcrun agent skills export`). Mais câbler `xcrun mcpbridge` brut directement sur un agent de codage générique se heurte à trois murs bien concrets :

1. **Décalage `structuredContent` dans Xcode 26** — des outils comme `XcodeListWindows` déclarent un `outputSchema` dans `tools/list` tout en renvoyant leur JSON dans `content[0].text` sans `structuredContent`, ce qui pousse les clients MCP SDK stricts à rejeter des réponses pourtant valides.
2. **Cycle de vie des processus et routage PID entre plusieurs Xcode** — `mcpbridge` quitte immédiatement quand Xcode est fermé, quand `Xcode.app` et `Xcode-beta.app` tournent en même temps, ou avant que l'accès aux agents externes soit activé dans **Xcode → Settings → Intelligence**.
3. **Gonflement du contexte** — Xcode expose une vingtaine d'outils granulaires et `RenderPreview` émet des chaînes PNG base64 de plusieurs mégaoctets.

`DSH Xcode` encapsule le pont officiel d'Apple en un plugin DeepSeek Harness natif sans aucune dépendance, avec un Workbench intégré dans la barre latérale droite et une découverte des pairs sans couplage aux côtés de [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios).

| | |
| --- | --- |
| ⚡ **Diagnostics mono-fichier en moins d'une seconde** | `xcode_diagnostics` avec `filePath` appelle `XcodeRefreshCodeIssuesInFile` sur le graphe de compilateur vivant de Xcode — vérifiez vos éditions Swift/ObjC en moins d'une seconde, sans lancer de `xcodebuild` à froid. |
| 🖼️ **Instantanés SwiftUI `#Preview` natifs** | `xcode_render_preview` pilote le moteur `RenderPreview` de Xcode lui-même sur `.xcodeproj`, `.xcworkspace` et les packages Swift, écrit les PNG dans `.dsh-xcode/previews/` et joint directement les images quand des modèles multimodaux sont actifs. |
| 🔨 **Builds et tests incrémentaux à chaud** | `xcode_build_test` réutilise le graphe de build DerivedData chaud de Xcode pour `BuildProject`, `GetBuildLog`, `GetTestList`, `RunAllTests` et `RunSomeTests` (XCTest &amp; Swift Testing). |
| 🔧 **Normalisation du protocole Xcode 26** | Réhydrate automatiquement le `structuredContent` omis à partir des blocs de texte JSON, résout le `tabIdentifier` entre plusieurs fenêtres de workspace ouvertes et retire les chaînes base64 surdimensionnées des résumés JSON. |
| 📘 **Synchronisation des `SKILL.md` officiels d'Apple** | Exécute `xcrun agent skills export`, analyse les bundles `SKILL.md` intégrés d'Apple pour votre build exact de Xcode, les met en cache sous `~/.cache/dsh-xcode/skills/` et les enregistre dynamiquement dans `ctx.skills`. |
| 🪟 **Xcode Workbench dans la barre latérale droite** | Pilule d'état de connexion en direct, fenêtres de workspace ouvertes avec leurs `tabIdentifier`, liste des diagnostics du compilateur, résumé build/test, galerie des `#Preview` SwiftUI rendus et état des appareils pairs `dsh-ios`. |
| 📱 **En binôme avec `dsh-ios`** | Zéro couplage à l'installation via `Symbol.for('zseven.dsh.apple.peer.v1')` : `dsh-xcode` gère l'intelligence de compilation de l'IDE pendant que `dsh-ios` diffuse et pilote les Simulateurs en direct &amp; les iPhones connectés en USB. |
| 🧭 **Soupape pour l'avenir** | `xcode_call_tool` liste et invoque n'importe quel outil `mcpbridge` brut (`ExecuteSnippet`, `XcodeUpdate`, ou `DeviceInteraction*` de Xcode 27+) sans attendre une mise à jour du plugin. |

## Outils

Les 8 outils s'enregistrent sur tous les hôtes, résolvent automatiquement le `tabIdentifier` depuis le workspace actif quand il est omis, et se dégradent avec des instructions de configuration exploitables sur les hôtes non-macOS ou quand Xcode est fermé.

| Outil | Ce qu'il fait | Paramètres clés |
| --- | --- | --- |
| `xcode_status` | Inspecte le répertoire développeur `xcode-select` actif, la version/build de Xcode, les capacités `xcrun mcpbridge` &amp; `agent`, les PID des `Xcode.app` en cours d'exécution, les fenêtres de workspace ouvertes (`tabIdentifier`s), les Apple skills synchronisés et l'état du pair `dsh-ios`. | `connect` (par défaut `true`) |
| `xcode_open_project` | Détecte et ouvre automatiquement un `.xcworkspace`, `.xcodeproj` ou `Package.swift` dans Xcode (`open -a Xcode`), puis interroge en boucle jusqu'à ce que `mcpbridge` se connecte et rapporte le `tabIdentifier` de la fenêtre. | `projectPath` (facultatif), `waitSeconds` (par défaut `20`) |
| `xcode_diagnostics` | Lit les erreurs et avertissements du compilateur en direct depuis Xcode. Passez `filePath` pour un typecheck mono-fichier en `&lt; 1 s` (`XcodeRefreshCodeIssuesInFile`), ou omettez-le pour les diagnostics du Navigateur d'issues sur tout le workspace (`XcodeListNavigatorIssues`). | `filePath`, `projectPath`, `tabIdentifier`, `severity` (`error`/`warning`/`remark`), `pattern` |
| `xcode_build_test` | Build le scheme actif, inspecte les logs de build filtrés, ou liste/exécute les suites XCTest &amp; Swift Testing dans le graphe de build chaud de Xcode. | `action` (requis — `build`/`build_log`/`list_tests`/`run_all_tests`/`run_some_tests`), `tests` (tableau JSON), `severity`, `pattern` |
| `xcode_render_preview` | Rend nativement dans Xcode un instantané SwiftUI `#Preview` ou `PreviewProvider`, enregistre le PNG sous `.dsh-xcode/previews/` pour la galerie du Workbench et le joint au contexte du modèle multimodal. | `sourceFilePath` (requis), `previewDefinitionIndexInFile` (par défaut `0`), `projectPath`, `tabIdentifier` |
| `xcode_search_docs` | Recherche sémantique dans la documentation Apple Developer intégrée à Xcode et les transcriptions de sessions WWDC (`DocumentationSearch`). | `query` (requis), `frameworks` (liste facultative séparée par des virgules, p. ex. `"SwiftUI,Observation"`) |
| `xcode_sync_skills` | Exporte les bundles `SKILL.md` officiels d'Apple depuis l'app Xcode active via `xcrun agent skills export` et les enregistre dans la session DSH courante. | — |
| `xcode_call_tool` | Liste tous les outils MCP bruts exposés par votre version de Xcode (`action: "list"`) ou invoque n'importe quel outil brut directement (`action: "call"`). | `action` (requis — `list`/`call`), `toolName`, `argumentsJson` |

## Surfaces d'affichage

- **Panneau latéral droit — « Xcode Workbench ».** S'ouvre depuis le bouton **Open Workbench** d'une ligne d'outil ou depuis le lanceur **`+`** de la barre latérale droite (**Xcode Workbench**). Affiche le badge de connexion Xcode en direct + PID, la version/build de Xcode, le lien appareil `dsh-ios` en direct, les fenêtres de workspace ouvertes (`tabIdentifier`s), les derniers diagnostics du compilateur avec badges fichier/ligne, le dernier résultat de build/test, les vignettes SwiftUI `#Preview` rendues, les Apple Skills synchronisés et les outils MCP montés. Les boutons de la barre d'outils (**Refresh**, **Open Project**, **Diagnostics**, **Build Scheme**, **Sync Apple Skills**) passent par la commande de session `/xcode` sans consommer de jetons du modèle.
- **Cartes de conversation compactes.** Les appels d'outils (`xcode_status`, `xcode_open_project`, `xcode_diagnostics`, `xcode_build_test`, `xcode_render_preview`, `xcode_sync_skills`) s'affichent en lignes localisées compactes (`zh` / `en`) qui rafraîchissent automatiquement les onglets du Workbench ouverts quand un appel se termine.

## En binôme avec DSH iOS (`@zseven-w/dsh-ios`)

`dsh-xcode` et [`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios) n'ont **aucune dépendance forte** l'un envers l'autre — installez l'un, l'autre, ou les deux. Quand les deux sont chargés dans le même profil DSH, ils se découvrent en processus via `Symbol.for('zseven.dsh.apple.peer.v1')` :

- **`dsh-xcode` (`xcode_*`) pour l'IDE et le compilateur** — diagnostics mono-fichier en moins d'une seconde pendant l'édition de fichiers Swift/ObjC, builds et tests unitaires incrémentaux à chaud du scheme actif, instantanés SwiftUI `#Preview` pour `.xcodeproj` / `.xcworkspace`, et consultation de la documentation Apple en local.
- **`dsh-ios` (`ios_sim_*`) pour l'exécution sur appareil et l'automatisation UI** — streaming vidéo MJPEG en direct du Simulateur et d'un iPhone réel connecté en USB dans la barre latérale, arbres d'accessibilité AXe (`ios_sim_ui_tree`, `ios_sim_tap_element`, `ios_sim_ui_rows`), recherche/tap par Vision OCR (`ios_sim_find_text`, `ios_sim_tap_text`), journaux d'exécution unifiés (`ios_sim_logs`), backtraces LLDB et `leaks`.
- **Routage inter-plugins intelligent** — si un agent appelle `ios_sim_preview` (hot-reload de dylib SwiftPM) sur un `.xcodeproj` / `.xcworkspace`, `dsh-ios` détecte que `dsh-xcode` est monté et dirige l'agent droit vers `xcode_render_preview`.

## Sécurité et confidentialité

- **Transport XPC local uniquement** — `xcrun mcpbridge` communique exclusivement avec votre processus Xcode local via XPC macOS ; le plugin n'ouvre aucun écouteur réseau et n'émet aucune requête HTTP externe.
- **Nettoyage de l'environnement** — avant de lancer `xcrun mcpbridge` ou `xcrun agent`, `scrubEnvForMcpBridge` retire toute variable d'environnement correspondant à `*KEY*`, `*SECRET*`, `*TOKEN*`, `*PASSWORD*` ou `DSH_*`, en ne transmettant que les variables standard de développement macOS/XPC (`HOME`, `USER`, `PATH`, `TMPDIR`, `DEVELOPER_DIR`, `MCP_XCODE_PID`, `MCP_XCODE_SESSION_ID`).
- **Consentement explicite de l'utilisateur dans Xcode** — l'accès des agents externes est verrouillé par le commutateur **Settings → Intelligence → Model Context Protocol** de Xcode lui-même et par le dialogue de permission macOS/Xcode.
- **Traitement binaire borné** — les blocs d'images MCP sont vérifiés contre le base64 canonique et un plafond strict de 20 Mo avant décodage ; les chaînes base64 surdimensionnées dans les payloads JSON bruts sont retirées afin que le contexte du modèle reste propre.

## Prérequis

- **macOS** avec **Xcode 26.3 ou ultérieur** installé (`xcode-select -p` pointant vers `/Applications/Xcode.app/Contents/Developer`, et non les Command Line Tools).
- **DeepSeek Harness** `0.2.1-rc.5` ou ultérieur, Node.js `>= 24.11.0`.
- **Réglage Xcode à faire une fois** — ouvrez **Xcode → Settings → Intelligence → Model Context Protocol** et activez **Allow External Agents** (approuvez l'invite de permission de Xcode à la première connexion).

## Installer dans DSH

```sh
dsh plugin --profile web add @zseven-w/dsh-xcode@latest
dsh web
```

Associez `dsh-ios` pour le streaming complet Simulateur + iPhone USB aux côtés des outils IDE Xcode :

```sh
dsh plugin --profile web add @zseven-w/dsh-ios@latest
```

## Démarrage rapide

1. **Vérifier l'état et ouvrir le projet** — *« Vérifie l'état de Xcode et ouvre le projet iOS de ce dossier. »* → `xcode_status` / `xcode_open_project`. Approuvez l'invite d'agent externe de Xcode s'il s'agit de la première exécution.
2. **Éditer et vérifier un fichier en `&lt; 1 s`** — *« Refactore `HomeView.swift` et vérifie les erreurs de compilation sans lancer un build complet. »* → `xcode_diagnostics` (`filePath: "Sources/HomeView.swift"`).
3. **Rendre un `#Preview` SwiftUI** — *« Rends l'aperçu SwiftUI de `HomeView.swift` et vérifie la mise en page. »* → `xcode_render_preview`. Ouvrez l'**Xcode Workbench** dans la barre latérale droite pour inspecter les instantanés rendus.
4. **Chercher dans la doc et lancer les tests** — *« Cherche dans la doc locale de Xcode la visibilité des colonnes de `NavigationSplitView`, puis lance les tests unitaires. »* → `xcode_search_docs` → `xcode_build_test` (`action: "run_all_tests"`).

## Configuration

Réglages facultatifs sous `plugins.dsh-xcode` dans `cordis.patch.yml` :

| Option | Valeur par défaut | Signification |
| --- | --- | --- |
| `xcodePid` | résolution automatique | PID explicite d'un Xcode en cours d'exécution (`MCP_XCODE_PID`) quand `Xcode.app` et `Xcode-beta.app` sont ouverts simultanément. |
| `callTimeoutMs` | `180000` | Délai d'expiration par défaut (ms) des opérations MCP Xcode longues (`BuildProject`, `RunAllTests`, `RenderPreview`). |
| `autoSyncSkills` | `true` | Exporte et enregistre automatiquement les bundles `SKILL.md` intégrés d'Apple quand `xcode_status` ou `xcode_open_project` se connecte. |
| `skillsCacheDir` | `~/.cache/dsh-xcode/skills` | Répertoire où les bundles `SKILL.md` exportés d'Apple sont mis en cache par numéro de build de Xcode. |

## Dépannage

- **`xcrun could not find mcpbridge` / erreur Command Line Tools** — `xcode-select -p` pointe vers `/Library/Developer/CommandLineTools` ou un Xcode plus ancien (< 26.3). Passez à Xcode 26.3+ complet : `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.
- **`Could not establish MCP tool session with Xcode`** — assurez-vous qu'au moins une fenêtre de projet/workspace est ouverte dans Xcode (`xcode_open_project`), activez **Xcode → Settings → Intelligence → Model Context Protocol → Allow External Agents**, et cliquez sur **Allow** si Xcode affiche en arrière-plan un dialogue d'autorisation d'agent.
- **Plusieurs instances de Xcode en cours d'exécution** — `dsh-xcode` choisit automatiquement le PID correspondant à `xcode-select -p` ; si deux copies du même bundle sont ouvertes, passez `xcodePid` dans la config ou définissez `DSHPLUGIN_XCODE_PID=<pid>`.
- **La macro `#Preview` échoue sur une configuration de cible personnalisée** — le moteur d'aperçu de Xcode peine parfois à déduire un facteur de forme pour des macros `#Preview` complexes ; ajouter une structure `PreviewProvider` standard dans le fichier fonctionne de façon fiable avec `xcode_render_preview`.

## Développement

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run smoke:pack
```

Liez un checkout local dans votre profil DSH Web :

```sh
dsh plugin --profile web add link:/path/to/dsh-xcode
dsh web
```

| Suite | Ce qu'elle couvre |
| --- | --- |
| `test/mcp-stdio.test.mjs` | Poignée de main STDIO JSON-RPC, `tools/list` paginé, hydratation du `structuredContent` omis dans Xcode 26, décodage PNG canonique, retrait du base64, nettoyage de l'environnement, classification des erreurs. |
| `test/env-and-bridge.test.mjs` | Filtrage des processus Xcode vs Simulateur via `ps`, règles de sélection du PID, découverte `.xcworkspace`/`.xcodeproj`/`Package.swift`, résolution automatique du `tabIdentifier`, persistance de l'état diagnostics/build/aperçu, export `SKILL.md` et cycle de vie `apply()` de l'hôte. |
| `test/client-bundle.test.mjs` | Forme du bundle `window.__ModuleLoader__.load`, invariant du React hôte externalisé, parité des locales `zh`/`en`, encodage des adresses de ressources du Workbench, enregistrement des slots et onglets. |
| `test/ios-peer-linkage.test.mjs` | Découverte inter-plugins en direct via `Symbol.for('zseven.dsh.apple.peer.v1')` avec `@zseven-w/dsh-ios` et routage intelligent `.xcodeproj` → `xcode_render_preview`. |

## Écosystème

- [DSH iOS Simulator](https://github.com/ZSeven-W/dsh-ios) — simulateur iOS interactif en direct et streaming d'un iPhone réel connecté en USB, arbres UI AXe, OCR Vision et hot-reload d'aperçu SwiftPM
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — émulateur Android ou appareil USB en direct dans la conversation, piloté entièrement via `adb`
- [DSH Computer](https://github.com/ZSeven-W/dsh-computer) — pilote Computer Use macOS headless-first avec observations AX-first et approbation côté hôte
- [DSH Browser](https://github.com/ZSeven-W/dsh-browser) — sessions Chromium isolées avec références sémantiques et preuves bornées
- [DSH QA](https://github.com/ZSeven-W/dsh-qa) — exploration par agent et rejeu déterministe de scénarios sur Browser, Desktop, iOS et Android
- [DSH Game Studio](https://github.com/ZSeven-W/dsh-game-studio) — décrivez un jeu voxel 2D ou 3D en une phrase, jouez-y dans la barre latérale, intégrez de l'art IA et publiez en un clic
- [DSH Harbor](https://github.com/ZSeven-W/dsh-harbor) — inventaire des capacités, détection de conflits et pré-vérification des mises à niveau DSH pour les plugins installés
- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — répartit du travail vers des agents DSH depuis Claude Code / Codex comme sous-agents natifs
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — mémoire d'agent à long terme, durable et inspectable, pour DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — prévisualise, inspecte et modifie des documents de conception OpenPencil `.op` au sein de conversations DSH

## Licence

MIT © ZSeven-W
