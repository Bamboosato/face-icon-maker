# アニマルフェイス追加設計

最終更新: 2026-10-06

現行コードの設計を記載する。当初案の局所2D変形など、未実装の機能は[要件の差分](animal-face-requirements.md)と[確認記録](documentation-audit.md)に分ける。

## 1. 接続と責務

Face Detectorは複数顔の検出・選択、Face Landmarkerは選択顔の静止画解析を担当する。カメラ・動画・3D処理は導入していない。

| ファイル | 責務 |
|---|---|
| `App.tsx` | 顔選択時の解析、状態保持、リクエスト番号による古い結果の破棄 |
| `faceLandmarker.ts` | モデル初期化、参照CropのCanvas化、静止画推論、処理用画像座標への変換 |
| `faceLandmarkSelection.ts` | 候補顔と選択顔中心の距離比較 |
| `faceLandmarkGeometry.ts` | 部位のアンカー・幅・傾き、描画座標と超解像座標への変換 |
| `animalEffectService.ts` | SVG、目元・口元のCanvas装飾 |
| `src/config/animalPresets.ts` / `src/types/animal.ts` | 12プリセットの設定・型 |
| `AnimalPresetControl.tsx` | Noneと12プリセットのSVG付きドロップダウン |
| `renderPipeline.ts` | 背景・アニマル・スタイル・形状の共通描画 |
| `IconPreview.tsx` / `exportService.ts` | 共通描画の呼び出し、192pxプレビュー / 512px PNG |

## 2. 参照領域と候補選択

顔選択時に `createAutoCrop` で生成する領域を参照Cropにする。向き補正・縮小済みの `ProcessedImage` からCanvasへ描き、Face Landmarkerへ渡す。

現行のオプション:

```ts
const options = {
  baseOptions: { modelAssetPath: "/models/face_landmarker.task" },
  runningMode: "IMAGE",
  numFaces: 3,
  minFaceDetectionConfidence: 0.5,
  minFacePresenceConfidence: 0.5,
  outputFaceBlendshapes: false,
  outputFacialTransformationMatrixes: false,
};
```

参照領域に隣人が入る場合を考慮し、最大3顔の候補を取得する。輪郭点10 / 152 / 234 / 454の平均を候補中心とし、参照Crop内へ正規化した選択FaceBoxの中心との距離が最小の候補を採用する。使用可能な候補がない、または468点未満なら解析失敗とする。全候補に対する距離上限は設けていない。

## 3. 座標とアンカー

正規化ランドマーク `(u, v)` を処理用画像座標へ変換する。

```text
sourceX = reference.x + u * reference.width
sourceY = reference.y + v * reference.height
canvasX = (sourceX - crop.x) / crop.width * outputSize
canvasY = (sourceY - crop.y) / crop.height * outputSize
```

x/yは処理用画像のピクセル座標、zはモデルの相対値として保持する。zは描画位置には使用しない。モデル出力を再利用するためCrop変更で再推論しない。Canvas範囲外は描画時にクリップされ、専用の警告・非表示判定はない。

`faceLandmarkGeometry.ts` が部位別のランドマーク番号を集約する。目・鼻・口は複数点の平均、顔幅・高さは輪郭点間の距離、傾きは左右の目に対する `atan2` で計算する。必要点のx/y/zが非有限ならその幾何結果は無効にする。

超解像保存時、`exportService.ts` は中間画像を原点0のCropとして描く。`remapFaceLandmarkSet` で次の座標変換を行い、再推論を避ける。

```text
newX = toCrop.x + (sourceX - fromCrop.x) * toCrop.width / fromCrop.width
newY = toCrop.y + (sourceY - fromCrop.y) * toCrop.height / fromCrop.height
```

## 4. データモデル

型の正本は `src/types/animal.ts` とする。

- `AnimalPresetId`: none / cat / dog / fox / bear / elephant / lion / rabbit / panda / raccoon / tiger / wolf / hamster
- `SourceLandmark`: x / y / z
- `FaceLandmarkSet`: landmarks / referenceCrop / sourceImageSize / modelVersion
- `AnimalWarpOptions`: eyeScale / noseScale / muzzleScale
- `AnimalPreset`: id / label / overlayUrl / warp
- `AnimalEffectOptions`: preset / landmarks

`modelVersion` は `"1"`、初期効果は `{ preset: "none", landmarks: null }`。当初案の `AnimalAsset`、部位別素材、eyeScaleX/Y、cheekScaleは実装型に含まれない。

## 5. 装飾の描画

`applyAnimalEffect` はNone・ランドマークなし・無効アンカー・未定義プリセットなら何も描画しない。素材読み込み後に次を順に行う。

1. 鼻位置と傾きを基準に、薄い口元の楕円を描画する。`noseScale / muzzleScale` で半径・濃さを調整する
2. 左右の目に曲線を描画し、`eyeScale` で線の長さを調整する
3. プリセットのSVG全体を鼻位置へ置き、顔幅の1.9倍で拡縮、顔のロール角で回転する

SVGは1枚に動物パーツをまとめている。部位ごとに別素材を目・鼻・口へ固定する設計ではない。`warp` という設定名でも、顔画素を一時Canvasへ切り出して変形・フェザーする処理は実装していない。素材読み込み失敗は効果全体を省略し、専用エラーを表示しない。

### 共通パイプラインの分岐

| 条件 | 順序 |
|---|---|
| 元背景、または通常 / ピクセル | 必要な背景分離・合成 → アニマル装飾 → スタイル → 四角形 / 円形 |
| 背景変更あり + コミック / ペイント | 加工前のマスク取得 → スタイル → 背景合成 → アニマル装飾 → 四角形 / 円形 |

背景合成後の装飾なので、人工的な耳やヒゲを人物マスクで消さない。コミック / ペイントで背景を変更する場合は装飾にスタイルを再適用しない。

超解像は保存時にこのパイプラインより先に行う。作業Canvasへの描画時にプレビューは192px、PNG保存は512pxへ整えるため、超解像中間画像がそのまま背景分離の入力になるわけではない。設定と関数は共通だが、プレビュー・保存の画素一致は保証しない。

## 6. 配布・ライフサイクル

- `public/models/face_landmarker.task` と `public/animal/*.svg` を同一オリジン配布
- npmの開発・ビルド事前処理でMediaPipeのJS/WASMをpublicに生成し、Viteが `/mediapipe/wasm` で配布
- 初期化Promiseをモジュールで共有し、顔選択ごとに推論
- SVGもURLごとのPromiseをMapで共有。画像選択やStart Overでモデル・素材キャッシュは消さない
- 失敗したLandmarker・SVGのPromiseも現在は保持する。通常UIでのクリア・再初期化はない
- `resetFaceLandmarkerForTests` / `resetAnimalEffectCacheForTests` はテスト用で、通常操作からは呼ばない
- モデルcloseは未実装。画像のObject URLはAppの差し替え・リセット・アンマウント時に解放する

Landmarkerのモデル識別値は1、MediaPipeの参照バージョン定数は0.10.35。依存宣言はキャレット範囲であるため、依存の再現にはlockfileと `npm ci` を使う。

## 7. UIと非同期結果

顔選択後はまず編集画面へ移り、解析中メッセージを表示する。プリセットは `landmarks` がない間無効だが、Crop・形・スタイル・背景・Doneは解析待ちで一律無効にはしない。

`App.tsx` のリクエスト番号で解析結果を照合する。戻る・リセット・別顔選択で番号を更新し、古い結果のstate反映を破棄する。モデル実行そのものを中断する処理ではない。`IconPreview` は別途キャンセルフラグで古い描画Canvasの表示反映を防ぐ。

Landmarker失敗時はアニマルをNoneに戻し、通常Cropを保存できるメッセージを表示する。プリセット欄のヒントは失敗時も `Preparing face landmarks…` のままで、専用の再試行UIはない。モデル取得失敗Promiseが残る場合は、再選択だけでは復旧しないことがある。

## 8. テスト観点と実装範囲

観点を機能（座標・候補・装飾・出力）、非機能（性能・モデル取得・メモリ）、データ（隣人・傾き・欠損）、UI（選択・解析中・失敗）に分け、正常系・異常系・境界値・状態遷移を切り分ける。

既存の単体テスト:

- `faceLandmarkGeometry.test.ts`: アンカー計算、Crop変更時の配置、必要座標の不正値
- `faceLandmarkSelection.test.ts`: 選択顔に最も近い候補、無効候補の除外、候補なし
- `animalPresets.test.ts`: 12種類のID・素材URL・パラメータ、Noneの扱い

超解像用 `remapFaceLandmarkSet`、SVGの実描画、PNG生成、モデル実行、requestIdの競合、全組み合わせのE2Eはこれらのテストでは直接検証していない。ブラウザ・実機ではログ、ネットワーク、画像条件、PNGと操作手順を残す。同一実機でスクリプトを並列実行しない。

性能値や全環境の動作は目標・継続確認として扱う。実施範囲は[タスク](tasks-mvp.md)と[今回の確認記録](documentation-audit.md)に記録する。
