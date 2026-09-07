import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/@litertjs/core/wasm/*",
          dest: "litert/wasm",
          rename: { stripBase: true },
        },
        {
          src: "node_modules/@mediapipe/tasks-vision/wasm/*",
          dest: "mediapipe/wasm",
          rename: { stripBase: true },
        },
      ],
    }),
  ],
});
