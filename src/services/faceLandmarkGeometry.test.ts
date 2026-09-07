import { describe, expect, it } from "vitest";
import type { FaceLandmarkSet, SourceLandmark } from "../types/animal";
import type { CropArea } from "../types/crop";
import { getFaceLandmarkAnchors } from "./faceLandmarkGeometry";

function createLandmarks(): SourceLandmark[] {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0, y: 0, z: 0 }));

  for (const index of [33, 133, 159, 145]) {
    landmarks[index] = { x: index === 33 ? 120 : index === 133 ? 140 : 130, y: index === 159 ? 95 : index === 145 ? 105 : 100, z: 0 };
  }

  for (const index of [263, 362, 386, 374]) {
    landmarks[index] = { x: index === 263 ? 220 : index === 362 ? 200 : 210, y: index === 386 ? 95 : index === 374 ? 105 : 100, z: 0 };
  }

  for (const index of [1, 2, 4, 5, 98, 327]) {
    landmarks[index] = { x: 170, y: 150, z: 0 };
  }

  for (const index of [13, 14, 61, 291]) {
    landmarks[index] = { x: 170, y: 185, z: 0 };
  }

  landmarks[10] = { x: 170, y: 40, z: 0 };
  landmarks[152] = { x: 170, y: 260, z: 0 };
  landmarks[234] = { x: 80, y: 150, z: 0 };
  landmarks[454] = { x: 260, y: 150, z: 0 };
  landmarks[50] = { x: 90, y: 150, z: 0 };
  landmarks[205] = { x: 95, y: 165, z: 0 };
  landmarks[280] = { x: 250, y: 150, z: 0 };
  landmarks[425] = { x: 245, y: 165, z: 0 };

  return landmarks;
}

function createLandmarkSet(landmarks: SourceLandmark[]): FaceLandmarkSet {
  return {
    landmarks,
    referenceCrop: { x: 0, y: 0, width: 320, height: 320 },
    sourceImageSize: { width: 320, height: 320 },
    modelVersion: "test",
  };
}

describe("getFaceLandmarkAnchors", () => {
  it("maps landmark groups into stable face anchors", () => {
    const anchors = getFaceLandmarkAnchors(
      createLandmarkSet(createLandmarks()),
      { x: 0, y: 0, width: 320, height: 320 },
      320,
    );

    expect(anchors).not.toBeNull();
    expect(anchors?.leftEyeCenter).toEqual({ x: 130, y: 100 });
    expect(anchors?.rightEyeCenter).toEqual({ x: 210, y: 100 });
    expect(anchors?.noseCenter).toEqual({ x: 170, y: 150 });
    expect(anchors?.faceWidth).toBe(180);
    expect(anchors?.faceHeight).toBe(220);
    expect(anchors?.rotation).toBe(0);
  });

  it("remaps anchors when the user changes the crop", () => {
    const crop: CropArea = { x: 80, y: 40, width: 180, height: 220 };
    const anchors = getFaceLandmarkAnchors(createLandmarkSet(createLandmarks()), crop, 512);

    expect(anchors).not.toBeNull();
    expect(anchors?.leftEyeCenter.x).toBeCloseTo((50 / 180) * 512);
    expect(anchors?.leftEyeCenter.y).toBeCloseTo((60 / 220) * 512);
    expect(anchors?.noseCenter.x).toBeCloseTo((90 / 180) * 512);
    expect(anchors?.noseCenter.y).toBeCloseTo((110 / 220) * 512);
  });

  it("returns null when required landmarks are invalid", () => {
    const landmarks = createLandmarks();
    landmarks[1] = { x: Number.NaN, y: 0, z: 0 };

    expect(
      getFaceLandmarkAnchors(
        createLandmarkSet(landmarks),
        { x: 0, y: 0, width: 320, height: 320 },
        320,
      ),
    ).toBeNull();
  });
});
