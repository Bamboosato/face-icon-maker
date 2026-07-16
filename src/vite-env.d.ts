/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPER_RESOLUTION_ENABLED?: string;
  readonly VITE_SUPER_RESOLUTION_MODEL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
