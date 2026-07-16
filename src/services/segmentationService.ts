import {
  FilesetResolver,
  ImageSegmenter,
  InteractiveSegmenter,
  type ImageSegmenterResult,
} from "@mediapipe/tasks-vision";

const TASKS_VERSION = "0.10.35";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
const INTERACTIVE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-tasks/interactive_segmenter/ptm_512_hdt_ptm_woid.tflite";
const PERSON_LABEL_PATTERN = /person|human|foreground/i;
export const SELECTED_OBJECT_MASK_THRESHOLD = 0.45;

let segmenterPromise: Promise<ImageSegmenter> | undefined;
let interactiveSegmenterPromise: Promise<InteractiveSegmenter> | undefined;

export interface SegmentationAnchor {
  x: number;
  y: number;
}

export interface SegmentationMask {
  data: Float32Array;
  height: number;
  width: number;
}

export async function createPersonMask(
  source: HTMLCanvasElement,
  anchor?: SegmentationAnchor,
): Promise<SegmentationMask> {
  if (anchor) {
    try {
      return await createSelectedObjectMask(source, anchor);
    } catch {
      // Preserve the existing background-removal path if the interactive model fails.
    }
  }

  const segmenter = await getSegmenter();
  const result = segmenter.segment(source);

  try {
    const confidenceMask = selectPersonConfidenceMask(result, segmenter.getLabels());

    if (!confidenceMask) {
      throw new Error("Person segmentation mask was not returned.");
    }

    const mask = confidenceMask.clone();

    try {
      return {
        data: new Float32Array(mask.getAsFloat32Array()),
        height: mask.height,
        width: mask.width,
      };
    } finally {
      mask.close();
    }
  } finally {
    result.close();
  }
}

async function createSelectedObjectMask(
  source: HTMLCanvasElement,
  anchor: SegmentationAnchor,
): Promise<SegmentationMask> {
  const segmenter = await getInteractiveSegmenter();
  const result = segmenter.segment(source, {
    keypoint: {
      x: Math.max(0, Math.min(1, anchor.x)),
      y: Math.max(0, Math.min(1, anchor.y)),
    },
  });

  try {
    const confidenceMask = result.confidenceMasks?.[0];
    if (!confidenceMask) {
      throw new Error("Selected-object segmentation mask was not returned.");
    }
    const mask = confidenceMask.clone();

    try {
      const backgroundConfidence = mask.getAsFloat32Array();
      const selectedObjectConfidence = new Float32Array(backgroundConfidence.length);

      for (let index = 0; index < backgroundConfidence.length; index += 1) {
        selectedObjectConfidence[index] = 1 - backgroundConfidence[index];
      }

      return {
        data: retainAnchorComponent(
          selectedObjectConfidence,
          mask.width,
          mask.height,
          anchor,
          SELECTED_OBJECT_MASK_THRESHOLD,
        ),
        height: mask.height,
        width: mask.width,
      };
    } finally {
      mask.close();
    }
  } finally {
    result.close();
  }
}

export function retainAnchorComponent(
  data: Float32Array,
  width: number,
  height: number,
  anchor: SegmentationAnchor,
  threshold: number,
) {
  const anchorX = Math.round(Math.max(0, Math.min(1, anchor.x)) * (width - 1));
  const anchorY = Math.round(Math.max(0, Math.min(1, anchor.y)) * (height - 1));
  const seed = findNearestForegroundPixel(data, width, height, anchorX, anchorY, threshold);
  if (seed < 0) return data;

  const connected = new Uint8Array(data.length);
  const queue = new Int32Array(data.length);
  let read = 0;
  let write = 0;
  connected[seed] = 1;
  queue[write++] = seed;

  while (read < write) {
    const index = queue[read++];
    const x = index % width;
    const y = Math.floor(index / width);

    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        if (offsetX === 0 && offsetY === 0) continue;
        const nextX = x + offsetX;
        const nextY = y + offsetY;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
        const next = nextY * width + nextX;
        if (connected[next] || data[next] < threshold) continue;
        connected[next] = 1;
        queue[write++] = next;
      }
    }
  }

  const result = new Float32Array(data.length);
  for (let index = 0; index < result.length; index += 1) {
    result[index] = connected[index] ? data[index] : 0;
  }
  return result;
}

function findNearestForegroundPixel(
  data: Float32Array,
  width: number,
  height: number,
  anchorX: number,
  anchorY: number,
  threshold: number,
) {
  let nearest = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (data[index] < threshold) continue;
      const distance = (x - anchorX) ** 2 + (y - anchorY) ** 2;
      if (distance < nearestDistance) {
        nearest = index;
        nearestDistance = distance;
      }
    }
  }

  return nearest;
}

async function getSegmenter(): Promise<ImageSegmenter> {
  segmenterPromise ??= createSegmenter();
  return segmenterPromise;
}

async function getInteractiveSegmenter(): Promise<InteractiveSegmenter> {
  interactiveSegmenterPromise ??= createInteractiveSegmenter();
  return interactiveSegmenterPromise;
}

async function createInteractiveSegmenter(): Promise<InteractiveSegmenter> {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);

  return InteractiveSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: INTERACTIVE_MODEL_URL,
    },
    outputCategoryMask: false,
    outputConfidenceMasks: true,
  });
}

async function createSegmenter(): Promise<ImageSegmenter> {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);

  return ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
    },
    outputCategoryMask: false,
    outputConfidenceMasks: true,
    runningMode: "IMAGE",
  });
}

function selectPersonConfidenceMask(result: ImageSegmenterResult, labels: string[]) {
  const masks = result.confidenceMasks;

  if (!masks?.length) {
    return undefined;
  }

  const personLabelIndex = labels.findIndex((label) => PERSON_LABEL_PATTERN.test(label));

  if (personLabelIndex >= 0 && masks[personLabelIndex]) {
    return masks[personLabelIndex];
  }

  return masks.length > 1 ? masks[1] : masks[0];
}
