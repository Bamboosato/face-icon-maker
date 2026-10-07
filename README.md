# Face Icon Maker

集合写真から顔を選び、プロフィール用PNGアイコンを作るブラウザ完結型アプリです。写真はサーバーへ送信せず、顔検出・切り抜き・背景除去・アニマル加工・超解像・PNG生成を端末内で処理します。

実装との照合日: 2026-10-06。性能値は目標、実機確認は過去の記録です。今回の確認範囲は[文書整合性の確認記録](docs/documentation-audit.md)を参照してください。

本番版: [https://face-icon-maker.vercel.app](https://face-icon-maker.vercel.app)

## 主な機能

- JPEG / PNGの集合写真を読み込み、複数の顔を自動検出
- 検出感度の調整（0.10〜0.95）と再検出。全体画像で顔が見つからない場合はタイル検出を試行
- 検出枠から任意の顔を選択し、顔の周囲を含めて自動切り抜き
- 1:1の範囲で位置・拡大率を調整
- 四角形 / 円形アイコン
- 通常 / ピクセル / コミック / ペイントのスタイル
- ピクセルの粒度3段階と、ペイントの強さ調整
- 元背景 / 透明背景 / 単色背景（4色）
- 選択した顔を起点にした背景除去と、汎用人物セグメンテーションへのフォールバック
- 静止画の顔ランドマークに合わせた12種類のアニマルフェイス
- 低解像度の顔に対する任意の4倍超解像
- 512 × 512ピクセルのPNG保存・共有

## 基本フロー

1. 集合写真を選ぶ
2. 検出された顔を選ぶ
3. 必要な場合だけ切り抜き・アニマルフェイス・形・背景・スタイルを調整する
4. PNGを保存または共有する

目標は、この一連の操作を30秒以内で完了できることです。

## アニマルフェイスについて

編集画面の `Animal face` から、None / Cat / Dog / Fox / Bear / Elephant / Lion / Rabbit / Panda / Raccoon / Tiger / Wolf / Hamsterを選べます。

- 顔選択のたびにMediaPipe Face Landmarkerを静止画モードで実行し、選択顔に近いランドマークを利用
- 元の顔を残し、顔の大きさと傾きに合わせてローカルSVGと目元・口元の装飾を合成
- 切り抜き・プリセット変更ではランドマークを再利用。超解像保存でも座標を変換して配置
- 解析中・解析失敗時はアニマル選択を無効化し、通常の編集・保存は継続可能

顔認証、カメラ・動画追従、AI画像生成、顔の画素を引き伸ばす局所変形は実装していません。顔が切り抜き範囲から外れたり素材取得に失敗したりすると、装飾が欠ける・適用されない場合があります。

## 超解像について

超解像は、切り抜き元が512ピクセル未満の場合に利用できます。256ピクセル未満では利用を推奨表示します。

- Real-ESRGAN x4を使い、切り抜いた顔画像を中間的に縦横4倍へ復元
- 超解像後の画像を使って背景除去とエフェクトを実行
- 最終PNGは常に512 × 512ピクセル
- WebGPUを優先し、利用できない環境ではWASMへフォールバック
- モデルは初回利用時だけ遅延読み込み
- 失敗時は通常処理に戻して保存可能
- 超解像は保存時に実行するため、画面のプレビューは超解像前の画像

「4倍」は最終ファイルの寸法ではなく、モデル内部の復元倍率です。

## プライバシーとネットワーク

選択した写真や生成画像をアプリのサーバーへアップロードしません。処理はブラウザ内で完結します。

初回利用時には、顔検出・背景除去・超解像に必要なモデルやランタイムを配信元から取得するため、ネットワーク接続が必要です。取得後の再利用可否はブラウザのキャッシュ状態に依存します。

顔検出・顔ランドマークのモデルとWASM、動物SVGはアプリに同梱しています。背景除去はGoogleのモデル配信とjsDelivrのWASM、超解像は既定でHugging Faceのモデルと同一オリジンのLiteRT WASMを利用します。写真・編集設定・ランドマークの永続保存はありません。

ホーム画面追加用のmanifestとアイコンはありますが、Service Workerやオフライン動作の保証はありません。

## 入力条件

- 形式: JPEG / PNG
- ファイルサイズ: 50 MiB未満（50 × 1024 × 1024バイト）
- 画素数: 50メガピクセル未満
- 一辺: 12,000ピクセル未満
- 処理時は長辺最大3,000ピクセルへ縮小

## 開発

前提: Node.js 24系 / npm 11.19.0（`.nvmrc` と `package.json` に指定。GitHub Actionsも同じ条件で検証）。Node.jsに同梱されるnpmの版は異なる場合があります。グローバルのnpmを変更しない場合は、以下の `npm` を `npx --yes npm@11.19.0` に置き換えて実行できます。

```bash
npm ci --include=dev
npm run dev
```

主なコマンド:

```bash
npm test
npm run typecheck
npm run test:assets
npm run test:security
npm run audit:security
npm run build
npm run check:assets
npm run preview
```

超解像設定は [`.env.example`](.env.example) を参照し、必要に応じて `.env.local` に記載してください。`VITE_SUPER_RESOLUTION_ENABLED=false` で選択肢を非表示、`VITE_SUPER_RESOLUTION_MODEL_URL` でモデル取得先を変更できます。モデルの入出力互換性は呼び出し側で確認してください。

`npm run dev` / `npm run build` は事前に `prepare:assets` を実行し、インストール済みのLiteRT・MediaPipeからJS/WASMを `public/litert/wasm/`、`public/mediapipe/wasm/` へ生成します。Viteのpublic配布によりURLは `/litert/wasm/`、`/mediapipe/wasm/` です。生成先はGit管理から除外しています。Viteを直接起動する場合は先に `npm run prepare:assets` が必要です。

## CI と依存監査

[GitHub Actions](.github/workflows/ci.yml) はmain向けPR、mainへのpush、手動実行で、Ubuntu / Node.js 24の2ジョブを実行します。

- **Verify**: `npm ci --include=dev`、型チェック、既存テスト、アセット検査のテスト、本番ビルド、配布アセット確認。
- **Dependency security**: クリーンインストール、監査判定テスト、本番分類と全依存のnpm監査。監査JSONは失敗時も成果物として14日保持します。

本番分類・全依存とも重大度を問わず指摘を失敗にします。通信失敗、タイムアウト、不正JSON、集計や終了コードの矛盾も失敗にします。現時点で監査例外はありません。将来の開発専用例外は、担当・理由・期限・アドバイザリ・パッケージ・バージョン・固定依存パスを限定し、別問題・critical・期限切れ・本番依存化を許可しません。

配布検査は顔モデル2件、動物SVG12件、MediaPipe・LiteRTのJS/WASM14件を元データと照合します。推論・描画・PNG・スマートフォンでの動作はこの静的検査に含みません。Lint・対象E2E・定期監査は後続範囲です。mainの必須チェック設定は別途必要で、ワークフローだけでマージやVercelデプロイを遮断するものではありません。経緯と検証範囲は[CI導入記録](docs/ci-dependency-check-plan.md)を参照してください。

## 技術構成

- React / TypeScript / Vite
- Tailwind CSS
- MediaPipe Face Detector
- MediaPipe Face Landmarker（静止画の選択顔解析）
- MediaPipe Interactive Segmenter（MagicTouch）
- MediaPipe Selfie Segmenter（フォールバック）
- LiteRT.js / Real-ESRGAN x4
- HTML5 Canvas

バックエンド、データベース、ユーザーアカウント、有料APIは使用しません。

## ドキュメント

- [要件](docs/requirements.md)
- [アーキテクチャ](docs/architecture.md)
- [画面遷移](docs/screen-flow.md)
- [実装・検証タスク](docs/tasks-mvp.md)
- [アニマルフェイス要件](docs/animal-face-requirements.md)
- [アニマルフェイス設計](docs/animal-face-architecture.md)
- [超解像の導入・検証記録](docs/super-resolution-feasibility.md)
- [文書整合性の確認記録](docs/documentation-audit.md)
- [CI・依存関係チェックの導入記録](docs/ci-dependency-check-plan.md)

## 過去の確認記録がある環境

- デスクトップ版Chrome
- iPhone 13 Pro Max（超解像を含む保存処理を実機確認）

端末性能、OS、ブラウザ、ネットワーク状態により、モデルの初回読み込み時間と超解像の処理時間は変動します。

スマートフォン判定時は `Share PNG`、それ以外は `Save PNG` を表示します。ファイル共有APIが利用できない、または共有がキャンセル以外の理由で失敗した場合はダウンロードへ戻ります。共有シートをキャンセルした場合は保存を開始しません。
