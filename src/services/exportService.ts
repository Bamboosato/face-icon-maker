import type { CropArea, IconShape } from "../types/crop";
import { DEFAULT_EFFECT_OPTIONS, type EffectOptions } from "../types/effect";
import { DEFAULT_BACKGROUND_OPTIONS, type BackgroundOptions } from "../types/background";
import type { ProcessedImage } from "../types/image";
import { buildDownloadFileName } from "../utils/fileName";
import { loadImage, renderIconToCanvas } from "./renderPipeline";
import {
  upscaleFaceCrop,
  type SuperResolutionProgress,
} from "./superResolutionService";
import type { SegmentationAnchor } from "./segmentationService";
import type { AnimalEffectOptions } from "../types/animal";
import { remapFaceLandmarkSet } from "./faceLandmarkGeometry";

const EXPORT_SIZE = 512;

export interface IconExportOptions {
  enhanceFace?: boolean;
  onEnhancementProgress?: (progress: SuperResolutionProgress) => void;
  signal?: AbortSignal;
  subjectAnchor?: SegmentationAnchor;
  animalEffect?: AnimalEffectOptions;
}

export interface IconExportResult {
  enhanced: boolean;
  warning?: string;
}

export async function downloadIcon(
  image: ProcessedImage,
  crop: CropArea,
  shape: IconShape,
  effectOptions: EffectOptions = DEFAULT_EFFECT_OPTIONS,
  backgroundOptions: BackgroundOptions = DEFAULT_BACKGROUND_OPTIONS,
  options: IconExportOptions = {},
): Promise<IconExportResult> {
  const result = await createIconPngBlob(
    image,
    crop,
    shape,
    effectOptions,
    backgroundOptions,
    options,
  );
  saveBlob(result.blob, buildDownloadFileName(image.originalName));
  return { enhanced: result.enhanced, warning: result.warning };
}

export async function shareIcon(
  image: ProcessedImage,
  crop: CropArea,
  shape: IconShape,
  effectOptions: EffectOptions = DEFAULT_EFFECT_OPTIONS,
  backgroundOptions: BackgroundOptions = DEFAULT_BACKGROUND_OPTIONS,
  options: IconExportOptions = {},
): Promise<IconExportResult> {
  const result = await createIconPngBlob(
    image,
    crop,
    shape,
    effectOptions,
    backgroundOptions,
    options,
  );
  const fileName = buildDownloadFileName(image.originalName);
  const file = new File([result.blob], fileName, { type: "image/png" });

  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    try {
      await navigator.share({
        files: [file],
        title: "Face Icon",
      });
      return { enhanced: result.enhanced, warning: result.warning };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return { enhanced: result.enhanced, warning: result.warning };
      }
    }
  }

  saveBlob(result.blob, fileName);
  return { enhanced: result.enhanced, warning: result.warning };
}

async function createIconPngBlob(
  image: ProcessedImage,
  crop: CropArea,
  shape: IconShape,
  effectOptions: EffectOptions,
  backgroundOptions: BackgroundOptions,
  options: IconExportOptions,
) {
  const source = await loadImage(image.url);
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_SIZE;
  canvas.height = EXPORT_SIZE;

  let renderSource: CanvasImageSource = source;
  let renderCrop = crop;
  let renderAnimalEffect = options.animalEffect;
  let enhanced = false;
  let warning: string | undefined;

  if (options.enhanceFace) {
    try {
      const result = await upscaleFaceCrop(
        source,
        crop,
        options.onEnhancementProgress,
        options.signal,
      );
      renderSource = result.canvas;
      renderCrop = {
        x: 0,
        y: 0,
        width: result.canvas.width,
        height: result.canvas.height,
      };
      if (renderAnimalEffect?.landmarks) {
        renderAnimalEffect = {
          ...renderAnimalEffect,
          landmarks: remapFaceLandmarkSet(renderAnimalEffect.landmarks, crop, renderCrop),
        };
      }
      enhanced = true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      warning = "Face enhancement was unavailable. Saved the standard PNG instead.";
    }
  }

  await renderIconToCanvas(
    canvas,
    renderSource,
    renderCrop,
    shape,
    effectOptions,
    backgroundOptions,
    options.subjectAnchor,
    renderAnimalEffect,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
        return;
      }

      reject(new Error("PNG export failed."));
    }, "image/png");
  });

  return { blob, enhanced, warning };
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
