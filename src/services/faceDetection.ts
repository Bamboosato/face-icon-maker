import {
  FaceDetector,
  FilesetResolver,
  type FaceDetectorResult,
} from "@mediapipe/tasks-vision";
import type { FaceBox } from "../types/face";
import type { ProcessedImage } from "../types/image";
import { loadImage } from "./renderPipeline";

const TASKS_VERSION = "0.10.35";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";

let detectorPromise: Promise<FaceDetector> | undefined;

export async function detectFaces(
  image: ProcessedImage,
  detectionThreshold: number,
): Promise<FaceBox[]> {
  const [detector, element] = await Promise.all([getDetector(), loadImage(image.url)]);
  const fullImageFaces = filterByThreshold(
    mapDetections(detector.detect(element), image),
    detectionThreshold,
  );

  if (fullImageFaces.length > 0) {
    return fullImageFaces;
  }

  return detectTiledFaces(detector, element, image, detectionThreshold);
}

async function getDetector(): Promise<FaceDetector> {
  detectorPromise ??= createDetector();
  return detectorPromise;
}

async function createDetector(): Promise<FaceDetector> {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);

  return FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
    },
    runningMode: "IMAGE",
    minDetectionConfidence: 0.1,
  });
}

function mapDetections(result: FaceDetectorResult, image: ProcessedImage): FaceBox[] {
  return result.detections
    .map((detection, index) => {
      const box = detection.boundingBox;

      if (!box) {
        return undefined;
      }

      const x = clamp(box.originX, 0, image.width);
      const y = clamp(box.originY, 0, image.height);
      const width = clamp(box.width, 0, image.width - x);
      const height = clamp(box.height, 0, image.height - y);
      const score = detection.categories[0]?.score ?? 0;

      return {
        id: `face-${index + 1}`,
        x,
        y,
        width,
        height,
        score,
      };
    })
    .filter((face): face is FaceBox => Boolean(face))
    .sort((a, b) => a.x - b.x);
}

function detectTiledFaces(
  detector: FaceDetector,
  source: HTMLImageElement,
  image: ProcessedImage,
  detectionThreshold: number,
): FaceBox[] {
  const tileSize = Math.min(512, Math.max(320, Math.round(Math.min(image.width, image.height) / 2)));
  const step = Math.max(160, Math.round(tileSize * 0.5));
  const tiles = createTiles(image.width, image.height, tileSize, step);
  const canvas = document.createElement("canvas");
  canvas.width = tileSize;
  canvas.height = tileSize;
  const context = canvas.getContext("2d");

  if (!context) {
    return [];
  }

  const faces: FaceBox[] = [];

  for (const tile of tiles) {
    canvas.width = tile.width;
    canvas.height = tile.height;
    context.clearRect(0, 0, tile.width, tile.height);
    context.drawImage(
      source,
      tile.x,
      tile.y,
      tile.width,
      tile.height,
      0,
      0,
      tile.width,
      tile.height,
    );

    const tileFaces = mapDetections(detector.detect(canvas), {
      ...image,
      width: tile.width,
      height: tile.height,
    }).map((face) => ({
      ...face,
      id: `tile-${tile.x}-${tile.y}-${face.id}`,
      x: face.x + tile.x,
      y: face.y + tile.y,
    }));

    faces.push(...tileFaces);
  }

  return filterByThreshold(mergeOverlappingFaces(faces), detectionThreshold)
    .map((face, index) => ({ ...face, id: `face-${index + 1}` }))
    .sort((a, b) => a.x - b.x);
}

function createTiles(width: number, height: number, tileSize: number, step: number) {
  const xs = createAxisPositions(width, tileSize, step);
  const ys = createAxisPositions(height, tileSize, step);

  return xs.flatMap((x) =>
    ys.map((y) => ({
      x,
      y,
      width: Math.min(tileSize, width - x),
      height: Math.min(tileSize, height - y),
    })),
  );
}

function createAxisPositions(length: number, tileSize: number, step: number): number[] {
  if (length <= tileSize) {
    return [0];
  }

  const positions: number[] = [];

  for (let value = 0; value < length - tileSize; value += step) {
    positions.push(value);
  }

  positions.push(length - tileSize);

  return Array.from(new Set(positions));
}

function mergeOverlappingFaces(faces: FaceBox[]): FaceBox[] {
  return faces
    .sort((a, b) => b.score - a.score)
    .reduce<FaceBox[]>((merged, face) => {
      const duplicate = merged.some((existing) => areLikelySameFace(existing, face));

      if (!duplicate) {
        merged.push(face);
      }

      return merged;
    }, []);
}

function filterByThreshold(faces: FaceBox[], detectionThreshold: number): FaceBox[] {
  return faces.filter((face) => face.score >= detectionThreshold);
}

function areLikelySameFace(a: FaceBox, b: FaceBox): boolean {
  if (intersectionOverUnion(a, b) > 0.2) {
    return true;
  }

  const centerAx = a.x + a.width / 2;
  const centerAy = a.y + a.height / 2;
  const centerBx = b.x + b.width / 2;
  const centerBy = b.y + b.height / 2;
  const distance = Math.hypot(centerAx - centerBx, centerAy - centerBy);
  const sameFaceRadius = Math.max(a.width, a.height, b.width, b.height) * 0.6;

  return distance < sameFaceRadius;
}

function intersectionOverUnion(a: FaceBox, b: FaceBox): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const intersectionWidth = Math.max(0, right - left);
  const intersectionHeight = Math.max(0, bottom - top);
  const intersectionArea = intersectionWidth * intersectionHeight;

  if (intersectionArea === 0) {
    return 0;
  }

  const areaA = a.width * a.height;
  const areaB = b.width * b.height;

  return intersectionArea / (areaA + areaB - intersectionArea);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
