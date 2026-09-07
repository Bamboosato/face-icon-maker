# アニマルフェイス追加設計

最終更新: 2026-09-07

## 1. 設計方針

アニマルフェイスは、既存の静止画アイコン生成パイプラインへ追加する。

```text
既存のFace Detector
  └─ 顔選択用のFaceBoxを生成

Face Landmarker IMAGE
  └─ 選択顔のランドマークを生成

Animal Effect Renderer
  └─ ランドマーク基準の2D変形と素材合成

既存Render Pipeline
  └─ 背景・既存エフェクト・形状・PNG出力
```

リアルタイム処理や3Dレンダラーは導入しない。Face Landmarkerは選択顔に対して静止画で実行し、結果をCrop編集と出力の両方で再利用する。

## 2. 既存実装との接続

### 2.1 既存の責務を維持するもの

- `src/services/faceDetection.ts`
  - 画像全体の複数顔検出
  - 小さい顔へのタイル検出
  - 顔選択用の `FaceBox` 生成
- `src/services/cropService.ts`
  - 選択顔からの自動Crop生成
  - Cropの範囲補正
- `src/services/renderPipeline.ts`
  - Canvas生成と既存画像処理
  - 背景、スタイル、形状の合成
- `src/services/exportService.ts`
  - PNG生成、保存、共有
- `src/components/CropEditor.tsx`
  - Crop編集画面とプレビュー

### 2.2 追加する責務

```text
src/services/faceLandmarker.ts
  Face Landmarkerの初期化と静止画推論

src/services/animalEffectService.ts
  ランドマークからのアンカー計算と動物効果の描画

src/types/animal.ts
  プリセット、ランドマーク、アンカー、効果設定の型

src/config/animalPresets.ts
  Cat / Dog / Fox / Bearの設定

src/components/AnimalPresetControl.tsx
  プリセット選択UI
```

必要に応じて `src/services/faceLandmarkGeometry.ts` を追加し、座標変換と幾何計算を描画処理から分離する。

## 3. 処理パイプライン

### 3.1 Face Detector段階

既存のFace Detectorで、処理用画像に対する顔矩形を取得する。複数顔の場合は現在のUIでユーザーが1つを選択する。

### 3.2 参照領域の生成

選択された `FaceBox` から、`createAutoCrop` と同じ座標系の参照領域を作る。

参照領域は次の条件を満たすこと。

- 選択顔全体を含む
- 目、鼻、口、輪郭が欠けない
- 必要に応じて髪・耳の配置余白を含む
- 処理用画像の範囲内に収める

Face Landmarkerに渡す画像は、向き補正と縮小が完了した `ProcessedImage` から作る。元のFileを直接渡さないことで、EXIF Orientationによる座標ずれを防ぐ。

### 3.3 Face Landmarker段階

```ts
const options = {
  baseOptions: {
    modelAssetPath: "/models/face_landmarker.task",
  },
  runningMode: "IMAGE",
  numFaces: 1,
  outputFaceBlendshapes: false,
  outputFacialTransformationMatrixes: false,
};
```

初期版では、動物パーツの配置に必要なランドマークだけを使う。顔のロール角は左右の目のランドマークから算出するため、変換行列やブレンドシェイプは必須にしない。

将来、表情に連動した口元変形が必要になった場合だけ、`outputFaceBlendshapes` を有効化する。

### 3.4 座標変換

Face Landmarkerが返す正規化座標を、次の順で変換する。

```text
Landmarker正規化座標
  → 参照領域内のピクセル座標
  → ProcessedImageのピクセル座標
  → 現在のCrop内の正規化座標
  → 出力Canvasのピクセル座標
```

参照領域の左上を `(reference.x, reference.y)`、幅と高さを `(reference.width, reference.height)`、ランドマークを `(u, v)` とすると、処理用画像座標は次で求める。

```text
sourceX = reference.x + u * reference.width
sourceY = reference.y + v * reference.height
```

現在のCropの左上を `(crop.x, crop.y)`、幅と高さを `(crop.width, crop.height)` とすると、Crop内の座標は次で求める。

```text
cropU = (sourceX - crop.x) / crop.width
cropV = (sourceY - crop.y) / crop.height
```

Crop外の点は描画前に範囲検証する。ランドマークは元画像座標で保持するため、Crop変更時にモデルを再実行しない。

## 4. データモデル

```ts
export type AnimalPresetId = "none" | "cat" | "dog" | "fox" | "bear";

export interface SourceLandmark {
  x: number;
  y: number;
  z: number;
}

export interface FaceLandmarkSet {
  landmarks: SourceLandmark[];
  referenceCrop: CropArea;
  sourceImageSize: {
    width: number;
    height: number;
  };
  modelVersion: string;
}

export interface AnimalAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface AnimalWarpOptions {
  eyeScaleX: number;
  eyeScaleY: number;
  noseScale: number;
  muzzleScale: number;
  cheekScale: number;
}

export interface AnimalPreset {
  id: Exclude<AnimalPresetId, "none">;
  label: string;
  warp: AnimalWarpOptions;
  ears?: AnimalAsset;
  nose?: AnimalAsset;
  whiskers?: AnimalAsset;
  mouth?: AnimalAsset;
}

export interface AnimalAsset {
  src: string;
  anchor: "forehead" | "nose" | "mouth" | "cheek";
  scale: number;
  rotation: number;
}
```

ランドマーク配列の添字はUIやプリセットに直接記述しない。`faceLandmarkGeometry.ts` に意味のある定数としてまとめる。

```ts
const LANDMARK = {
  noseTip: [...],
  leftEye: [...],
  rightEye: [...],
  mouth: [...],
  jaw: [...],
} as const;
```

各部位は単一点ではなく、複数点から中心、幅、高さ、方向を計算する。

## 5. 動物効果レンダリング

### 5.1 レンダリング順

既存の処理順を崩さず、次の順序を基本とする。

```text
Crop画像
  ↓
必要に応じて超解像
  ↓
既存の背景処理
  ↓
顔の局所2D変形
  ↓
耳・鼻・ヒゲ・口元の素材合成
  ↓
既存の色・ペイント・ピクセル系エフェクト
  ↓
四角形 / 円形マスク
  ↓
512 × 512 PNG
```

動物素材は背景分離後に合成する。これにより、人工的に追加した耳やヒゲが既存の人物セグメンテーションで消されることを防ぐ。

### 5.2 局所2D変形

初期版ではWebGLや三角形メッシュを導入せず、Canvas 2Dと一時Canvasで局所変形を行う。

基本処理は次のとおり。

1. ランドマークから対象部位の矩形または楕円領域を求める。
2. 対象領域を一時Canvasへコピーする。
3. アンカーを中心に拡大、縮小、回転する。
4. 楕円またはマスクで境界をフェザーする。
5. 元のCanvasへ合成する。

顔全体を一度に変形せず、目元・鼻・口元・頬を独立して処理する。変形パラメータはプリセットで調整し、元画像に対する過度な変形を避ける。

### 5.3 素材合成

素材は透明背景のSVGまたはPNGとする。描画時は次の順で共通処理する。

```text
anchor計算
  → 基準サイズ × 顔幅または目の間隔
  → 基準回転 + 顔のロール角
  → Canvas transform
  → drawImage
```

素材がCrop外へ大きくはみ出す場合はCanvas範囲でクリップする。必要な耳の余白がCropにない場合は、UIにCrop拡張を案内するか、耳を小さくして描画する。

## 6. Face Landmarkerのライフサイクル

### 初期化

- モデルはモジュール単位で遅延初期化する。
- 同時に複数の初期化Promiseを作らない。
- モデルのバージョンを固定する。
- WASMとモデルは同一オリジンの静的アセットを優先する。

### 推論

- 顔選択後に参照領域を作り、1回だけ推論する。
- 推論中は処理状態を表示する。
- 推論結果にはリクエストIDを付与する。
- 現在の画像・選択顔・参照領域と一致しない結果は破棄する。

### 解放

- アプリのリセット時に参照Canvasを解放する。
- Object URLを不要になった時点でrevokeする。
- Face Landmarkerのcloseまたは同等の解放処理を呼び出す。
- エラー後に再試行できるよう、失敗したPromiseをキャッシュし続けない。

## 7. エラーとフォールバック

| 状況 | 動作 |
|---|---|
| モデル読み込み失敗 | エラー表示、元のCropで編集・保存可能 |
| Face Landmarkerが顔を返さない | アニマル効果を適用せず、再試行を案内 |
| ランドマーク数不正 | 結果を破棄し、元のCropを保持 |
| 座標が不正 | 効果を適用せず、診断可能なエラーを記録 |
| 素材読み込み失敗 | 該当素材を非表示にし、保存可能かを明示 |
| Canvas描画失敗 | 元のCropへ戻し、既存保存フローを維持 |
| 古い非同期結果 | requestIdと画像IDを照合して破棄 |

エラー時に静かに別の顔へ切り替えたり、古いランドマークを再利用したりしない。

## 8. UI設計

`CropEditor`内に `AnimalPresetControl` を追加する。

```text
アニマルフェイス
[なし] [Cat] [Dog] [Fox] [Bear]
```

- タップ領域はスマートフォンで操作しやすいサイズにする。
- 選択中のプリセットを色だけに依存せず、境界・ラベル・アイコンで示す。
- Face Landmarker実行中はプリセット操作を一時的に無効化する。
- Crop変更後は推論を再実行せず、ローカル座標を再計算する。
- 「なし」を選択すると、既存の動物効果なしの表示へ戻る。
- エラー表示で、ユーザーが元のCropを保存できることを示す。

## 9. 性能・品質方針

- 静止画推論は初回だけ実行する。
- プリセット変更とCrop変更はランドマーク再利用で100ms以内を目標にする。
- 512×512の最終描画はCanvas 2Dで処理する。
- 大きな元画像に対しては、既存の処理用画像の最大辺制限を利用する。
- 変形対象領域だけを一時Canvasへコピーし、画像全体の不要な再処理を避ける。
- プレビューと保存で同じレンダリング関数を利用する。

品質確認では、正面顔だけでなく、斜め顔、横顔、眼鏡、帽子、画像端の顔、顔の大小を必ず含める。

## 10. テスト設計

### 10.1 単体テスト

- 正規化座標から参照領域座標への変換
- 参照領域から処理用画像座標への変換
- 処理用画像座標から現在Crop座標への変換
- 画像端でのクランプ
- ロール角、顔幅、目の間隔の計算
- 欠損値、NaN、無限大の拒否
- プリセット設定の妥当性
- 素材のアンカー計算
- requestIdによる古い結果の破棄

### 10.2 描画テスト

- 4プリセットがCanvasへ描画される
- 変形領域に不連続な境界が出ない
- 円形・四角形マスクが維持される
- PNGサイズが常に512×512である
- 同じ入力に対して描画結果が再現する

### 10.3 統合テスト

- 顔選択からFace Landmarker、プリセット、保存までの一連の処理
- Crop変更後のランドマーク再マッピング
- 背景処理とアニマル素材の合成順
- 既存エフェクトとの組み合わせ
- Landmarker失敗後の元Crop保存

### 10.4 実ブラウザテスト

- モデル未キャッシュ状態とキャッシュ済み状態
- デスクトップChrome
- iPhone Safari相当環境
- Android Chrome相当環境
- 低速回線でのモデル読み込み
- 写真リクエストに画像データが含まれないこと

実ブラウザでは、処理時間、コンソールエラー、ネットワーク要求、入力画像条件、生成PNGを証跡として残す。

## 11. 実装フェーズ

### Phase 1：基盤

- `FaceLandmarker`サービス
- モデル・WASM配置
- ランドマーク型
- 参照領域と座標変換
- Face Landmarkerの単体・統合テスト

### Phase 2：描画

- アンカー計算
- Canvas 2D局所変形
- 素材合成
- プレビューとPNG保存の共通化

### Phase 3：プリセット

- Cat
- Dog
- Fox
- Bear
- 各プリセットの画面・実画像調整

### Phase 4：回帰確認

- 既存の顔選択・Crop・背景・既存エフェクト・保存の回帰テスト
- 実ブラウザでの画像条件別確認
- ドキュメントと受け入れ基準の更新

## 12. 設計上の判断

- Face DetectorとFace Landmarkerを同じ用途で競合させず、前者を顔選択、後者を選択顔の精密配置に使う。
- Face Landmarkerは静止画で1回だけ実行し、Crop編集で再利用する。
- 3Dやリアルタイム処理を導入せず、Canvas 2Dと静止画ランドマークで完成度を上げる。
- プレビューと出力の処理を共通化し、見た目の不一致を防ぐ。
- エラー時も既存の顔アイコン作成機能を利用できる状態を維持する。
