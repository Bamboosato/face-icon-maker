import type { CropArea, IconShape } from "../types/crop";
import { DEFAULT_EFFECT_OPTIONS, type EffectOptions } from "../types/effect";
import { DEFAULT_BACKGROUND_OPTIONS, type BackgroundOptions } from "../types/background";
import { createPersonMask, type SegmentationMask } from "./segmentationService";

export async function renderIconToCanvas(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  crop: CropArea,
  shape: IconShape,
  effectOptions: EffectOptions = DEFAULT_EFFECT_OPTIONS,
  backgroundOptions: BackgroundOptions = DEFAULT_BACKGROUND_OPTIONS,
) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const workCanvas = createCanvas(canvas.width, canvas.height);
  const workContext = workCanvas.getContext("2d");

  if (!workContext) {
    return;
  }

  workContext.clearRect(0, 0, workCanvas.width, workCanvas.height);
  workContext.imageSmoothingEnabled = true;
  workContext.imageSmoothingQuality = "high";
  workContext.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    workCanvas.width,
    workCanvas.height,
  );

  if (backgroundOptions.mode !== "original") {
    await applyBackground(workCanvas, backgroundOptions);
  }

  applyEffect(workCanvas, effectOptions);

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();

  if (shape === "circle") {
    context.beginPath();
    context.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
    context.clip();
  }

  context.imageSmoothingEnabled = effectOptions.effect !== "pixel-art";
  context.drawImage(workCanvas, 0, 0, canvas.width, canvas.height);
  context.restore();
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image."));
    image.src = url;
  });
}

function applyEffect(canvas: HTMLCanvasElement, effectOptions: EffectOptions) {
  if (effectOptions.effect === "pixel-art") {
    applyPixelArt(canvas, effectOptions.pixelSize);
  }
}

async function applyBackground(
  sourceCanvas: HTMLCanvasElement,
  backgroundOptions: BackgroundOptions,
) {
  const sourceContext = sourceCanvas.getContext("2d");

  if (!sourceContext) {
    return;
  }

  let personMask: SegmentationMask;

  try {
    personMask = await createPersonMask(sourceCanvas);
  } catch {
    return;
  }

  const sourceImage = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const outputImage = sourceContext.createImageData(sourceCanvas.width, sourceCanvas.height);
  const backgroundColor = hexToRgb(backgroundOptions.color);

  for (let y = 0; y < sourceCanvas.height; y++) {
    for (let x = 0; x < sourceCanvas.width; x++) {
      const pixelIndex = y * sourceCanvas.width + x;
      const sourceIndex = pixelIndex * 4;
      const maskValue = getMaskValue(personMask, x, y, sourceCanvas.width, sourceCanvas.height);
      const alpha = smoothstep(0.2, 0.78, maskValue);

      if (backgroundOptions.mode === "transparent") {
        outputImage.data[sourceIndex] = sourceImage.data[sourceIndex];
        outputImage.data[sourceIndex + 1] = sourceImage.data[sourceIndex + 1];
        outputImage.data[sourceIndex + 2] = sourceImage.data[sourceIndex + 2];
        outputImage.data[sourceIndex + 3] = Math.round(sourceImage.data[sourceIndex + 3] * alpha);
        continue;
      }

      outputImage.data[sourceIndex] = Math.round(
        sourceImage.data[sourceIndex] * alpha + backgroundColor.r * (1 - alpha),
      );
      outputImage.data[sourceIndex + 1] = Math.round(
        sourceImage.data[sourceIndex + 1] * alpha + backgroundColor.g * (1 - alpha),
      );
      outputImage.data[sourceIndex + 2] = Math.round(
        sourceImage.data[sourceIndex + 2] * alpha + backgroundColor.b * (1 - alpha),
      );
      outputImage.data[sourceIndex + 3] = sourceImage.data[sourceIndex + 3];
    }
  }

  sourceContext.putImageData(outputImage, 0, 0);
}

function applyPixelArt(canvas: HTMLCanvasElement, pixelSize: number) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const lowResolutionSize = Math.min(pixelSize, canvas.width, canvas.height);
  const pixelCanvas = createCanvas(lowResolutionSize, lowResolutionSize);
  const pixelContext = pixelCanvas.getContext("2d");

  if (!pixelContext) {
    return;
  }

  pixelContext.imageSmoothingEnabled = true;
  pixelContext.imageSmoothingQuality = "low";
  pixelContext.drawImage(canvas, 0, 0, lowResolutionSize, lowResolutionSize);

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  context.drawImage(pixelCanvas, 0, 0, canvas.width, canvas.height);
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getMaskValue(
  mask: SegmentationMask,
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  const maskX = Math.min(mask.width - 1, Math.max(0, Math.floor((x / canvasWidth) * mask.width)));
  const maskY = Math.min(mask.height - 1, Math.max(0, Math.floor((y / canvasHeight) * mask.height)));

  return mask.data[maskY * mask.width + maskX] ?? 0;
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hexToRgb(hexColor: string) {
  const normalized = hexColor.replace("#", "");
  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}
