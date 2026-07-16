import { describe, expect, it } from "vitest";
import { createSegmentationAnchor } from "./cropService";

describe("createSegmentationAnchor", () => {
  it("maps the selected face center into crop coordinates", () => {
    const anchor = createSegmentationAnchor(
      { id: "face", x: 120, y: 80, width: 40, height: 60, score: 0.9 },
      { x: 100, y: 50, width: 100, height: 100 },
    );

    expect(anchor).toEqual({ x: 0.4, y: 0.6 });
  });

  it("clamps the prompt when the crop has moved past the detected face", () => {
    const anchor = createSegmentationAnchor(
      { id: "face", x: 0, y: 0, width: 20, height: 20, score: 0.9 },
      { x: 50, y: 50, width: 100, height: 100 },
    );

    expect(anchor).toEqual({ x: 0, y: 0 });
  });
});
