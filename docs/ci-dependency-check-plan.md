# Face Icon Maker の CI と依存関係チェック導入案・実装記録

検討・実装日: 2026-10-07

tennis-organizing-appのGitHub Actionsを参考に、face-icon-makerへ通常検証と依存関係監査を導入した。依存監査スクリプトと判定テストを土台にし、Firebase・Javaの検証はブラウザ完結の構成には含めない。依存更新と分類を整理し、main向けPRとmain pushでCIを実行する。

初期導入の手順1〜4を実装した。ワークフロー、依存パッケージ、lockfile、監査・配布検査を更新し、監査例外は設けていない。mainの必須チェック設定、Lint、対象E2E、定期実行は後続範囲である。以下の現状表は導入前の調査記録で、更新後の結果は末尾の実装・検証記録を参照。

## 依存関係の現状

2026-10-07に現在のlockfileを用いて `npm audit --json` と `npm audit --json --omit=dev` を実行した。

| 対象 | high | moderate | 合計 |
|---|---:|---:|---:|
| 全依存 | 6 | 2 | 8 |
| devを除外した依存 | 3 | 0 | 3 |

これはnpmが報告する脆弱なパッケージ件数で、独立した脆弱性や公開サイトで悪用可能な経路の数ではない。結果はアドバイザリの追加・依存更新で変化する。

| パッケージ | lockfileのバージョン | 監査結果と対応案 |
|---|---|---|
| nanoid | 3.3.15 | high。3.3.18の公開を確認。PostCSS経由の依存を更新する |
| postcss | 8.5.15 | high。8.5.29の公開を確認。Viteの依存範囲内で更新を試し、再監査する |
| source-map-js | 1.2.1 | high。1.2.2の公開を確認。PostCSS・Tailwind側の解決を更新する |
| vitest / @vitest/mocker | 4.1.10 | moderate。修正版4.1.11を確認し、既存テストを再実行する |
| braces / chokidar / vite-plugin-static-copy | 3.0.3 / 3.6.0 / 4.1.1 | high。bracesの既知問題とそれに依存するパッケージが報告される。経路変更または限定的な期限付き例外を検討する |

Vitestの修正範囲は[公式アドバイザリ](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)を参照。bracesは[公式アドバイザリ](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)で修正版なしとなっている。公開バージョンの確認は更新後の動作・監査成功を保証しない。

### 依存分類と公開環境

`@vitejs/plugin-react` と `@tailwindcss/vite` が現在 `dependencies` にあり、peer依存のViteとそのPostCSS関連依存もlockfile上でdev扱いになっていない。これが `--omit=dev` にビルドツールの指摘が残る要因である。

Viteプラグインなど実行時に不要なツールは `devDependencies` へ移す案とする。ただし分類を変えるだけで安全になったとは扱わず、全依存監査でビルド・開発環境の問題も判定する。公開物への混入・到達可能性はビルド出力と実際の呼び出し経路で確認する。

現在の `npm audit` はWASMコピー用プラグインについて0.2.0への変更を修正候補として返す。この古いバージョンへの自動変更は採用せず、Vite 8との互換性、同一オリジンのMediaPipe・LiteRT WASM配布を維持できる経路を検討する。

## CI の構成案

main向けPRとmainへのpushで実行し、手動実行も可能にする。UbuntuとNode.js 24を共通環境にし、権限は `contents: read` を基本にする。PRで本番秘密情報は使わない。

Node.js 24を `.nvmrc`、`package.json`、README、CIで共通にした。調査時のコピー用プラグインのNode要件も満たす候補だったが、実装ではそのプラグインを除去した。

| ジョブ | 初期導入する処理 | 意図 |
|---|---|---|
| Verify | checkout、Node / npm設定、`npm ci --include=dev`、`npm run typecheck`、`npm test`、`npm run test:assets`、`npm run build`、`npm run check:assets` | lockfile再現性、型、既存18テスト、静的配布の成立を検証する |
| Dependency security | checkout、Node設定、`npm ci --include=dev`、`npm run test:security`、`npm run audit:security`、監査JSONアップロード | 監査ポリシーの誤判定と依存の既知脆弱性を独立して検出する |

両ジョブは独立して実行する。依存監査が失敗しても通常検証の結果を取得し、依存問題と実装・ビルド問題を切り分ける。型チェックはアプリとVite設定の両方を対象にする。`npm run build` 内でもTypeScriptが動くが、独立ステップにして原因を明確にする。

配布アセット確認では、2つの顔モデル、12種類のSVG、MediaPipe・LiteRTの必要WASMがdistに存在することを検証する。モデル推論・表示・PNGの正しさは別の対象E2Eで確認する。

同じPRの古い実行はconcurrencyで取り消し、mainの検証はPRと別グループにする。ジョブには上限時間を設け、監査JSONは失敗時もアップロードし、ログと必要な成果物に保持期間を設定する。Actionsは導入時点の公式リリースを確認して採用する。

### 初期導入と後続の範囲

ESLintとPlaywrightの実行設定は現行にない。初期CIは既存の型・テスト・ビルドと依存監査を対象にし、Lintと対象E2Eは後続で追加する。tennis-organizing-appのFirebase Emulator・Java検証は追加しない。

既知脆弱性はコード変更がなくても増えるため、必要に応じて週次の監査のみの実行を追加できる。Dependabotによる週次のnpm・Actions更新PRも追加案とする。定期実行・自動更新は初期導入の必須範囲には含めない。ライセンス検査は利用ポリシーの定義を別途要する。

## 監査の合否条件

tennis-organizing-appの `security-audit.mjs`、`security-audit-policy.mjs`、判定テストを土台にする。[npm auditの仕様](https://docs.npmjs.com/cli/v11/commands/npm-audit/)に従って、本番分類と全依存のJSONを取得する。

- 本番分類の指摘は重大度を問わず失敗にする。
- 全依存も原則すべての指摘を失敗にする。
- 開発専用依存で修正・経路変更が直ちに成立しない場合のみ、担当・理由・期限・アドバイザリURL・パッケージ・バージョン・依存パスを限定した例外を持つ。
- critical、別のアドバイザリ、追加パッケージ、例外期限切れ、バージョン・パス変更、本番依存化は例外を無効にする。
- 監査の通信失敗、タイムアウト、不正JSON、重大度集計の矛盾は合格扱いにしない。

例外を使わず合格できる構成を優先する。例外が必要ならこのアプリの `vite-plugin-static-copy → chokidar → braces` の経路について再評価し、tennis-organizing-appのESLint経路の許可リストをそのままコピーしない。期限は採用時に決定し、自動延長しない。

## テスト観点

先に機能・非機能・データ・UIを分け、正常系・異常系・境界値・状態遷移を整理する。

| 観点 | 確認意図 |
|---|---|
| 機能 | 本番依存を遮断し、限定例外のみ許容し、通常検証と監査の双方が実行されるか |
| 非機能 | Ubuntuでのクリーンインストール、Node差、ネットワーク障害、タイムアウト、キャッシュ差に耐えるか |
| データ | 監査JSONの欠損・不整合、lockfileのdev分類、バージョン、パス、アドバイザリを正しく判定するか |
| UIと証跡 | PRの2チェック、失敗理由、監査JSON、E2Eの画像・PNG・traceで原因を追えるか |

監査ポリシーの詳細ケース:

| 種別 | ケースと意図 |
|---|---|
| 正常系 | 指摘0件を合格にする。期限内の一致した開発専用例外だけ合格にする |
| 異常系 | 本番の指摘、critical、未登録パッケージ、同じパッケージの別問題、通信・JSON失敗を遮断する |
| 境界値 | 期限直前・期限ちょうど・期限後、バージョン変更、依存パス追加を判定する |
| 状態遷移 | 開発依存から本番依存への移動、解消後の例外削除、追加依存後の再監査を検証する |

ポリシーテストはネットワークを使わない監査fixture、固定日時、明示的なlockfileを使う。実監査は別ステップで実行し、可変のアドバイザリ内容をfixtureの期待値へ混ぜない。Verifyはキャッシュなしでも成立させ、キャッシュからnode_modulesを復元せず `npm ci` で準備する。

### 後続 E2E の範囲

範囲はChromiumの対象ケースのみを初期案とし、全件・クロスブラウザーを既定にしない。非機密で利用許可のある固定写真と、同一オリジンの顔モデルを使う。基本フローの顔検出は実モデルで確認する。

- 正常系: 写真読込 → 複数顔の選択 → 自動Crop → 通常PNG、Noneと代表アニマル、512 × 512の出力。
- 異常系: 不正画像、顔なし、モデル取得失敗時の案内と通常保存への復帰。
- 境界値: 画像端の顔、Cropの256 / 512px境界、円形の透明な外側。
- 状態遷移: 別顔選択、編集へ戻る、再開始、アニマル解析の古い結果の破棄。

モデル失敗を注入した後にページと通信状態を初期化し、単体では成功して通しで失敗する状態汚染を防ぐ。外部の背景分離・約67 MBの超解像は、基本フローとは分けて取得失敗を制御する対象確認と実機確認を行う。WebGPU、iOS共有、低メモリ、全12種の描画組み合わせは実機・追加回帰の範囲として明記する。

ブラウザ検証はworkers 1で実行し、同一実機へ並列スクリプトを起動しない。入力条件、端末・OS・ブラウザ、モデルキャッシュ、ログ、スクリーンショット、PNG、traceを保存する。

## 導入手順と完了条件

1. 依存の分類と修正版への更新を行い、全依存・本番分類の両方を再監査する。WASMコピー経路を維持できる更新・置換を調べ、残る問題だけ限定例外の必要性を判断する。
2. 監査スクリプト・判定テスト、npm scripts、監査出力のgitignoreを追加する。例外なしの厳格運用を既定にする。
3. VerifyとDependency securityを追加し、PRでUbuntu上のクリーンインストール、監査・型・テスト・ビルド・配布アセット確認を通す。
4. READMEのNode要件、CI・監査説明、継続課題を更新する。Node要件は全ツールの条件から決める。
5. GitHubのmain保護設定で両チェックを必須にする案を採用する場合は、設定が実際に有効か確認する。ワークフローを作るだけではマージ・Vercelデプロイを自動で遮断しない。
6. 後続でLint・対象E2Eを追加し、実施範囲と未実施のブラウザ・実機条件を結果へ記録する。

完了条件は、既知の指摘が解消または厳格な例外に限定され、実際のGitHub Actionsで通常検証と監査が成功し、失敗fixtureで遮断が確認できること。最新のCI結果を根拠にし、ローカル成功だけで導入済みとは扱わない。

## 実装・検証記録

- `@vitejs/plugin-react`、`@tailwindcss/vite`、`tailwindcss` を開発専用依存へ移動。分類変更だけで解消とせず、全依存も監査した。
- PostCSS 8.5.29、nanoid 3.3.20、source-map-js 1.2.2、Vitest / @vitest/mocker 4.1.11へlockfileを更新した。
- `vite-plugin-static-copy` を除去し、その依存経路のchokidar / bracesもなくなった。Node標準機能で開発・ビルド前にJS/WASMをpublicへ生成し、Viteのpublic配布を使う。URLと元の14ランタイムファイルは維持した。古いプラグインへのダウングレードも監査例外も採用していない。
- `audit:security` は本番分類・全依存の2レポートを取得・保存する。全依存側は `--include=dev` を明示し、終了コードと集計の矛盾も遮断する。現行の監査例外ファイルはない。
- 将来の `security-audit-exception.json` は単一アドバイザリの `advisory`、UTC期限の `expires`、担当の `owner`、理由の `reason`、正確なバージョンの `packages` マップを要する。パスは各パッケージの `node_modules/<name>` のみ許可し、ネスト追加・本番依存化・期限切れ・critical・別問題を遮断する。追加は個別レビューを前提とする。
- `.github/workflows/ci.yml` に独立したVerify / Dependency securityを追加。導入時の公式最新リリースをGitHub APIで確認し、checkout / setup-node / upload-artifactはv7を採用した。Node.js 24、npm 11.19.0を共通にする。秘密情報は使用しない。監査成果物の保持は14日。
- Windows / Node.js 24.13.0 / npm 11.6.2で `npm ci --include=dev`、型チェック、既存18テスト、監査判定23テスト、配布検査5テスト、本番ビルドが成功した。
- `npm run check:assets` でモデル2件・SVG12件・JS/WASM14件の計28件が元データと一致した。
- ローカルのdev / 本番ビルドpreviewからそれぞれ28件をHTTP取得し、内容一致とWASMの `application/wasm` MIMEを確認した。モデル推論のE2Eとは分けて記録する。
- 文書11件のローカルリンク61件の参照先と `git diff --check` を確認した。
- 更新後の `npm run audit:security` は本番分類0件、全依存0件。これは2026-10-07の監査結果で、将来のアドバイザリ追加を保証しない。

GitHub ActionsのUbuntu検証は[実装PR #8](https://github.com/Bamboosato/face-icon-maker/pull/8)のChecksで確認できる。機能変更を含む `92cef74c4c4a18f9339d80b4534f3d396b439363` の[CI実行](https://github.com/Bamboosato/face-icon-maker/actions/runs/37574925631)では、Verify / Dependency securityとも成功した。ワークフローの定義とローカル成功だけを、本番稼働やmain保護の有効化の証拠にしない。

初回のUbuntu CIでは `npm ci` が `@emnapi/core` / `@emnapi/runtime` のlockfile不足を検出した。Windows / npm 11.6.2の成功だけでは任意依存のOS差を保証できないため、npm 11.19.0へ合わせて任意依存・同梱依存を含むlockfileを補修した。同版でのWindowsクリーンインストール、再監査、本番ビルド、28アセット照合も成功した。再実行したUbuntu / Node.js 24.21.0 / npm 11.19.0では、クリーンインストール、型、既存18テスト、監査23テスト、配布5テスト、ビルド、28アセット照合、監査0件、監査JSONの保存が成功した。この失敗はアプリの機能ではなく、環境差・依存データの問題として記録する。

E2E範囲は未実施。初期案でLint・E2Eを後続とし、今回はCI・依存更新・配布準備の変更に限定した。顔モデルの推論、描画、PNGの画質、背景除去・超解像の外部取得、競合・失敗注入、クロスブラウザー、スマートフォン実機、Vercel本番の再検証は含めない。配布準備の変更は元データ照合と開発・previewのHTTP配布で確認する。

## 参考

- [tennis-organizing-appのCI](https://github.com/Bamboosato/tennis-organizing-app/blob/main/.github/workflows/ci.yml)
- [tennis-organizing-appの監査ポリシー](https://github.com/Bamboosato/tennis-organizing-app/blob/main/scripts/security-audit-policy.mjs)
- [npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit/)
- [Vitestの修正情報](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)
- [bracesの既知問題](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
