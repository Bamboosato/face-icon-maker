import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { checkDistAssets, publicAssets, runtimes } from "./runtime-assets.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "face-icon-assets-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const asset of publicAssets) {
    for (const directory of ["public", "dist"]) put(join(root, directory, asset), asset);
  }
  for (const runtime of runtimes) {
    for (const name of runtime.required) {
      put(join(root, runtime.source, name), name);
      put(join(root, "dist", runtime.destination, name), name);
    }
  }
  return root;
}
function put(path, value) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); }

test("accepts all models, presets, and both optimized/fallback runtime variants", t => {
  assert.equal(checkDistAssets(fixture(t)), 28);
});
test("rejects a missing face model instead of accepting a successful bundler result", t => {
  const root = fixture(t); rmSync(join(root, "dist", publicAssets[1]));
  assert.throws(() => checkDistAssets(root), /ENOENT/);
});
test("rejects an empty SVG at the zero-byte boundary", t => {
  const root = fixture(t); put(join(root, "dist", "animal/cat.svg"), "");
  assert.throws(() => checkDistAssets(root), /empty/);
});
test("rejects stale runtime bytes after a dependency update", t => {
  const root = fixture(t); put(join(root, "dist", "mediapipe/wasm/vision_wasm_internal.wasm"), "old");
  assert.throws(() => checkDistAssets(root), /differs/);
});
test("rejects a missing fallback in the installed package, even if dist retains it", t => {
  const root = fixture(t); rmSync(join(root, runtimes[0].source, "litert_wasm_compat_internal.wasm"));
  assert.throws(() => checkDistAssets(root), /ENOENT/);
});
