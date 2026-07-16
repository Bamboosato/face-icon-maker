const DEFAULT_MODEL_URL =
  "https://huggingface.co/qualcomm/Real-ESRGAN-x4plus/resolve/v0.37.0/Real-ESRGAN-x4plus_float.tflite";

export const SUPER_RESOLUTION_CONFIG = Object.freeze({
  enabled: import.meta.env.VITE_SUPER_RESOLUTION_ENABLED !== "false",
  modelUrl:
    import.meta.env.VITE_SUPER_RESOLUTION_MODEL_URL?.trim() || DEFAULT_MODEL_URL,
  wasmBaseUrl: "/litert/wasm/",
  scale: 4,
  tileSize: 128,
  tileOverlapPercent: 20,
  suggestBelowCropPixels: 256,
  allowBelowCropPixels: 512,
});
