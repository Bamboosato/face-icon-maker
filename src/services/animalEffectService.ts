import { getAnimalPreset } from "../config/animalPresets";
import type { AnimalEffectOptions } from "../types/animal";
import type { CropArea } from "../types/crop";
import { getFaceLandmarkAnchors, type FaceLandmarkAnchors } from "./faceLandmarkGeometry";

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export async function applyAnimalEffect(
  canvas: HTMLCanvasElement,
  crop: CropArea,
  options: AnimalEffectOptions,
) {
  if (options.preset === "none" || !options.landmarks) {
    return;
  }

  const preset = getAnimalPreset(options.preset);
  const anchors = getFaceLandmarkAnchors(options.landmarks, crop, canvas.width);

  if (!preset || !anchors) {
    return;
  }

  let overlay: HTMLImageElement;

  try {
    overlay = await loadOverlay(preset.overlayUrl);
  } catch {
    return;
  }

  drawLocalMuzzle(canvas, anchors, preset.warp.noseScale, preset.warp.muzzleScale);
  drawEyeAccents(canvas, anchors, preset.warp.eyeScale);
  drawOverlay(canvas, overlay, anchors);
}

function drawLocalMuzzle(
  canvas: HTMLCanvasElement,
  anchors: FaceLandmarkAnchors,
  noseScale: number,
  muzzleScale: number,
) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.save();
  context.translate(anchors.noseCenter.x, anchors.noseCenter.y);
  context.rotate(anchors.rotation);
  context.globalAlpha = Math.min(0.18, Math.max(0, Math.abs(muzzleScale - 1) * 0.45));
  context.fillStyle = "rgba(255, 245, 232, 0.9)";
  context.beginPath();
  context.ellipse(
    0,
    anchors.faceHeight * 0.055,
    anchors.eyeDistance * 0.35 * noseScale,
    anchors.eyeDistance * 0.22 * muzzleScale,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();
}

function drawOverlay(
  canvas: HTMLCanvasElement,
  overlay: HTMLImageElement,
  anchors: NonNullable<ReturnType<typeof getFaceLandmarkAnchors>>,
) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const size = Math.max(1, anchors.faceWidth * 1.9);
  const anchorX = size * 0.5;
  const anchorY = size * 0.57;

  context.save();
  context.translate(anchors.noseCenter.x, anchors.noseCenter.y);
  context.rotate(anchors.rotation);
  context.globalCompositeOperation = "source-over";
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(overlay, -anchorX, -anchorY, size, size);
  context.restore();
}

function drawEyeAccents(canvas: HTMLCanvasElement, anchors: FaceLandmarkAnchors, eyeScale: number) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const eyeLength = anchors.eyeDistance * 0.18 * eyeScale;
  const eyeLift = anchors.eyeDistance * 0.045;

  context.save();
  context.translate(anchors.leftEyeCenter.x, anchors.leftEyeCenter.y);
  context.rotate(anchors.rotation);
  drawEyeAccent(context, eyeLength, eyeLift);
  context.restore();

  context.save();
  context.translate(anchors.rightEyeCenter.x, anchors.rightEyeCenter.y);
  context.rotate(anchors.rotation);
  drawEyeAccent(context, eyeLength, eyeLift);
  context.restore();
}

function drawEyeAccent(context: CanvasRenderingContext2D, width: number, lift: number) {
  context.strokeStyle = "rgba(63, 41, 50, 0.45)";
  context.lineWidth = Math.max(1, width * 0.08);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(-width / 2, -lift);
  context.quadraticCurveTo(0, -lift * 1.7, width / 2, -lift);
  context.stroke();
}

function loadOverlay(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);

  if (cached) {
    return cached;
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load animal overlay: ${url}`));
    image.src = url;
  });

  imageCache.set(url, promise);
  return promise;
}

export function resetAnimalEffectCacheForTests() {
  imageCache.clear();
}
