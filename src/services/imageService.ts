import { ImageProcessingError, type ProcessedImage } from "../types/image";

const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_MEGAPIXELS = 50;
const MAX_DIMENSION = 12000;
const PROCESSING_MAX_LONG_EDGE = 3000;

type DecodedImageSource = ImageBitmap | HTMLImageElement;

export async function processImageFile(file: File): Promise<ProcessedImage> {
  validateFile(file);

  let source: DecodedImageSource | undefined;

  try {
    const orientation = await readExifOrientation(file);
    source = await loadOrientedImageSource(file);
    const { width: sourceWidth, height: sourceHeight } =
      getSourceDimensions(source);
    const megapixels = (sourceWidth * sourceHeight) / 1_000_000;

    if (
      megapixels >= MAX_MEGAPIXELS ||
      sourceWidth >= MAX_DIMENSION ||
      sourceHeight >= MAX_DIMENSION
    ) {
      throw new ImageProcessingError(
        "dimensions-too-large",
        "Image is too large. Try another image.",
      );
    }

    const scale = Math.min(
      1,
      PROCESSING_MAX_LONG_EDGE / Math.max(sourceWidth, sourceHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      throw new ImageProcessingError(
        "load-failed",
        "Could not load image. Try another image.",
      );
    }

    drawScaledImage(context, source, scale);

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
  } finally {
    if (source) {
      closeImageSource(source);
    }
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

async function loadOrientedImageSource(
  file: File,
): Promise<DecodedImageSource> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall through to the HTMLImageElement path for browsers with partial support.
    }
  }

  return loadHtmlImage(file);
}

function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new ImageProcessingError(
          "load-failed",
          "Could not load image. Try another image.",
        ),
      );
    };
    image.src = url;
  });
}

function getSourceDimensions(source: DecodedImageSource): {
  width: number;
  height: number;
} {
  if ("naturalWidth" in source) {
    return {
      width: source.naturalWidth,
      height: source.naturalHeight,
    };
  }

  return {
    width: source.width,
    height: source.height,
  };
}

function closeImageSource(source: DecodedImageSource) {
  if ("close" in source) {
    source.close();
  }
}

function drawScaledImage(
  context: CanvasRenderingContext2D,
  source: DecodedImageSource,
  scale: number,
) {
  context.save();
  context.scale(scale, scale);
  context.drawImage(source, 0, 0);
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
