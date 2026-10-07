import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve, sep } from "node:path";
import { runtimes, runtimeFiles } from "./runtime-assets.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
// Validate every source before replacing generated files, so a broken install fails early.
const sources = runtimes.map(runtime => ({ runtime, files: runtimeFiles(root, runtime) }));
const publicRoot = resolve(root, "public");
for (const { runtime, files } of sources) {
  const destination = resolve(publicRoot, runtime.destination);
  if (!destination.startsWith(`${publicRoot}${sep}`)) throw new Error("Asset destination outside public");
  // Only these two fixed, ignored directories are generated; remove stale package versions.
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  for (const name of files) copyFileSync(join(root, runtime.source, name), join(destination, name));
  console.log(`Prepared ${files.length} runtime files: /${runtime.destination}/`);
}
