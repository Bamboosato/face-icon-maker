# Face Icon Maker アーキテクチャ設計

## 1. 設計方針

Face Icon Maker はブラウザのみで動作するクライアントサイド完結型アプリケーションとして実装する。

画像データはサーバーへ送信せず、すべての処理をユーザー端末上で実行する。

目的は以下である。

- 運営コストゼロ
- 高速なレスポンス
- プライバシー保護
- シンプルな運用

---

## 2. システム構成

```text
+----------------+
| User Browser   |
+----------------+
        |
        v
+------------------------+
| React Application      |
+------------------------+
| Upload                 |
| Face Detection         |
| Face Selection         |
| Crop Editor            |
| Canvas Rendering       |
| PNG Export             |
+------------------------+
        |
        v
+------------------------+
| Local Device Storage   |
+------------------------+
```

サーバーサイド処理は存在しない。

---

## 3. 技術スタック

### フロントエンド

- React
- TypeScript
- Vite
- Tailwind CSS

### AI・画像処理

- MediaPipe Face Detection
- HTML5 Canvas
- react-image-crop

### ホスティング

- Vercel
- Netlify
- GitHub Pages

---

## 4. コンポーネント構成

```text
src
├─ pages
├─ components
│  ├─ UploadArea
│  ├─ FaceSelector
│  ├─ CropEditor
│  ├─ IconPreview
│  └─ DownloadButton
│
├─ services
│  ├─ imageService
│  ├─ faceDetection
│  ├─ cropService
│  └─ exportService
│
├─ hooks
│  ├─ useFaceDetection
│  └─ useCrop
│
├─ types
│  ├─ image.ts
│  ├─ face.ts
│  └─ crop.ts
│
└─ utils
```

---

## 5. データフロー

### Step1 画像選択

```text
ユーザー
 ↓
画像選択
 ↓
形式・サイズ検証
 ↓
EXIF orientation補正
 ↓
処理用画像生成
 ↓
ObjectURL生成
 ↓
プレビュー表示
```

画像選択後は、検出・編集表示に使う画像を必ず「向き補正済み・長辺3000px以下」の処理用画像へ正規化する。

顔検出、顔枠表示、クロップ編集は、この処理用画像を基準に実行する。

---

### Step2 顔検出

```text
画像
 ↓
MediaPipe
 ↓
顔座標取得
 ↓
しきい値未満を除外
 ↓
Face[]生成
 ↓
画面描画
```

Faceオブジェクト

```ts
interface Face {
  id: string
  x: number
  y: number
  width: number
  height: number
}
```

`x`, `y`, `width`, `height` は処理用画像のピクセル座標を基準とする。

表示上のCSS座標は保持せず、描画時に表示倍率へ変換する。

---

### Step3 顔選択

```text
顔タップ
 ↓
選択状態更新
 ↓
編集画面表示
```

---

### Step4 クロップ生成

```text
顔矩形
 ↓
余白拡張
 ↓
1:1領域生成
 ↓
初期クロップ表示
```

推奨値

```text
顔矩形 × 2.2倍
```

顔だけでなく髪や輪郭も含める。

クロップ座標も処理用画像のピクセル座標を基準とし、画像外にはみ出す場合は画像内へ収める。

---

### Step5 PNG生成

```text
Canvas
 ↓
drawImage
 ↓
toDataURL
 ↓
ダウンロード
```

出力仕様

```text
512px × 512px
PNG
```

正方形アイコンは不透明PNG、円形アイコンは円の外側を透明にしたPNGとして出力する。

---

## 6. 状態管理

MVPではReact Stateのみ利用する。

```ts
const [image, setImage]
const [faces, setFaces]
const [selectedFace, setSelectedFace]
const [crop, setCrop]
const [shape, setShape]
```

`image` には元ファイルそのものではなく、向き補正と縮小を済ませた処理用画像、および表示に必要なメタ情報を保持する。

ReduxやZustandは導入しない。

---

## 7. パフォーマンス方針

### 対象画像

推奨

```text
処理用画像 長辺3000px以下
```

入力画像の制限

```text
ファイルサイズ 50MB未満
総画素数 50MP未満
幅・高さ 12000px未満
```

上記を超える画像は、ブラウザ内でのデコードやCanvas処理が不安定になりやすいためエラーとする。

### 最適化

画像読込時

```text
EXIF orientation補正
↓
処理用縮小画像
↓
顔検出
```

を利用する。

顔検出とクロップ編集は処理用画像で行い、画面表示時のみ表示サイズへスケール変換する。

### 目標

| 項目 | 目標 |
|--------|--------|
| 顔検出開始 | 3秒以内 |
| 顔選択反応 | 100ms以内 |
| PNG生成 | 1秒以内 |

---

## 8. エラーハンドリング

### 顔未検出

```text
顔を検出できませんでした。
別の画像を選択してください。
```

MVPでは手動クロップによる救済は行わず、別の画像選択を促す。

### 対応形式外

```text
JPEGまたはPNG画像を選択してください。
```

### 読込失敗

```text
画像を読み込めませんでした。
別の画像を選択してください。
```

### メモリ不足

```text
画像サイズが大きすぎます。
別の画像を選択してください。
```

### 顔が多い場合

顔が多いことはエラーではない。

```text
顔が多数検出されました。
対象者を選択してください。
```

顔検出候補が多い、または少ない場合は、画面上の Detection threshold を変更して再検出できる。

---

## 9. セキュリティ・プライバシー

### 方針

画像はサーバーへ送信しない。

### 実装

- APIサーバーなし
- DBなし
- ログ保存なし
- ユーザー登録なし

### メリット

- 個人情報保持なし
- 運営コスト削減
- 通信待ちなし

---

## 10. 将来拡張

### Phase2

```text
MediaPipe Segmentation
 ↓
背景透過
```

### Phase3

```text
WebGPU
 ↓
高速画像処理
```

### Phase4

```text
PWA対応
 ↓
インストール可能
```

---

## 11. アーキテクチャ原則

本アプリは『顔検出』と『顔選択』を中心価値とする。

画像編集機能を増やすことよりも、

集合写真 → 顔選択 → アイコン完成

を最短で実現することを優先する。
