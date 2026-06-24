import {
  FilesetResolver,
  ImageSegmenter,
  type ImageSegmenterResult,
} from "@mediapipe/tasks-vision";

const TASKS_VERSION = "0.10.35";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
const PERSON_LABEL_PATTERN = /person|human|foreground/i;

let segmenterPromise: Promise<ImageSegmenter> | undefined;

export interface SegmentationMask {
  data: Float32Array;
  height: number;
  width: number;
}

export async function createPersonMask(source: HTMLCanvasElement): Promise<SegmentationMask> {
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

async function getSegmenter(): Promise<ImageSegmenter> {
  segmenterPromise ??= createSegmenter();
  return segmenterPromise;
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
