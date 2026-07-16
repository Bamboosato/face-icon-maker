import { describe, expect, it } from "vitest";
import type { CropArea } from "../types/crop";
import {
  createTilePositions,
  isSuperResolutionSuggested,
  shouldOfferSuperResolution,
} from "./superResolutionService";

function crop(size: number): CropArea {
  return { x: 0, y: 0, width: size, height: size };
}

describe("super-resolution eligibility", () => {
  it("suggests enhancement below 256 pixels", () => {
    expect(isSuperResolutionSuggested(crop(255))).toBe(true);
    expect(isSuperResolutionSuggested(crop(256))).toBe(false);
  });

  it("offers enhancement below 512 pixels", () => {
    expect(shouldOfferSuperResolution(crop(511))).toBe(true);
    expect(shouldOfferSuperResolution(crop(512))).toBe(false);
  });
});

describe("super-resolution tile positions", () => {
  it("uses one padded tile for inputs no larger than the model tile", () => {
    expect(createTilePositions(1, 128)).toEqual([0]);
    expect(createTilePositions(128, 128)).toEqual([0]);
  });

  it("covers the final pixel without duplicate tiles", () => {
    const positions = createTilePositions(300, 128);

    expect(positions).toEqual([0, 103, 172]);
    expect(positions.at(-1)! + 128).toBe(300);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it("handles the first size above one tile", () => {
    expect(createTilePositions(129, 128)).toEqual([0, 1]);
  });
});
