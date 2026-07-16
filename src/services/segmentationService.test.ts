import { describe, expect, it } from "vitest";
import { retainAnchorComponent } from "./segmentationService";

describe("retainAnchorComponent", () => {
  it("removes false-positive islands disconnected from the selected object", () => {
    const data = new Float32Array(36);
    data[2 * 6 + 3] = 1;
    data[2 * 6 + 4] = 0.8;
    data[3 * 6 + 3] = 0.9;
    data[5 * 6] = 1;

    const result = retainAnchorComponent(data, 6, 6, { x: 0.6, y: 0.4 }, 0.45);

    expect(result[2 * 6 + 3]).toBe(1);
    expect(result[2 * 6 + 4]).toBeCloseTo(0.8);
    expect(result[5 * 6]).toBe(0);
  });

  it("returns the original mask when no foreground reaches the threshold", () => {
    const data = new Float32Array([0.1, 0.2, 0.3, 0.4]);

    expect(retainAnchorComponent(data, 2, 2, { x: 0.5, y: 0.5 }, 0.45)).toBe(data);
  });
});
