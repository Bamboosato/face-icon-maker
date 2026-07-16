import type { CompiledModel } from "@litertjs/core";
import { SUPER_RESOLUTION_CONFIG } from "../config/superResolution";
import type { CropArea } from "../types/crop";

type LiteRtModule = typeof import("@litertjs/core");
type Accelerator = "webgpu" | "wasm";

export interface SuperResolutionProgress {
  completed: number;
  message: string;
  total: number;
}

export interface SuperResolutionResult {
  accelerator: Accelerator;
  canvas: HTMLCanvasElement;
}

let modulePromise: Promise<LiteRtModule> | undefined;
let modelPromise: Promise<{ accelerator: Accelerator; model: CompiledModel }> | undefined;

export function shouldOfferSuperResolution(crop: CropArea): boolean {
  return (
    SUPER_RESOLUTION_CONFIG.enabled &&
    Math.min(crop.width, crop.height) < SUPER_RESOLUTION_CONFIG.allowBelowCropPixels
  );
}

export function isSuperResolutionSuggested(crop: CropArea): boolean {
  return Math.min(crop.width, crop.height) < SUPER_RESOLUTION_CONFIG.suggestBelowCropPixels;
}

export async function upscaleFaceCrop(
  source: CanvasImageSource,
  crop: CropArea,
  onProgress?: (progress: SuperResolutionProgress) => void,
  signal?: AbortSignal,
): Promise<SuperResolutionResult> {
  throwIfAborted(signal);
  const sourceCanvas = createCropCanvas(source, crop);
  const runtime = await getCompiledModel();
  throwIfAborted(signal);

  const canvas = await upscaleCanvasWithTiling(
    sourceCanvas,
    runtime.model,
    runtime.accelerator,
    onProgress,
    signal,
  );

  return { accelerator: runtime.accelerator, canvas };
}

export function disposeSuperResolution(): void {
  void modelPromise?.then(({ model }) => {
    if (!model.deleted) {
      model.delete();
    }
  });
  modelPromise = undefined;
}

async function getCompiledModel() {
  if (!modelPromise) {
    modelPromise = compileModel().catch((error) => {
      modelPromise = undefined;
      throw error;
    });
  }

  return modelPromise;
}

async function compileModel() {
  const liteRt = await getLiteRtModule();
  const preferred: Accelerator = liteRt.isWebGPUSupported() ? "webgpu" : "wasm";

  try {
    const model = await liteRt.loadAndCompile(SUPER_RESOLUTION_CONFIG.modelUrl, {
      accelerator: preferred,
    });
    return { accelerator: preferred, model };
  } catch (error) {
    if (preferred === "wasm") {
      throw error;
    }

    const model = await liteRt.loadAndCompile(SUPER_RESOLUTION_CONFIG.modelUrl, {
      accelerator: "wasm",
    });
    return { accelerator: "wasm" as const, model };
  }
}

async function getLiteRtModule() {
  if (!modulePromise) {
    modulePromise = import("@litertjs/core")
      .then(async (liteRt) => {
        await liteRt.loadLiteRt(SUPER_RESOLUTION_CONFIG.wasmBaseUrl);
        return liteRt;
      })
      .catch((error) => {
        modulePromise = undefined;
        throw error;
      });
  }

  return modulePromise;
}

function createCropCanvas(source: CanvasImageSource, crop: CropArea) {
  const width = Math.max(1, Math.round(crop.width));
  const height = Math.max(1, Math.round(crop.height));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not prepare the face crop.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
  return canvas;
}

// Tiling and normalization follow Google's Apache-2.0 LiteRT.js Real-ESRGAN demo.
async function upscaleCanvasWithTiling(
  source: HTMLCanvasElement,
  model: CompiledModel,
  accelerator: Accelerator,
  onProgress?: (progress: SuperResolutionProgress) => void,
  signal?: AbortSignal,
) {
  const liteRt = await getLiteRtModule();
  const inputDetails = model.getInputDetails()[0];
  const outputDetails = model.getOutputDetails()[0];
  const [, inputHeight, inputWidth] = inputDetails.shape;
  const [, outputHeight, outputWidth] = outputDetails.shape;
  const scale = outputHeight / inputHeight;

  if (!inputWidth || !inputHeight || outputWidth / inputWidth !== scale) {
    throw new Error("The super-resolution model has an unsupported shape.");
  }

  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) {
    throw new Error("Could not read the face crop.");
  }

  const sourceData = sourceContext.getImageData(0, 0, source.width, source.height).data;
  const xPositions = createTilePositions(source.width, inputWidth);
  const yPositions = createTilePositions(source.height, inputHeight);
  const total = xPositions.length * yPositions.length;
  const output = document.createElement("canvas");
  output.width = Math.round(source.width * scale);
  output.height = Math.round(source.height * scale);
  const outputContext = output.getContext("2d");

  if (!outputContext) {
    throw new Error("Could not create the enhanced image.");
  }

  let completed = 0;
  for (let row = 0; row < yPositions.length; row += 1) {
    for (let column = 0; column < xPositions.length; column += 1) {
      throwIfAborted(signal);
      const startX = xPositions[column];
      const startY = yPositions[row];
      const tileData = createTileData(
        sourceData,
        source.width,
        source.height,
        startX,
        startY,
        inputWidth,
        inputHeight,
      );

      const cpuInput = new liteRt.Tensor(tileData, inputDetails.shape);
      let modelInput = cpuInput;
      let outputTensor: import("@litertjs/core").Tensor | undefined;
      let cpuOutput: import("@litertjs/core").Tensor | undefined;

      try {
        if (accelerator === "webgpu") {
          modelInput = await cpuInput.moveTo("webgpu");
        }
        const results = await model.run([modelInput]);
        outputTensor = results[0];
        cpuOutput = outputTensor.accelerator === "wasm" ? outputTensor : await outputTensor.moveTo("wasm");
        const tileCanvas = createOutputTile(
          cpuOutput.toTypedArray() as Float32Array,
          outputWidth,
          outputHeight,
        );
        stitchTile(
          outputContext,
          tileCanvas,
          xPositions,
          yPositions,
          column,
          row,
          inputWidth,
          inputHeight,
          scale,
        );
      } finally {
        if (cpuOutput && cpuOutput !== outputTensor && !cpuOutput.deleted) cpuOutput.delete();
        if (outputTensor && !outputTensor.deleted) outputTensor.delete();
        if (modelInput !== cpuInput && !modelInput.deleted) modelInput.delete();
        if (!cpuInput.deleted) cpuInput.delete();
      }

      completed += 1;
      onProgress?.({ completed, total, message: `Enhancing face (${completed}/${total})` });
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }
  }

  return output;
}

export function createTilePositions(length: number, tileSize: number) {
  if (length <= tileSize) return [0];
  const overlap = Math.floor(tileSize * (SUPER_RESOLUTION_CONFIG.tileOverlapPercent / 100));
  const step = tileSize - overlap;
  const positions: number[] = [];

  for (let position = 0; position + tileSize < length; position += step) {
    positions.push(position);
  }

  const finalPosition = length - tileSize;
  if (positions.at(-1) !== finalPosition) positions.push(finalPosition);
  return positions;
}

function createTileData(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  startX: number,
  startY: number,
  tileWidth: number,
  tileHeight: number,
) {
  const data = new Float32Array(tileWidth * tileHeight * 3);

  for (let y = 0; y < tileHeight; y += 1) {
    const sourceY = Math.min(sourceHeight - 1, startY + y);
    for (let x = 0; x < tileWidth; x += 1) {
      const sourceX = Math.min(sourceWidth - 1, startX + x);
      const sourceIndex = (sourceY * sourceWidth + sourceX) * 4;
      const targetIndex = (y * tileWidth + x) * 3;
      data[targetIndex] = source[sourceIndex] / 255;
      data[targetIndex + 1] = source[sourceIndex + 1] / 255;
      data[targetIndex + 2] = source[sourceIndex + 2] / 255;
    }
  }

  return data;
}

function createOutputTile(data: Float32Array, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not render an enhanced tile.");
  const imageData = context.createImageData(width, height);

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const sourceIndex = pixel * 3;
    const targetIndex = pixel * 4;
    imageData.data[targetIndex] = clampByte(data[sourceIndex] * 255);
    imageData.data[targetIndex + 1] = clampByte(data[sourceIndex + 1] * 255);
    imageData.data[targetIndex + 2] = clampByte(data[sourceIndex + 2] * 255);
    imageData.data[targetIndex + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

function stitchTile(
  context: CanvasRenderingContext2D,
  tile: HTMLCanvasElement,
  xPositions: number[],
  yPositions: number[],
  column: number,
  row: number,
  tileWidth: number,
  tileHeight: number,
  scale: number,
) {
  const x = xPositions[column];
  const y = yPositions[row];
  const visibleLeft = column === 0 ? x : Math.round((xPositions[column - 1] + tileWidth + x) / 2);
  const visibleTop = row === 0 ? y : Math.round((yPositions[row - 1] + tileHeight + y) / 2);
  const visibleRight =
    column === xPositions.length - 1
      ? x + tileWidth
      : Math.round((x + tileWidth + xPositions[column + 1]) / 2);
  const visibleBottom =
    row === yPositions.length - 1
      ? y + tileHeight
      : Math.round((y + tileHeight + yPositions[row + 1]) / 2);
  const sourceX = Math.round((visibleLeft - x) * scale);
  const sourceY = Math.round((visibleTop - y) * scale);
  const width = Math.round((visibleRight - visibleLeft) * scale);
  const height = Math.round((visibleBottom - visibleTop) * scale);

  context.drawImage(
    tile,
    sourceX,
    sourceY,
    width,
    height,
    Math.round(visibleLeft * scale),
    Math.round(visibleTop * scale),
    width,
    height,
  );
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Enhancement cancelled.", "AbortError");
  }
}
