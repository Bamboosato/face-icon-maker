import { fileURLToPath } from "node:url";
import { checkDistAssets } from "./runtime-assets.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
console.log(`Verified ${checkDistAssets(root)} distributed assets (models, animal SVGs, JS/WASM).`);
