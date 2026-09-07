import type { CropArea } from "./crop";

export type AnimalPresetId =
  | "none"
  | "cat"
  | "dog"
  | "fox"
  | "bear"
  | "elephant"
  | "lion"
  | "rabbit"
  | "panda"
  | "raccoon"
  | "tiger"
  | "wolf"
  | "hamster";

export interface SourceLandmark {
  x: number;
  y: number;
  z: number;
}

export interface FaceLandmarkSet {
  landmarks: SourceLandmark[];
  referenceCrop: CropArea;
  sourceImageSize: {
    width: number;
    height: number;
  };
  modelVersion: string;
}

export interface AnimalWarpOptions {
  eyeScale: number;
  noseScale: number;
  muzzleScale: number;
}

export interface AnimalPreset {
  id: Exclude<AnimalPresetId, "none">;
  label: string;
  overlayUrl: string;
  warp: AnimalWarpOptions;
}

export interface AnimalEffectOptions {
  preset: AnimalPresetId;
  landmarks: FaceLandmarkSet | null;
}

export const DEFAULT_ANIMAL_EFFECT_OPTIONS: AnimalEffectOptions = {
  preset: "none",
  landmarks: null,
};
