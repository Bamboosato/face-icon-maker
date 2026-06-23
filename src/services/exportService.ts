import type { CropArea, IconShape } from "../types/crop";
import type { ProcessedImage } from "../types/image";
import { buildDownloadFileName } from "../utils/fileName";

const EXPORT_SIZE = 512;

export async function downloadIcon(
  image: ProcessedImage,
  crop: CropArea,
  shape: IconShape,
) {
  const blob = await createIconPngBlob(image, crop, shape);
  saveBlob(blob, buildDownloadFileName(image.originalName));
}

export async function shareIcon(
  image: ProcessedImage,
  crop: CropArea,
  shape: IconShape,
) {
  const blob = await createIconPngBlob(image, crop, shape);
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
) {
  const source = await loadImage(image.url);
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_SIZE;
  canvas.height = EXPORT_SIZE;

  renderIconToCanvas(canvas, source, crop, shape);

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

export function renderIconToCanvas(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  crop: CropArea,
  shape: IconShape,
) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.save();

  if (shape === "circle") {
    context.beginPath();
    context.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
    context.clip();
  }

  context.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

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
