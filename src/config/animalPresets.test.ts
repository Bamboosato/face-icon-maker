import { describe, expect, it } from "vitest";
import { ANIMAL_PRESETS, getAnimalPreset } from "./animalPresets";

describe("animal presets", () => {
  it("provides the supported animal choices", () => {
    expect(ANIMAL_PRESETS.map((preset) => preset.id)).toEqual([
      "cat",
      "dog",
      "fox",
      "bear",
      "elephant",
      "lion",
      "rabbit",
      "panda",
      "raccoon",
      "tiger",
      "wolf",
      "hamster",
    ]);
  });

  it("keeps every overlay and warp setting available", () => {
    for (const preset of ANIMAL_PRESETS) {
      expect(preset.overlayUrl).toMatch(
        /^\/animal\/(cat|dog|fox|bear|elephant|lion|rabbit|panda|raccoon|tiger|wolf|hamster)\.svg$/,
      );
      expect(preset.warp.eyeScale).toBeGreaterThan(0);
      expect(preset.warp.noseScale).toBeGreaterThan(0);
      expect(preset.warp.muzzleScale).toBeGreaterThan(0);
    }
  });

  it("returns a preset by id and no preset for none", () => {
    expect(getAnimalPreset("cat")?.label).toBe("Cat");
    expect(getAnimalPreset("elephant")?.label).toBe("Elephant");
    expect(getAnimalPreset("hamster")?.label).toBe("Hamster");
    expect(getAnimalPreset("none")).toBeUndefined();
  });
});
