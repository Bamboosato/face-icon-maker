import {
  FaceLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";
import type { CropArea } from "../types/crop";
import type { FaceLandmarkSet } from "../types/animal";
import type { FaceBox } from "../types/face";
import type { ProcessedImage } from "../types/image";
import { selectClosestFaceLandmarks } from "./faceLandmarkSelection";
import { loadImage } from "./renderPipeline";

export const FACE_LANDMARKER_MODEL_VERSION = "1";

const TASKS_VERSION = "0.10.35";
const WASM_URL = "/mediapipe/wasm";
const MODEL_URL = "/models/face_landmarker.task";

let landmarkerPromise: Promise<FaceLandmarker> | undefined;

export async function detectSelectedFaceLandmarks(
  image: ProcessedImage,
  referenceCrop: CropArea,
  selectedFace: FaceBox,
): Promise<FaceLandmarkSet> {
  const [landmarker, source] = await Promise.all([getFaceLandmarker(), loadImage(image.url)]);
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = Math.max(1, Math.round(referenceCrop.width));
  cropCanvas.height = Math.max(1, Math.round(referenceCrop.height));

  const context = cropCanvas.getContext("2d");

  if (!context) {
    throw new Error("Face landmark canvas could not be created.");
  }

  context.drawImage(
    source,
    referenceCrop.x,
    referenceCrop.y,
    referenceCrop.width,
    referenceCrop.height,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height,
  );

  const result = landmarker.detect(cropCanvas);
  const targetCenter = {
    x: (selectedFace.x + selectedFace.width / 2 - referenceCrop.x) / referenceCrop.width,
    y: (selectedFace.y + selectedFace.height / 2 - referenceCrop.y) / referenceCrop.height,
  };
  const landmarks = selectClosestFaceLandmarks(result.faceLandmarks, targetCenter);

  if (!landmarks || landmarks.length < 468) {
    throw new Error("Face landmarks were not detected.");
  }

  return {
    landmarks: landmarks.map((landmark) => ({
      x: referenceCrop.x + landmark.x * referenceCrop.width,
      y: referenceCrop.y + landmark.y * referenceCrop.height,
      z: landmark.z,
    })),
    referenceCrop,
    sourceImageSize: { width: image.width, height: image.height },
    modelVersion: FACE_LANDMARKER_MODEL_VERSION,
  };
}

async function getFaceLandmarker(): Promise<FaceLandmarker> {
  landmarkerPromise ??= createFaceLandmarker();
  return landmarkerPromise;
}

async function createFaceLandmarker(): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);

  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
    },
    runningMode: "IMAGE",
    numFaces: 3,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });
}

export function resetFaceLandmarkerForTests() {
  landmarkerPromise = undefined;
}

export { TASKS_VERSION };
