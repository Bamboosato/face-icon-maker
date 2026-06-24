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

  if (backgroundOptions.mode !== "original" && shouldApplyEffectBeforeBackground(effectOptions)) {
    const personMask = await createBackgroundMask(workCanvas);
    applyEffect(workCanvas, effectOptions);

    if (personMask) {
      applyBackgroundWithMask(workCanvas, backgroundOptions, personMask);
    }
  } else {
    if (backgroundOptions.mode !== "original") {
      await applyBackground(workCanvas, backgroundOptions);
    }

    applyEffect(workCanvas, effectOptions);
  }

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
    return;
  }

  if (effectOptions.effect === "comic") {
    applyComicEffect(canvas);
    return;
  }

  if (effectOptions.effect === "paint") {
    applyPaintEffect(canvas, effectOptions.paintStrength);
  }
}

function shouldApplyEffectBeforeBackground(effectOptions: EffectOptions) {
  return effectOptions.effect === "comic" || effectOptions.effect === "paint";
}

async function applyBackground(
  sourceCanvas: HTMLCanvasElement,
  backgroundOptions: BackgroundOptions,
) {
  const personMask = await createBackgroundMask(sourceCanvas);

  if (!personMask) {
    return;
  }

  applyBackgroundWithMask(sourceCanvas, backgroundOptions, personMask);
}

async function createBackgroundMask(sourceCanvas: HTMLCanvasElement) {
  try {
    return await createPersonMask(sourceCanvas);
  } catch {
    return undefined;
  }
}

function applyBackgroundWithMask(
  sourceCanvas: HTMLCanvasElement,
  backgroundOptions: BackgroundOptions,
  personMask: SegmentationMask,
) {
  const sourceContext = sourceCanvas.getContext("2d");

  if (!sourceContext) {
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
      const sourceAlpha = sourceImage.data[sourceIndex + 3] / 255;
      const personAlpha = alpha * sourceAlpha;

      if (backgroundOptions.mode === "transparent") {
        outputImage.data[sourceIndex] = sourceImage.data[sourceIndex];
        outputImage.data[sourceIndex + 1] = sourceImage.data[sourceIndex + 1];
        outputImage.data[sourceIndex + 2] = sourceImage.data[sourceIndex + 2];
        outputImage.data[sourceIndex + 3] = Math.round(255 * personAlpha);
        continue;
      }

      outputImage.data[sourceIndex] = Math.round(
        sourceImage.data[sourceIndex] * personAlpha + backgroundColor.r * (1 - personAlpha),
      );
      outputImage.data[sourceIndex + 1] = Math.round(
        sourceImage.data[sourceIndex + 1] * personAlpha + backgroundColor.g * (1 - personAlpha),
      );
      outputImage.data[sourceIndex + 2] = Math.round(
        sourceImage.data[sourceIndex + 2] * personAlpha + backgroundColor.b * (1 - personAlpha),
      );
      outputImage.data[sourceIndex + 3] = 255;
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

function applyComicEffect(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const sourceImage = context.getImageData(0, 0, canvas.width, canvas.height);
  const outputImage = context.createImageData(canvas.width, canvas.height);
  const grayscale = createGrayscaleMap(sourceImage.data, canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const pixelIndex = y * canvas.width + x;
      const sourceIndex = pixelIndex * 4;
      const alpha = sourceImage.data[sourceIndex + 3];

      if (alpha === 0) {
        outputImage.data[sourceIndex + 3] = 0;
        continue;
      }

      const edgeStrength = getSobelEdgeStrength(grayscale, x, y, canvas.width, canvas.height);

      if (alpha > 48 && edgeStrength > 92) {
        outputImage.data[sourceIndex] = 22;
        outputImage.data[sourceIndex + 1] = 29;
        outputImage.data[sourceIndex + 2] = 31;
        outputImage.data[sourceIndex + 3] = Math.min(255, Math.round(alpha * 0.96));
        continue;
      }

      const color = posterizeColor(
        sourceImage.data[sourceIndex],
        sourceImage.data[sourceIndex + 1],
        sourceImage.data[sourceIndex + 2],
      );

      outputImage.data[sourceIndex] = color.r;
      outputImage.data[sourceIndex + 1] = color.g;
      outputImage.data[sourceIndex + 2] = color.b;
      outputImage.data[sourceIndex + 3] = alpha;
    }
  }

  context.putImageData(outputImage, 0, 0);
}

function applyPaintEffect(canvas: HTMLCanvasElement, paintStrength: number) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const normalizedStrength = clamp(paintStrength, 0, 100) / 100;

  if (normalizedStrength === 0) {
    return;
  }

  const sourceImage = context.getImageData(0, 0, canvas.width, canvas.height);
  const outputImage = context.createImageData(canvas.width, canvas.height);
  const radius = Math.max(1, Math.round(1 + normalizedStrength * 3));
  const blendAmount = 0.2 + normalizedStrength * 0.72;
  const colorLevels = Math.max(7, Math.round(14 - normalizedStrength * 6));

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const sourceIndex = (y * canvas.width + x) * 4;
      const alpha = sourceImage.data[sourceIndex + 3];

      if (alpha === 0) {
        outputImage.data[sourceIndex + 3] = 0;
        continue;
      }

      const color = getKuwaharaColor(sourceImage, x, y, radius);
      const enhancedColor = {
        r: quantizePaintChannel(color.r, colorLevels, normalizedStrength),
        g: quantizePaintChannel(color.g, colorLevels, normalizedStrength),
        b: quantizePaintChannel(color.b, colorLevels, normalizedStrength),
      };

      outputImage.data[sourceIndex] = Math.round(
        mix(sourceImage.data[sourceIndex], enhancedColor.r, blendAmount),
      );
      outputImage.data[sourceIndex + 1] = Math.round(
        mix(sourceImage.data[sourceIndex + 1], enhancedColor.g, blendAmount),
      );
      outputImage.data[sourceIndex + 2] = Math.round(
        mix(sourceImage.data[sourceIndex + 2], enhancedColor.b, blendAmount),
      );
      outputImage.data[sourceIndex + 3] = alpha;
    }
  }

  context.putImageData(outputImage, 0, 0);
}

function getKuwaharaColor(
  sourceImage: ImageData,
  x: number,
  y: number,
  radius: number,
) {
  const regions = [
    getRegionStats(sourceImage, x - radius, y - radius, x, y),
    getRegionStats(sourceImage, x, y - radius, x + radius, y),
    getRegionStats(sourceImage, x - radius, y, x, y + radius),
    getRegionStats(sourceImage, x, y, x + radius, y + radius),
  ];

  return regions.reduce((bestRegion, region) =>
    region.variance < bestRegion.variance ? region : bestRegion,
  ).color;
}

function getRegionStats(
  sourceImage: ImageData,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
) {
  let redSum = 0;
  let greenSum = 0;
  let blueSum = 0;
  let luminanceSum = 0;
  let luminanceSquareSum = 0;
  let count = 0;

  const clampedStartX = Math.max(0, startX);
  const clampedStartY = Math.max(0, startY);
  const clampedEndX = Math.min(sourceImage.width - 1, endX);
  const clampedEndY = Math.min(sourceImage.height - 1, endY);

  for (let y = clampedStartY; y <= clampedEndY; y++) {
    for (let x = clampedStartX; x <= clampedEndX; x++) {
      const sourceIndex = (y * sourceImage.width + x) * 4;
      const red = sourceImage.data[sourceIndex];
      const green = sourceImage.data[sourceIndex + 1];
      const blue = sourceImage.data[sourceIndex + 2];
      const luminance = red * 0.299 + green * 0.587 + blue * 0.114;

      redSum += red;
      greenSum += green;
      blueSum += blue;
      luminanceSum += luminance;
      luminanceSquareSum += luminance * luminance;
      count += 1;
    }
  }

  if (count === 0) {
    return {
      color: { r: 0, g: 0, b: 0 },
      variance: Number.POSITIVE_INFINITY,
    };
  }

  const meanLuminance = luminanceSum / count;

  return {
    color: {
      r: redSum / count,
      g: greenSum / count,
      b: blueSum / count,
    },
    variance: luminanceSquareSum / count - meanLuminance * meanLuminance,
  };
}

function createGrayscaleMap(
  sourceData: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const grayscale = new Uint8ClampedArray(width * height);

  for (let index = 0; index < grayscale.length; index++) {
    const sourceIndex = index * 4;
    const alpha = sourceData[sourceIndex + 3] / 255;
    const luminance =
      sourceData[sourceIndex] * 0.299 +
      sourceData[sourceIndex + 1] * 0.587 +
      sourceData[sourceIndex + 2] * 0.114;

    grayscale[index] = Math.round(luminance * alpha + 255 * (1 - alpha));
  }

  return grayscale;
}

function getSobelEdgeStrength(
  grayscale: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const topLeft = getGrayscaleValue(grayscale, x - 1, y - 1, width, height);
  const top = getGrayscaleValue(grayscale, x, y - 1, width, height);
  const topRight = getGrayscaleValue(grayscale, x + 1, y - 1, width, height);
  const left = getGrayscaleValue(grayscale, x - 1, y, width, height);
  const right = getGrayscaleValue(grayscale, x + 1, y, width, height);
  const bottomLeft = getGrayscaleValue(grayscale, x - 1, y + 1, width, height);
  const bottom = getGrayscaleValue(grayscale, x, y + 1, width, height);
  const bottomRight = getGrayscaleValue(grayscale, x + 1, y + 1, width, height);

  const gx = -topLeft + topRight - 2 * left + 2 * right - bottomLeft + bottomRight;
  const gy = -topLeft - 2 * top - topRight + bottomLeft + 2 * bottom + bottomRight;

  return Math.sqrt(gx * gx + gy * gy);
}

function getGrayscaleValue(
  grayscale: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const clampedX = Math.min(width - 1, Math.max(0, x));
  const clampedY = Math.min(height - 1, Math.max(0, y));

  return grayscale[clampedY * width + clampedX] ?? 255;
}

function posterizeColor(red: number, green: number, blue: number) {
  const luminance = red * 0.299 + green * 0.587 + blue * 0.114;

  return {
    r: posterizeChannel(luminance + (red - luminance) * 1.35),
    g: posterizeChannel(luminance + (green - luminance) * 1.35),
    b: posterizeChannel(luminance + (blue - luminance) * 1.35),
  };
}

function posterizeChannel(value: number) {
  const contrasted = (value - 128) * 1.12 + 132;
  const clamped = Math.min(255, Math.max(0, contrasted));
  const levels = 5;

  return Math.round(Math.round((clamped / 255) * (levels - 1)) * (255 / (levels - 1)));
}

function quantizePaintChannel(value: number, levels: number, strength: number) {
  const contrast = 1 + strength * 0.18;
  const contrasted = (value - 128) * contrast + 128;
  const clamped = clamp(contrasted, 0, 255);

  return Math.round(Math.round((clamped / 255) * (levels - 1)) * (255 / (levels - 1)));
}

function mix(from: number, to: number, amount: number) {
  return from * (1 - amount) + to * amount;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
