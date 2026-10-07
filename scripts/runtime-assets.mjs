import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Keep both optimized and fallback runtimes at the URLs used by the app.
export const runtimes = [
  {
    source: "node_modules/@litertjs/core/wasm", destination: "litert/wasm",
    required: ["litert_wasm_internal", "litert_wasm_compat_internal",
      "litert_wasm_jspi_internal", "litert_wasm_threaded_internal"]
      .flatMap(name => [`${name}.js`, `${name}.wasm`]),
  },
  {
    source: "node_modules/@mediapipe/tasks-vision/wasm", destination: "mediapipe/wasm",
    required: ["vision_wasm_internal", "vision_wasm_module_internal", "vision_wasm_nosimd_internal"]
      .flatMap(name => [`${name}.js`, `${name}.wasm`]),
  },
];

export const publicAssets = [
  "models/blaze_face_short_range.tflite", "models/face_landmarker.task",
  ...["cat", "dog", "fox", "bear", "elephant", "lion", "rabbit", "panda",
    "raccoon", "tiger", "wolf", "hamster"].map(name => `animal/${name}.svg`),
];

export function assertNonemptyFile(path) {
  if (!statSync(path).isFile() || statSync(path).size === 0) {
    throw new Error(`Required asset is empty or is not a file: ${path}`);
  }
}

export function runtimeFiles(root, runtime) {
  for (const name of runtime.required) assertNonemptyFile(join(root, runtime.source, name));
  return readdirSync(join(root, runtime.source)).filter(name => /\.(js|wasm)$/.test(name));
}

export function assertIdenticalAsset(source, destination) {
  assertNonemptyFile(source);
  assertNonemptyFile(destination);
  if (!readFileSync(source).equals(readFileSync(destination))) {
    throw new Error(`Distributed asset differs from its source: ${destination}`);
  }
}

export function checkDistAssets(root) {
  let count = 0;
  for (const asset of publicAssets) {
    assertIdenticalAsset(join(root, "public", asset), join(root, "dist", asset));
    count++;
  }
  for (const runtime of runtimes) {
    for (const name of runtimeFiles(root, runtime)) {
      assertIdenticalAsset(join(root, runtime.source, name), join(root, "dist", runtime.destination, name));
      count++;
    }
  }
  return count;
}
