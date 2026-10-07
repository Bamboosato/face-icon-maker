# アーキテクチャ

最終更新: 2026-10-07

## 全体方針

Reactで動作するブラウザ完結型アプリ。写真・中間画像・生成PNGはメモリとCanvasで処理し、アプリのサーバーへ送信しない。バックエンド、データベース、認証、写真や編集内容の永続保存はない。

```text
画像選択 → 検証・向き補正・長辺3,000pxへ縮小
  → Face Detector（0件時のみタイル検出）
  → 顔選択・2.2倍の自動Crop
  → Face Landmarker IMAGE（顔選択ごとに解析、結果を再利用）
  → Crop・アニマル・形・スタイル・背景の編集
  → 保存時のみ任意のReal-ESRGAN x4
  → 共通描画パイプライン → 512 × 512 PNGの保存 / 共有
```

Face Landmarkerはアニマルを選ぶ前に顔選択時点で動く。失敗時はアニマルなしで編集・保存できる。

## 主な責務

### UIと状態

- `src/App.tsx`: `upload / select / edit / download` の4画面、画像・顔・Crop・見た目・解析状態をReact stateで管理。`src/pages` は現行にはない
- `UploadArea` / `FaceSelector`: ファイル選択・ドロップ、顔枠、検出感度、再検出
- `CropEditor` / `AnimalPresetControl`: React Image Cropによる1:1編集、アニマル・形・スタイル・背景の設定
- `IconPreview`: 192 × 192のCanvasへ共通描画。更新前の非同期描画結果は破棄
- `DownloadPanel`: 保存・共有、超解像ON/OFF・進捗・キャンセル。超解像の状態はこの画面内だけで保持
- `useIsSmartphone`: UA情報、モバイルUA、または幅759px以下かつcoarse pointerでスマートフォンを判定

### サービスと設定

| ファイル | 責務 |
|---|---|
| `imageService.ts` | 入力検証、ブラウザによる向き補正、縮小、Object URL生成 |
| `faceDetection.ts` | 複数顔検出、0件時のタイル検出、感度フィルター、重複統合 |
| `cropService.ts` | 自動Crop、画像内補正、背景分離用の選択顔アンカー |
| `faceLandmarker.ts` | 選択顔の参照Cropで静止画推論、処理用画像座標への変換 |
| `faceLandmarkSelection.ts` | 最大3顔の候補から選択顔中心に最も近いランドマークを選択 |
| `faceLandmarkGeometry.ts` | アンカー・顔幅・目の間隔・傾き計算、超解像時の座標変換 |
| `animalEffectService.ts` | SVG、目元・口元の装飾をCanvasへ合成 |
| `superResolutionService.ts` | LiteRTの初期化、モデルコンパイル、タイル推論・再構成 |
| `segmentationService.ts` | MagicTouch、マスク反転・連結成分保持、Selfieへのフォールバック |
| `renderPipeline.ts` | プレビューと保存の共通描画、背景・アニマル・スタイル・形状 |
| `exportService.ts` | 超解像と座標変換、512 PNG生成、ダウンロード・ファイル共有 |
| `src/config` / `src/types` / `src/utils/fileName.ts` | プリセット・超解像設定、型、出力ファイル名 |

ビジネスロジックはサービスに置く。アニマルの型と描画の詳細は[追加設計](animal-face-architecture.md)を参照。

## 画像処理

### 入力・顔検出・Crop

MIMEまたは拡張子でJPEG / PNGを判定し、50 MiB以上、50メガピクセル以上、一辺12,000px以上を拒否する。`createImageBitmap(..., { imageOrientation: "from-image" })` を優先し、失敗時はHTMLImageElementで読み込む。EXIF Orientationはメタデータとしても読むが、独自の回転描画は行わない。長辺は最大3,000pxとする。

Face Detectorは `IMAGE` モード、内部の検出下限0.10で動かし、UIの感度（初期値0.50、0.10〜0.95）で結果を絞る。全体画像で条件を満たす顔が0件の場合のみ重複タイルを走査する。一部の顔が既に見つかっている場合、残りをタイルで補完する処理はない。

自動Cropは顔枠の大きい辺を2.2倍にした正方形。96pxを基準下限とするが、画像内へ補正するため短辺96px未満の画像ではそれより小さくなる。手動Cropの画像内補正には96pxの下限はない。

### 超解像と背景分離の入力

保存時、Cropの短辺が512px未満かつユーザーが有効化した場合のみ超解像を行う。既定モデルは128 × 128入力から4倍出力。実際のタイル寸法と倍率はモデルの入出力shapeから取得し、20%重複する位置で推論する。重複部分は中間位置で分割して各タイルの中央側を描画し、アルファブレンドで平均化する方式ではない。

WebGPUが利用できる場合は優先する。読み込み・コンパイル失敗時はWASMで再試行し、推論失敗時は通常画像で保存する。テンソルは各タイル後に解放する。

共通描画は、通常・超解像いずれもまず出力Canvasと同じサイズの作業CanvasへCropを描く。背景分離にはプレビューで192 × 192、保存で512 × 512を渡す。4倍の中間画像を直接セグメンテーションへ渡すわけではない。超解像のプレビューはなく、保存時だけ中間画像とランドマーク座標を差し替える。

### 描画順

`renderIconToCanvas` には次の分岐がある。

| 条件 | 作業Canvas以降の順序 |
|---|---|
| 元背景、または通常 / ピクセル | 必要なら背景分離・背景合成 → アニマル装飾 → スタイル → 形状 |
| 透明 / 単色背景かつコミック / ペイント | 加工前の人物マスク取得 → スタイル → 背景合成 → アニマル装飾 → 形状 |

アニマル素材は背景合成の後に置き、人工的な耳やヒゲを人物分離で消さない。画素を変形する局所ワープは現行にはない。円形は最後にクリップし、PNGの外側を透明にする。

### 背景分離と保存

選択顔の中心をCrop内0〜1へ変換し、MagicTouchへ渡す。背景側confidence maskを反転し、選択顔の近くの前景と連結する成分を保持する。初期化・推論失敗時はSelfieへ戻り、両方に失敗した場合は元背景を残す。専用の背景失敗エラーは表示しない。

スマートフォン判定時はファイル共有APIを試み、非対応・キャンセル以外の失敗ではダウンロードする。共有シートのキャンセルはそのまま終了する。その他の端末は直接ダウンロードする。ファイル名のルールは[要件](requirements.md)を参照。

## モデルと配布先

| 用途 | モデル | ランタイム / 素材の取得元 | 読み込み |
|---|---|---|---|
| 顔検出 | `/models/blaze_face_short_range.tflite` | 同一オリジン `/mediapipe/wasm` | 顔検出時 |
| 顔ランドマーク | `/models/face_landmarker.task` | 同一オリジン `/mediapipe/wasm` | 顔選択時 |
| アニマル素材 | `/animal/*.svg`（12種） | 同一オリジン | 選択UIの素材表示・加工時 |
| 背景分離 | Google配信のMagicTouch / Selfie | jsDelivr、MediaPipe 0.10.35 WASM | 背景変更時 / フォールバック時 |
| 超解像 | Hugging FaceのReal-ESRGAN x4plus float（既定v0.37.0、約67 MB） | 同一オリジン `/litert/wasm/` | 超解像保存時 |

`npm run dev` / `npm run build` の事前処理で `scripts/prepare-runtime-assets.mjs` がMediaPipe・LiteRTのJS/WASMを `public/mediapipe/wasm/`、`public/litert/wasm/` に生成する。Viteのpublic配布を利用し、以前のコピー用プラグインは使用しない。必要な最適化版・フォールバック版がない場合は準備を失敗にし、古い生成ファイルを除去して更新する。Viteを直接起動するときは準備コマンドを先に実行する。

顔モデルとSVGは `public` に同梱する。`npm run check:assets` はdistのモデル2件・SVG12件・JS/WASM14件を元データと照合する。背景分離は同梱WASMではなく外部CDNを利用している。SelfieのモデルURLは `latest` であり、全モデルのバージョン固定は完了していない。CIと依存監査は[導入記録](ci-dependency-check-plan.md)を参照。

`src/config/superResolution.ts` と `.env.example` で超解像の有効化・モデルURLを管理する。manifestとアイコンはあるが、Service Workerやモデルのオフラインキャッシュ管理はない。

## 非同期処理とリソース管理

- 初期化Promiseをモジュールで共有してモデルの重複ロードを抑える
- Landmarkerはリクエスト番号を照合し、戻る・リセット・別顔選択後の古い結果を破棄する
- プレビューは設定変更・画面離脱後の古いCanvasを表示へ反映しない
- 超解像は開始時・モデル準備後・タイル開始時にAbortSignalを確認する。モデル取得や実行中の推論を即時停止する仕組みではない
- 超解像の失敗Promiseはクリアする。一方、MediaPipe各モデルと動物素材の失敗Promiseは現在キャッシュに残る
- 読み込みImageBitmap、入力・出力のObject URL、セグメンテーション結果・マスク、超解像テンソルを解放する
- 通常のリセットではモデルのcloseや `disposeSuperResolution` を呼ばず、ページ内のモデルキャッシュを再利用する

顔再検出の競合、最終タイル後のキャンセル、明示的なモデル再初期化は[確認記録](documentation-audit.md)の継続課題である。

## テスト戦略

観点は機能・非機能・データ・UIに分け、正常系・異常系・境界値・状態遷移を切り分ける。既存の自動テストは背景分離アンカー・連結成分、超解像の適用条件・タイル位置、ランドマーク幾何・候補選択、12プリセット設定を対象とする。Canvas描画、PNG生成、モデル実行、画面遷移のE2Eはこの単体テストに含まれない。

変更範囲に応じて対象E2E、クロスブラウザー、実機確認を選ぶ。同一実機に自動化スクリプトを並列実行せず、入力・端末・OS・ブラウザ・キャッシュ状態とログ・出力画像を記録する。今回の文書変更に対する実施範囲は[確認記録](documentation-audit.md)を参照。
