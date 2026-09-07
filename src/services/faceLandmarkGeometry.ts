import type { CropArea } from "../types/crop";
import type { FaceLandmarkSet, SourceLandmark } from "../types/animal";

const LANDMARK = {
  leftEye: [33, 133, 159, 145],
  rightEye: [263, 362, 386, 374],
  nose: [1, 2, 4, 5, 98, 327],
  mouth: [13, 14, 61, 291],
  cheeks: [50, 205, 280, 425],
  faceBounds: [10, 152, 234, 454],
} as const;

export interface Point {
  x: number;
  y: number;
}

export interface FaceLandmarkAnchors {
  faceCenter: Point;
  noseCenter: Point;
  mouthCenter: Point;
  leftEyeCenter: Point;
  rightEyeCenter: Point;
  faceWidth: number;
  faceHeight: number;
  eyeDistance: number;
  rotation: number;
}

export function getFaceLandmarkAnchors(
  landmarkSet: FaceLandmarkSet,
  crop: CropArea,
  outputSize: number,
): FaceLandmarkAnchors | null {
  const points = landmarkSet.landmarks;
  const leftEye = averageMapped(points, LANDMARK.leftEye, crop, outputSize);
  const rightEye = averageMapped(points, LANDMARK.rightEye, crop, outputSize);
  const nose = averageMapped(points, LANDMARK.nose, crop, outputSize);
  const mouth = averageMapped(points, LANDMARK.mouth, crop, outputSize);
  const cheeks = mappedPoints(points, LANDMARK.cheeks, crop, outputSize);
  const bounds = mappedPoints(points, LANDMARK.faceBounds, crop, outputSize);

  if (!leftEye || !rightEye || !nose || !mouth || cheeks.length < 2 || bounds.length < 2) {
    return null;
  }

  const faceWidth = distance(bounds[2], bounds[3]);
  const faceHeight = distance(bounds[0], bounds[1]);
  const eyeDistance = distance(leftEye, rightEye);

  if (![faceWidth, faceHeight, eyeDistance].every(Number.isFinite) || faceWidth <= 0) {
    return null;
  }

  return {
    faceCenter: midpoint(leftEye, rightEye),
    noseCenter: nose,
    mouthCenter: mouth,
    leftEyeCenter: leftEye,
    rightEyeCenter: rightEye,
    faceWidth,
    faceHeight,
    eyeDistance,
    rotation: Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x),
  };
}

export function remapFaceLandmarkSet(
  landmarkSet: FaceLandmarkSet,
  fromCrop: CropArea,
  toCrop: CropArea,
): FaceLandmarkSet {
  const scaleX = toCrop.width / fromCrop.width;
  const scaleY = toCrop.height / fromCrop.height;

  return {
    ...landmarkSet,
    landmarks: landmarkSet.landmarks.map((landmark) => ({
      ...landmark,
      x: toCrop.x + (landmark.x - fromCrop.x) * scaleX,
      y: toCrop.y + (landmark.y - fromCrop.y) * scaleY,
    })),
    referenceCrop: toCrop,
    sourceImageSize: { width: toCrop.width, height: toCrop.height },
  };
}

function averageMapped(
  points: SourceLandmark[],
  indices: readonly number[],
  crop: CropArea,
  outputSize: number,
): Point | null {
  const mapped = mappedPoints(points, indices, crop, outputSize);

  if (mapped.length === 0) {
    return null;
  }

  return {
    x: mapped.reduce((sum, point) => sum + point.x, 0) / mapped.length,
    y: mapped.reduce((sum, point) => sum + point.y, 0) / mapped.length,
  };
}

function mappedPoints(
  points: SourceLandmark[],
  indices: readonly number[],
  crop: CropArea,
  outputSize: number,
): Point[] {
  const selected = indices.map((index) => points[index]);

  if (!selected.every(isValidLandmark)) {
    return [];
  }

  return selected.map((point) => ({
      x: ((point.x - crop.x) / crop.width) * outputSize,
      y: ((point.y - crop.y) / crop.height) * outputSize,
    }));
}

function isValidLandmark(point: SourceLandmark | undefined): point is SourceLandmark {
  return Boolean(
    point &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      Number.isFinite(point.z),
  );
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
