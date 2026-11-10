<p align="center">
  <img src="./docs/images/dsh-xcode-logo.png" alt="DSH Xcode" width="120" />
</p>

<h1 align="center">DSH Xcode</h1>

<p align="center">
  <strong>Apple公式のXcode MCPブリッジ(<code>xcrun mcpbridge</code>)と内蔵Apple Skillsを、<a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>の会話の中で直接利用 — <a href="https://github.com/ZSeven-W/dsh-ios">DSH iOS</a> とシームレスに連携。</strong><br />
  <sub>8つのエージェントツール &bull; 1秒未満の単一ファイルコンパイラ診断 &bull; ネイティブSwiftUI <code>#Preview</code> スナップショット &bull; ウォームなスキームビルドとテスト &bull; ローカルのAppleドキュメント検索 &bull; 右サイドバーのXcode Workbench</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-xcode</code> &middot; 現在のプラグインリリース: <code>0.1.0-rc.3</code> &middot; 動作確認: DSH <code>0.2.1-rc.5</code></sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <b>日本語</b> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-xcode/actions/workflows/check.yml"><img src="https://img.shields.io/github/actions/workflow/status/ZSeven-W/dsh-xcode/check.yml?label=CI" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@zseven-w/dsh-xcode"><img src="https://img.shields.io/npm/v/@zseven-w/dsh-xcode?color=1a78f2" alt="npm" /></a>
  <a href="https://github.com/ZSeven-W/dsh-xcode/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-xcode?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-xcode-banner.png" alt="DSH Xcode — DeepSeek Harnessの中で動くApple公式Xcode MCPブリッジとApple Skills" width="100%" />
</p>

## DSH Xcode を選ぶ理由

Xcode 26.3以降、AppleはローカルXPC越しの公式Model Context Protocolブリッジ(`xcrun mcpbridge`)と、ファーストパーティの`SKILL.md`エージェントバンドル(`xcrun agent skills export`)を同梱するようになりました。しかし、生の`xcrun mcpbridge`を汎用コーディングエージェントに直接接続すると、3つの実用上の壁にぶつかります:

1. **Xcode 26の`structuredContent`不整合** — `XcodeListWindows`のようなツールは`tools/list`で`outputSchema`を宣言しておきながら、実際にはJSONを`content[0].text`に入れて返し、`structuredContent`を省略します。そのため、厳格なMCP SDKクライアントが有効なレスポンスを拒否してしまいます。
2. **プロセスライフサイクルと複数XcodeのPIDルーティング** — `mcpbridge`は、Xcodeが閉じられたとき、`Xcode.app`と`Xcode-beta.app`の両方が同時に起動しているとき、または**Xcode → Settings → Intelligence**で外部エージェントアクセスが有効になる前に、即座に終了してしまいます。
3. **コンテキストの膨張** — Xcodeは約20以上の細粒度のツールを公開しており、`RenderPreview`は数メガバイトのbase64 PNG文字列を吐き出します。

`DSH Xcode`は、Appleの公式ブリッジをランタイム依存ゼロのネイティブDeepSeek Harnessプラグインとしてラップし、統合された右サイドバーのWorkbenchと、[`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios)との疎結合なピアディスカバリを提供します。

| | |
| --- | --- |
| ⚡ **1秒未満の単一ファイル診断** | `filePath`を指定した`xcode_diagnostics`は、Xcodeのライブコンパイラグラフに対して`XcodeRefreshCodeIssuesInFile`を呼び出します。コールドな`xcodebuild`を起動することなく、Swift/ObjCへの編集を1秒未満でチェックできます。 |
| 🖼️ **ネイティブなSwiftUI `#Preview` スナップショット** | `xcode_render_preview`は、`.xcodeproj`、`.xcworkspace`、SwiftパッケージにわたってXcode自身の`RenderPreview`エンジンを駆動し、PNGを`.dsh-xcode/previews/`に書き出し、マルチモーダルモデルが有効なときは画像をそのまま添付します。 |
| 🔨 **ウォームな増分ビルドとテスト** | `xcode_build_test`は、XcodeのウォームなDerivedDataビルドグラフを再利用して、`BuildProject`、`GetBuildLog`、`GetTestList`、`RunAllTests`、`RunSomeTests`(XCTest &amp; Swift Testing)を実行します。 |
| 🔧 **Xcode 26のワイヤー正規化** | 省略された`structuredContent`をJSONテキストブロックから自動的に補完し、複数のワークスペースウィンドウにまたがる`tabIdentifier`を解決し、JSONサマリーから過大なbase64文字列を除去します。 |
| 📘 **Apple公式`SKILL.md`の同期** | `xcrun agent skills export`を実行し、お使いのXcodeビルドに合った内蔵`SKILL.md`バンドルを解析して`~/.cache/dsh-xcode/skills/`にキャッシュし、`ctx.skills`へ動的に登録します。 |
| 🪟 **右サイドバーのXcode Workbench** | ライブの接続ステータスピル、開いているワークスペースの`tabIdentifier`ウィンドウ、コンパイラ診断リスト、ビルド/テストサマリー、レンダリング済みのSwiftUI `#Preview`ギャラリー、`dsh-ios`ピアデバイスの状態を表示します。 |
| 📱 **`dsh-ios`とのペア** | `Symbol.for('zseven.dsh.apple.peer.v1')`によるインストール時の結合ゼロ。`dsh-xcode`がIDEのコンパイラインテリジェンスを担当し、`dsh-ios`がライブのシミュレーターとUSB接続iPhoneのストリーミングと操作を担当します。 |
| 🧭 **将来に備えた脱出口** | `xcode_call_tool`を使えば、プラグインの更新を待たずに、任意の生`mcpbridge`ツール(`ExecuteSnippet`、`XcodeUpdate`、Xcode 27+の`DeviceInteraction*`)を一覧・実行できます。 |

## ツール

8つのツールすべてがすべてのホストで登録され、省略時にはアクティブなワークスペースから`tabIdentifier`を自動解決します。macOS以外のホストやXcodeが閉じている場合は、対処可能なセットアップ手順とともに縮退動作します。

| ツール | 機能 | 主なパラメータ |
| --- | --- | --- |
| `xcode_status` | アクティブな`xcode-select`開発ディレクトリ、Xcodeのバージョン/ビルド、`xcrun mcpbridge`と`agent`の機能、実行中の`Xcode.app` PID、開いているワークスペースウィンドウ(`tabIdentifier`)、同期済みのApple skills、`dsh-ios`ピアの状態を確認します。 | `connect`(デフォルト `true`) |
| `xcode_open_project` | `.xcworkspace`、`.xcodeproj`、`Package.swift`を自動検出してXcodeで開き(`open -a Xcode`)、`mcpbridge`が接続してウィンドウの`tabIdentifier`を報告するまでポーリングします。 | `projectPath`(省略可)、`waitSeconds`(デフォルト `20`) |
| `xcode_diagnostics` | Xcodeのライブコンパイラエラーと警告を読み取ります。`filePath`を渡すと`1秒未満`の単一ファイル型チェック(`XcodeRefreshCodeIssuesInFile`)、省略するとワークスペース全体のIssue Navigator診断(`XcodeListNavigatorIssues`)を行います。 | `filePath`、`projectPath`、`tabIdentifier`、`severity`(`error`/`warning`/`remark`)、`pattern` |
| `xcode_build_test` | アクティブなスキームをビルドし、フィルタ済みのビルドログを確認し、Xcodeのウォームビルドグラフ内でXCTestとSwift Testingのスイートを一覧/実行します。 | `action`(必須 — `build`/`build_log`/`list_tests`/`run_all_tests`/`run_some_tests`)、`tests`(JSON配列)、`severity`、`pattern` |
| `xcode_render_preview` | SwiftUI `#Preview`または`PreviewProvider`のスナップショットをXcode内でネイティブにレンダリングし、PNGを`.dsh-xcode/previews/`に保存してWorkbenchギャラリーに表示し、マルチモーダルモデルのコンテキストに添付します。 | `sourceFilePath`(必須)、`previewDefinitionIndexInFile`(デフォルト `0`)、`projectPath`、`tabIdentifier` |
| `xcode_search_docs` | Xcode内蔵のApple Developer DocumentationとWWDCセッションの書き起こしを横断してセマンティック検索します(`DocumentationSearch`)。 | `query`(必須)、`frameworks`(省略可、カンマ区切りリスト、例: `"SwiftUI,Observation"`) |
| `xcode_sync_skills` | アクティブなXcodeアプリから`xcrun agent skills export`でApple公式`SKILL.md`バンドルをエクスポートし、現在のDSHセッションに登録します。 | — |
| `xcode_call_tool` | お使いのXcodeバージョンが公開するすべての生MCPツールを一覧表示し(`action: "list"`)、任意の生ツールを直接呼び出します(`action: "call"`)。 | `action`(必須 — `list`/`call`)、`toolName`、`argumentsJson` |

## 表示面

- **右サイドバーパネル — 「Xcode Workbench」。** 任意のツール行の**Open Workbench**ボタン、または右サイドバーの**`+`**ランチャー(**Xcode Workbench**)から開けます。ライブのXcode接続バッジ+PID、Xcodeのバージョン/ビルド、`dsh-ios`のライブデバイスリンク、開いているワークスペースウィンドウ(`tabIdentifier`)、ファイル/行バッジ付きの最新コンパイラ診断、最新のビルド/テスト結果、レンダリング済みのSwiftUI `#Preview`サムネイル、同期済みのApple Skills、マウント済みのMCPツールを表示します。ツールバーのボタン(**Refresh**、**Open Project**、**Diagnostics**、**Build Scheme**、**Sync Apple Skills**)は`/xcode`セッションコマンド経由で実行され、モデルのトークンを消費しません。
- **コンパクトな会話カード。** ツール呼び出し(`xcode_status`、`xcode_open_project`、`xcode_diagnostics`、`xcode_build_test`、`xcode_render_preview`、`xcode_sync_skills`)はコンパクトなローカライズ行(`zh` / `en`)をレンダリングし、呼び出しが完了すると開いているWorkbenchタブを自動的に更新します。

## DSH iOS(`@zseven-w/dsh-ios`)とのペアリング

`dsh-xcode`と[`@zseven-w/dsh-ios`](https://github.com/ZSeven-W/dsh-ios)は、お互いに対する**ハードな依存関係が一切ありません** — どちらか一方だけでも、両方一緒でもインストールできます。同じDSHプロファイルで両方が読み込まれると、`Symbol.for('zseven.dsh.apple.peer.v1')`を介して同一プロセス内で互いを発見します:

- **IDEとコンパイラの作業には`dsh-xcode`(`xcode_*`)** — Swift/ObjCファイル編集中の`1秒未満`の単一ファイル診断、ウォームな増分スキームビルドとユニットテスト、`.xcodeproj` / `.xcworkspace`のSwiftUI `#Preview`スナップショット、ローカルのAppleドキュメント検索。
- **ライブデバイスのランタイムとUI自動化には`dsh-ios`(`ios_sim_*`)** — サイドバーでのインタラクティブなシミュレーターとUSB接続実機iPhoneのMJPEG動画ストリーミング、AXeアクセシビリティツリー(`ios_sim_ui_tree`、`ios_sim_tap_element`、`ios_sim_ui_rows`)、Vision OCRによる検索とタップ(`ios_sim_find_text`、`ios_sim_tap_text`)、統合ランタイムログ(`ios_sim_logs`)、LLDBバックトレースと`leaks`。
- **スマートなクロスプラグインルーティング** — エージェントが`.xcodeproj` / `.xcworkspace`に対して`ios_sim_preview`(SwiftPMダイナミックライブラリのホットリロード)を呼び出そうとすると、`dsh-ios`は`dsh-xcode`がマウントされていることを検出し、エージェントを`xcode_render_preview`へ直接誘導します。

## セキュリティとプライバシー

- **ローカルXPCトランスポートのみ** — `xcrun mcpbridge`は、macOS XPC越しにローカルのXcodeプロセスとだけ通信します。プラグインはネットワークリスナーを開かず、外部へのHTTPリクエストも一切行いません。
- **環境変数のスクラブ** — `xcrun mcpbridge`や`xcrun agent`を起動する前に、`scrubEnvForMcpBridge`が`*KEY*`、`*SECRET*`、`*TOKEN*`、`*PASSWORD*`、`DSH_*`に一致する環境変数をすべて取り除き、標準的なmacOS開発/XPC変数(`HOME`、`USER`、`PATH`、`TMPDIR`、`DEVELOPER_DIR`、`MCP_XCODE_PID`、`MCP_XCODE_SESSION_ID`)だけを渡します。
- **Xcodeユーザーによる明示的な同意** — 外部エージェントアクセスは、Xcode自身の**Settings → Intelligence → Model Context Protocol**トグルと、macOS/Xcodeの権限ダイアログによってゲートされています。
- **境界付きのバイナリ処理** — MCP画像ブロックは、デコード前に正規base64と厳格な20 MB上限で検証されます。生JSONペイロード内の過大なbase64文字列は除去され、モデルのコンテキストはクリーンに保たれます。

## 動作要件

- **macOS**に**Xcode 26.3以降**がインストールされていること(`xcode-select -p`がCommand Line Toolsではなく`/Applications/Xcode.app/Contents/Developer`を指していること)。
- **DeepSeek Harness** `0.2.1-rc.5`以降、Node.js `>= 24.11.0`。
- **初回のみのXcode設定** — **Xcode → Settings → Intelligence → Model Context Protocol**を開き、**Allow External Agents**を有効にしてください(初回接続時にXcodeの権限プロンプトを承認)。

## DSHへのインストール

```sh
dsh plugin --profile web add @zseven-w/dsh-xcode@latest
dsh web
```

Xcode IDEツールに加えてシミュレーターとUSB iPhoneのフルストリーミングを使うには、`dsh-ios`も併せてインストールしてください:

```sh
dsh plugin --profile web add @zseven-w/dsh-ios@latest
```

## クイックスタート

1. **ステータス確認とプロジェクトを開く** — 「Xcodeのステータスを確認して、このフォルダーのiOSプロジェクトを開いて。」→ `xcode_status` / `xcode_open_project`。初回実行時はXcodeの外部エージェントプロンプトを承認してください。
2. **1秒未満で単一ファイルをチェック** — 「`HomeView.swift`をリファクタリングして、フルビルドなしでコンパイルエラーを確認して。」→ `xcode_diagnostics`(`filePath: "Sources/HomeView.swift"`)。
3. **SwiftUI `#Preview`をレンダリング** — 「`HomeView.swift`のSwiftUIプレビューをレンダリングしてレイアウトを確認して。」→ `xcode_render_preview`。右サイドバーの**Xcode Workbench**を開くと、レンダリング済みのスナップショットを確認できます。
4. **Appleドキュメントを検索してテストを実行** — 「Xcodeのローカルドキュメントで`NavigationSplitView`のカラム表示を検索して、それからユニットテストを実行して。」→ `xcode_search_docs` → `xcode_build_test`(`action: "run_all_tests"`)。

## 設定

`cordis.patch.yml`の`plugins.dsh-xcode`以下に設定できるオプション:

| オプション | デフォルト | 意味 |
| --- | --- | --- |
| `xcodePid` | 自動解決 | `Xcode.app`と`Xcode-beta.app`が同時に開いているときに、明示的に対象とする実行中のXcode PID(`MCP_XCODE_PID`)。 |
| `callTimeoutMs` | `180000` | 長時間のXcode MCP操作(`BuildProject`、`RunAllTests`、`RenderPreview`)のデフォルトタイムアウト(ミリ秒)。 |
| `autoSyncSkills` | `true` | `xcode_status`または`xcode_open_project`が接続したとき、Apple内蔵の`SKILL.md`バンドルを自動的にエクスポートして登録します。 |
| `skillsCacheDir` | `~/.cache/dsh-xcode/skills` | エクスポートしたApple `SKILL.md`バンドルをXcodeのビルド番号ごとにキャッシュするディレクトリ。 |

## トラブルシューティング

- **`xcrun could not find mcpbridge` / Command Line Toolsエラー** — `xcode-select -p`が`/Library/Developer/CommandLineTools`や古いXcode(< 26.3)を指しています。`sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`でXcode 26.3+に切り替えてください。
- **`Could not establish MCP tool session with Xcode`** — Xcodeで少なくとも1つのプロジェクト/ワークスペースウィンドウが開いていること(`xcode_open_project`)、**Xcode → Settings → Intelligence → Model Context Protocol → Allow External Agents**が有効であることを確認し、Xcodeが裏でエージェント承認ダイアログを表示している場合は**Allow**をクリックしてください。
- **複数のXcodeが起動している** — `dsh-xcode`は`xcode-select -p`に一致するPIDを自動的に選択します。同じバンドルのコピーが2つ開いている場合は、設定で`xcodePid`を渡すか、`DSHPLUGIN_XCODE_PID=<pid>`を設定してください。
- **カスタムターゲット構成で`#Preview`マクロが失敗する** — Xcodeのプレビューエンジンは、複雑な`#Preview`マクロのフォームファクターを推測できないことがあります。ファイルに標準の`PreviewProvider`構造体を追加すれば、`xcode_render_preview`で確実にレンダリングできます。

## 開発

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run smoke:pack
```

ローカルのチェックアウトをDSH Webプロファイルにリンクします:

```sh
dsh plugin --profile web add link:/path/to/dsh-xcode
dsh web
```

| スイート | カバー範囲 |
| --- | --- |
| `test/mcp-stdio.test.mjs` | STDIO JSON-RPCハンドシェイク、ページ分割された`tools/list`、Xcode 26の省略`structuredContent`補完、正規PNGデコード、base64除去、環境変数スクラブ、エラー分類。 |
| `test/env-and-bridge.test.mjs` | `ps`によるXcodeとSimulatorのプロセスフィルタリング、PID選択ルール、`.xcworkspace`/`.xcodeproj`/`Package.swift`の検出、`tabIdentifier`の自動解決、診断/ビルド/プレビューの状態保持、`SKILL.md`エクスポートとホスト`apply()`ライフサイクル。 |
| `test/client-bundle.test.mjs` | `window.__ModuleLoader__.load`バンドルの形状、外部化されたホストReactの不変条件、`zh`/`en`ロケールパリティ、Workbenchのリソースアドレスエンコーディング、スロットとタブ登録。 |
| `test/ios-peer-linkage.test.mjs` | `@zseven-w/dsh-ios`とのライブなクロスプラグイン`Symbol.for('zseven.dsh.apple.peer.v1')`ディスカバリと、`.xcodeproj` → `xcode_render_preview`のスマートルーティング。 |

## エコシステム

- [DSH iOS Simulator](https://github.com/ZSeven-W/dsh-ios) — ライブでインタラクティブなiOSシミュレーターとUSB接続実機iPhoneのストリーミング、AXe UIツリー、Vision OCR、SwiftPMプレビューのホットリロード
- [DSH Android](https://github.com/ZSeven-W/dsh-android) — 会話の中のライブなAndroidエミュレーターまたはUSBデバイス。`adb`だけで駆動
- [DSH Computer](https://github.com/ZSeven-W/dsh-computer) — AXファーストの観測とホスト所有の承認を備えたヘッドレスファーストのmacOS Computer Useドライバー
- [DSH Browser](https://github.com/ZSeven-W/dsh-browser) — セマンティックリファレンスと有界なエビデンスを備えた隔離Chromiumセッション
- [DSH QA](https://github.com/ZSeven-W/dsh-qa) — Browser、Desktop、iOS、Androidにわたるエージェント主導の探索と決定論的なシナリオリプレイ
- [DSH Game Studio](https://github.com/ZSeven-W/dsh-game-studio) — 2Dまたは3Dボクセルゲームを一文で描写し、サイドバーでプレイし、AIアートに差し替え、ワンクリックで公開
- [DSH Harbor](https://github.com/ZSeven-W/dsh-harbor) — インストール済みプラグインの能力インベントリ、衝突検出、DSHアップグレードの事前チェック
- [DSH Crew](https://github.com/ZSeven-W/dsh-crew) — Claude Code / CodexからDSHエージェントへ、ネイティブサブエージェントとして作業をディスパッチ
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — DSHのための永続的で検査可能な長期エージェントメモリ
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — DSHの会話の中で`.op` OpenPencil設計ドキュメントをプレビュー・検査・編集

## ライセンス

MIT © ZSeven-W
