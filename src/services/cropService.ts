import type { CropArea } from "../types/crop";
import type { FaceBox } from "../types/face";
import type { ProcessedImage } from "../types/image";
import type { SegmentationAnchor } from "./segmentationService";

const FACE_MARGIN_SCALE = 2.2;
const MIN_CROP_SIZE = 96;

export function createAutoCrop(face: FaceBox, image: ProcessedImage): CropArea {
  const faceCenterX = face.x + face.width / 2;
  const faceCenterY = face.y + face.height / 2;
  const rawSize = Math.max(face.width, face.height) * FACE_MARGIN_SCALE;
  const maxSize = Math.min(image.width, image.height);
  const size = Math.max(MIN_CROP_SIZE, Math.min(rawSize, maxSize));

  return clampCropToImage(
    {
      x: faceCenterX - size / 2,
      y: faceCenterY - size / 2,
      width: size,
      height: size,
    },
    image,
  );
}

export function clampCropToImage(crop: CropArea, image: ProcessedImage): CropArea {
  const size = Math.max(
    1,
    Math.min(crop.width, crop.height, image.width, image.height),
  );
  const x = clamp(crop.x, 0, image.width - size);
  const y = clamp(crop.y, 0, image.height - size);

  return {
    x,
    y,
    width: size,
    height: size,
  };
}

export function createSegmentationAnchor(
  face: FaceBox,
  crop: CropArea,
): SegmentationAnchor {
  return {
    x: clamp((face.x + face.width / 2 - crop.x) / crop.width, 0, 1),
    y: clamp((face.y + face.height / 2 - crop.y) / crop.height, 0, 1),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
