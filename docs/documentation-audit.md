# 文書整合性の確認記録

確認日: 2026-10-06

## 対象と前提

- GitHub: [Bamboosato/face-icon-maker](https://github.com/Bamboosato/face-icon-maker)
- 照合元: `main` の `2bbc3ddfa5e416441e7556996936cd32df78def9`
- `git ls-remote origin refs/heads/main` とローカルHEADが一致し、開始時の作業ツリーに変更がないことを確認
- 対象: README、AGENTSのプロジェクト説明、`docs` の既存7文書、`src`、配布アセット、ビルド設定、既存テスト
- この2026-10-06の照合時点では文書のみを変更し、アプリコード・設定・依存関係は変更していない
- この照合時点ではGitHubへの反映は未実施。続く2026-10-07のCI導入で、文書修正も[PR #8](https://github.com/Bamboosato/face-icon-maker/pull/8)へまとめた。設定・依存更新と現在の検証範囲は[CI導入記録](ci-dependency-check-plan.md)を参照

## 先に整理した確認観点

| 観点 | 確認意図 |
|---|---|
| 機能 | 顔検出・選択・Crop・背景・スタイル・アニマル・超解像・PNG・共有が文書に網羅されているか |
| 非機能 | 性能目標、端末差、ネットワーク、モデル配布、キャッシュ、プライバシーの説明が実装や検証記録を超えていないか |
| データ | 形式・バイト数・寸法・Crop下限、ランドマーク、モデル・プリセットの型と数が一致するか |
| UI | 画面名、操作位置、設定、進捗、エラー、プレビューと出力、リセット・共有の条件が一致するか |

正常系（基本フロー・加工・保存）、異常系（読込・モデル・素材・共有失敗）、境界値（入力上限・96 / 256 / 512px・感度）、状態遷移（戻る・別顔・再検出・キャンセル・リセット）を分けて照合した。

状態やデータの前提、取得失敗後の再利用、非同期競合、キャッシュ・端末差を疑い、静的コードで分かる事実と実機での再現が必要な項目を区別した。

## 主な修正

| 文書の不整合・記載漏れ | 修正内容 | 根拠 |
|---|---|---|
| READMEにアニマル機能・文書リンクがない | None + 12種、静止画解析、制限と関連文書を追記 | [プリセット](../src/config/animalPresets.ts)、[操作部品](../src/components/AnimalPresetControl.tsx) |
| アニマル文書は4種・numFaces 1・部位別素材・局所ワープを前提 | 実際の12種、最大3候補からの選択、1枚SVGとCanvas装飾、現行型へ更新。ワープ案は未実装として保持 | [解析](../src/services/faceLandmarker.ts)、[候補選択](../src/services/faceLandmarkSelection.ts)、[描画](../src/services/animalEffectService.ts)、[型](../src/types/animal.ts) |
| 背景・スタイル・アニマルの順序が常に一律と読める | コミック / ペイント + 背景変更時の分岐を明記 | [共通描画](../src/services/renderPipeline.ts) |
| 超解像4倍画像を直接背景分離へ渡すように読める | 出力寸法の作業Canvasへ描いてから分離し、プレビューは超解像前と明記 | [出力](../src/services/exportService.ts)、[プレビュー](../src/components/IconPreview.tsx) |
| モデル・WASMがすべて同じ取得元であるように読める | 同梱の顔モデル・WASM・SVGと、外部の背景分離・超解像モデルを区別 | [顔検出](../src/services/faceDetection.ts)、[背景分離](../src/services/segmentationService.ts)、[Vite](../vite.config.ts) |
| 共有API対応だけで主操作を決める、共有キャンセルも保存するように読める | スマートフォン判定、API非対応と失敗のフォールバック、共有キャンセルの終了を明記 | [保存画面](../src/components/DownloadPanel.tsx)、[共有](../src/services/exportService.ts)、[端末判定](../src/hooks/useIsSmartphone.ts) |
| 50 MB、すべてのCropで96px下限、Node 20以降 | 50 MiB、画像内補正と手動Cropの例外、ViteのNode 20.19 / 22.12要件へ修正 | [入力](../src/services/imageService.ts)、[Crop](../src/services/cropService.ts)、lockfileとインストール済みViteのengines |
| 画面遷移・再開始確認・状態保持の説明が実装と違う | 編集はBack、Start Overは保存画面かつ確認なし、別顔・再入場時の設定保持を明記 | [App](../src/App.tsx)、[編集](../src/components/CropEditor.tsx)、[保存画面](../src/components/DownloadPanel.tsx) |
| ピクセル粒度・ペイント強度・背景4色・出力命名が未記載 | 設定とファイル名ルールを追記 | [編集](../src/components/CropEditor.tsx)、[ファイル名](../src/utils/fileName.ts) |
| PWAと既存加工が一律に将来機能となっている | 実装済みの加工を区別し、manifestとアイコンのみ存在、Service Worker・オフライン保証は未実装と明記 | [manifest](../public/manifest.webmanifest)、[HTML](../index.html)、src全体とビルド設定 |
| 未実装のテスト・再試行・解放・キャンセル保証が完了済みと読める | 既存テストの実際の範囲、ページ内キャッシュ、協調キャンセル、残課題を分離。過去の実機記録は導入時の記録として維持 | [テスト一覧](tasks-mvp.md)、[超解像](../src/services/superResolutionService.ts)、[導入記録](super-resolution-feasibility.md) |

## 継続課題

以下は静的に確認した未実装箇所・不足する検証であり、今回ランタイムで再現した不具合の一覧ではない。優先度は想定されるユーザー影響で付ける。致命的な問題を断定できる実行証跡はない。

| 優先度 | 項目・影響 | 次の確認・改善 | 分類 |
|---|---|---|---|
| 重大 | 最終タイル後〜PNG保存前のAbortSignal確認がなく、キャンセルが保存を止めない可能性 | 最終タイル付近でキャンセルを再現し、描画・保存直前を保護する | 実装・テスト観点不足 |
| 重大 | 再検出のリクエスト番号保護がなく、Redetect・Back・顔選択を一律に無効化していない | 遅延状態で連打・戻る・選択を組み合わせ、古い結果と処理状態を確認する | 実装・テスト観点不足 |
| 重大 | MediaPipe・SVGの失敗Promiseを保持し、ページ内で復旧できない場合がある | モデル・素材の取得失敗を注入し、再試行・再初期化の方針を決める | 実装・環境依存 |
| 軽微 | Landmarker失敗後も準備中ヒントが残る。通常保存の失敗メッセージは専用の表示先がない | 失敗を注入し、状態とメッセージを確認する | 実装・UI |
| 軽微 | 選択顔枠の強調、Crop外の装飾警告、背景分離・素材失敗通知は未実装 | 基本フローへの影響を見て追加の必要性を判断する | 実装・UI |
| 継続検証 | 自動Crop境界・入力上限・超解像ランドマーク変換・描画・PNG・競合の直接テストがない | 前提と検証意図を定義し、リスクに応じて対象テストを追加する | テスト観点不足・データ条件 |
| 継続検証 | モデルclose、Selfieモデル固定、低メモリ・回線・各ブラウザ、実機性能 | 通し操作と環境差を検証し、ログ・入力・端末情報を残す | 実装・環境依存 |

局所画素ワープ、グラデーション、Service Workerなどの未実装機能は、今回の文書修正で実装を追加していない。[実装・検証タスク](tasks-mvp.md)で継続管理する。

## 今回の検証結果

- `npm test`: 6ファイル、18テストすべて成功
- `npm run build`: TypeScriptチェックとViteの本番ビルド成功。WASMの静的コピーは14項目
- 制限環境ではViteの子プロセスとTypeScriptのキャッシュ書き込みがEPERMになったため、同じコマンドを通常権限で再実行して成功。コード変更で回避していない
- 文書10件の相対リンク55件は参照先が存在し、`git diff --check` も成功
- E2E範囲: 未実施。文書のみの変更で、アプリの操作・描画経路は変更していないため
- 未実施: 実ブラウザ描画、PNGの画質比較、モデル・素材の障害注入、競合再現、クロスブラウザー、スマートフォン実機、性能計測、Vercel本番の再検証
- READMEと超解像導入記録のChrome・iPhone実機結果は過去の記録。今回の確認済み環境へ読み替えない

再発防止として、機能追加時にはREADME・総合要件・画面遷移・設計・タスクを合わせて更新し、型や設定の例は実装の正本を参照する。実装項目、品質目標、過去の検証記録、未実施のテストを分けて記載する。
