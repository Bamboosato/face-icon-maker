import { ImageProcessingError, type ProcessedImage } from "../types/image";

const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_MEGAPIXELS = 50;
const MAX_DIMENSION = 12000;
const PROCESSING_MAX_LONG_EDGE = 3000;

export async function processImageFile(file: File): Promise<ProcessedImage> {
  validateFile(file);

  try {
    const orientation = await readExifOrientation(file);
    const bitmap = await createBitmapWithoutOrientation(file);
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    const rotated = swapsAxes(orientation);
    const orientedWidth = rotated ? sourceHeight : sourceWidth;
    const orientedHeight = rotated ? sourceWidth : sourceHeight;
    const megapixels = (orientedWidth * orientedHeight) / 1_000_000;

    if (
      megapixels >= MAX_MEGAPIXELS ||
      orientedWidth >= MAX_DIMENSION ||
      orientedHeight >= MAX_DIMENSION
    ) {
      bitmap.close();
      throw new ImageProcessingError(
        "dimensions-too-large",
        "Image is too large. Try another image.",
      );
    }

    const scale = Math.min(
      1,
      PROCESSING_MAX_LONG_EDGE / Math.max(orientedWidth, orientedHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(orientedWidth * scale));
    canvas.height = Math.max(1, Math.round(orientedHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      throw new ImageProcessingError(
        "load-failed",
        "Could not load image. Try another image.",
      );
    }

    drawWithOrientation(context, bitmap, orientation, scale);
    bitmap.close();

    const blob = await canvasToBlob(canvas);

    return {
      originalName: file.name,
      url: URL.createObjectURL(blob),
      width: canvas.width,
      height: canvas.height,
      fileSize: file.size,
      megapixels,
      orientation,
    };
  } catch (error) {
    if (error instanceof ImageProcessingError) {
      throw error;
    }

    throw new ImageProcessingError(
      "load-failed",
      "Could not load image. Try another image.",
    );
  }
}

function validateFile(file: File) {
  const typeSupported = SUPPORTED_TYPES.has(file.type);
  const extensionSupported = /\.(jpe?g|png)$/i.test(file.name);

  if (!typeSupported && !extensionSupported) {
    throw new ImageProcessingError(
      "unsupported-format",
      "Select a JPEG or PNG image.",
    );
  }

  if (file.size >= MAX_FILE_BYTES) {
    throw new ImageProcessingError(
      "file-too-large",
      "Image is too large. Try another image.",
    );
  }
}

async function createBitmapWithoutOrientation(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "none" });
  } catch {
    return createImageBitmap(file);
  }
}

function swapsAxes(orientation: number): boolean {
  return orientation >= 5 && orientation <= 8;
}

function drawWithOrientation(
  context: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  orientation: number,
  scale: number,
) {
  const width = bitmap.width;
  const height = bitmap.height;

  context.save();
  context.scale(scale, scale);

  switch (orientation) {
    case 2:
      context.translate(width, 0);
      context.scale(-1, 1);
      break;
    case 3:
      context.translate(width, height);
      context.rotate(Math.PI);
      break;
    case 4:
      context.translate(0, height);
      context.scale(1, -1);
      break;
    case 5:
      context.rotate(0.5 * Math.PI);
      context.scale(1, -1);
      break;
    case 6:
      context.rotate(0.5 * Math.PI);
      context.translate(0, -height);
      break;
    case 7:
      context.rotate(0.5 * Math.PI);
      context.translate(width, -height);
      context.scale(-1, 1);
      break;
    case 8:
      context.rotate(-0.5 * Math.PI);
      context.translate(-width, 0);
      break;
    default:
      break;
  }

  context.drawImage(bitmap, 0, 0);
  context.restore();
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(
        new ImageProcessingError(
          "load-failed",
          "Could not load image. Try another image.",
        ),
      );
    }, "image/png");
  });
}

async function readExifOrientation(file: File): Promise<number> {
  if (!/jpe?g$/i.test(file.name) && file.type !== "image/jpeg") {
    return 1;
  }

  const buffer = await file.slice(0, 64 * 1024).arrayBuffer();
  const view = new DataView(buffer);

  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) {
    return 1;
  }

  let offset = 2;

  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset);
    offset += 2;

    if ((marker & 0xff00) !== 0xff00) {
      break;
    }

    const segmentLength = view.getUint16(offset);
    const segmentStart = offset + 2;

    if (marker === 0xffe1 && readAscii(view, segmentStart, 4) === "Exif") {
      return readOrientationFromExif(view, segmentStart + 6);
    }

    offset += segmentLength;
  }

  return 1;
}

function readOrientationFromExif(view: DataView, tiffOffset: number): number {
  if (tiffOffset + 8 > view.byteLength) {
    return 1;
  }

  const byteOrder = view.getUint16(tiffOffset);
  const littleEndian = byteOrder === 0x4949;

  if (!littleEndian && byteOrder !== 0x4d4d) {
    return 1;
  }

  const firstIfdOffset = view.getUint32(tiffOffset + 4, littleEndian);
  const directoryOffset = tiffOffset + firstIfdOffset;

  if (directoryOffset + 2 > view.byteLength) {
    return 1;
  }

  const entryCount = view.getUint16(directoryOffset, littleEndian);

  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = directoryOffset + 2 + index * 12;

    if (entryOffset + 12 > view.byteLength) {
      return 1;
    }

    const tag = view.getUint16(entryOffset, littleEndian);

    if (tag === 0x0112) {
      const orientation = view.getUint16(entryOffset + 8, littleEndian);
      return orientation >= 1 && orientation <= 8 ? orientation : 1;
    }
  }

  return 1;
}

function readAscii(view: DataView, offset: number, length: number): string {
  let value = "";

  for (let index = 0; index < length && offset + index < view.byteLength; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index));
  }

  return value;
}
