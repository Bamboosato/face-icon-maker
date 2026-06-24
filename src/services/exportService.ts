import type { CropArea, IconShape } from "../types/crop";
import { DEFAULT_EFFECT_OPTIONS, type EffectOptions } from "../types/effect";
import { DEFAULT_BACKGROUND_OPTIONS, type BackgroundOptions } from "../types/background";
import type { ProcessedImage } from "../types/image";
import { buildDownloadFileName } from "../utils/fileName";
import { loadImage, renderIconToCanvas } from "./renderPipeline";

const EXPORT_SIZE = 512;

export async function downloadIcon(
  image: ProcessedImage,
  crop: CropArea,
  shape: IconShape,
  effectOptions: EffectOptions = DEFAULT_EFFECT_OPTIONS,
  backgroundOptions: BackgroundOptions = DEFAULT_BACKGROUND_OPTIONS,
) {
  const blob = await createIconPngBlob(image, crop, shape, effectOptions, backgroundOptions);
  saveBlob(blob, buildDownloadFileName(image.originalName));
}

export async function shareIcon(
  image: ProcessedImage,
  crop: CropArea,
  shape: IconShape,
  effectOptions: EffectOptions = DEFAULT_EFFECT_OPTIONS,
  backgroundOptions: BackgroundOptions = DEFAULT_BACKGROUND_OPTIONS,
) {
  const blob = await createIconPngBlob(image, crop, shape, effectOptions, backgroundOptions);
  const fileName = buildDownloadFileName(image.originalName);
  const file = new File([blob], fileName, { type: "image/png" });

  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    try {
      await navigator.share({
        files: [file],
        title: "Face Icon",
      });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    }
  }

  saveBlob(blob, fileName);
}

async function createIconPngBlob(
  image: ProcessedImage,
  crop: CropArea,
  shape: IconShape,
  effectOptions: EffectOptions,
  backgroundOptions: BackgroundOptions,
) {
  const source = await loadImage(image.url);
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_SIZE;
  canvas.height = EXPORT_SIZE;

  await renderIconToCanvas(canvas, source, crop, shape, effectOptions, backgroundOptions);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
        return;
      }

      reject(new Error("PNG export failed."));
    }, "image/png");
  });
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
