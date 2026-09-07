import { describe, expect, it } from "vitest";
import type { SourceLandmark } from "../types/animal";
import { selectClosestFaceLandmarks } from "./faceLandmarkSelection";

function createCandidate(centerX: number, centerY: number): SourceLandmark[] {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0, y: 0, z: 0 }));

  for (const index of [10, 152, 234, 454]) {
    landmarks[index] = { x: centerX, y: centerY, z: 0 };
  }

  return landmarks;
}

describe("selectClosestFaceLandmarks", () => {
  it("selects the candidate nearest to the selected face center", () => {
    const leftFace = createCandidate(0.28, 0.5);
    const rightFace = createCandidate(0.76, 0.5);

    expect(
      selectClosestFaceLandmarks([rightFace, leftFace], { x: 0.3, y: 0.5 }),
    ).toBe(leftFace);
  });

  it("skips candidates without usable face bounds", () => {
    const invalidFace = createCandidate(Number.NaN, 0.5);
    const validFace = createCandidate(0.7, 0.5);

    expect(
      selectClosestFaceLandmarks([invalidFace, validFace], { x: 0.7, y: 0.5 }),
    ).toBe(validFace);
  });

  it("returns undefined when no candidate has valid bounds", () => {
    const invalidFace = createCandidate(Number.NaN, 0.5);

    expect(
      selectClosestFaceLandmarks([invalidFace], { x: 0.5, y: 0.5 }),
    ).toBeUndefined();
  });
});
