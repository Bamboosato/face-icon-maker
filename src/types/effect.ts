export type IconEffect = "none" | "pixel-art" | "comic" | "paint";

export type PixelArtSize = 32 | 48 | 64;

export const PAINT_STRENGTH_MIN = 0;
export const PAINT_STRENGTH_MAX = 100;
export const PAINT_STRENGTH_STEP = 5;

export interface EffectOptions {
  effect: IconEffect;
  paintStrength: number;
  pixelSize: PixelArtSize;
}

export const DEFAULT_EFFECT_OPTIONS: EffectOptions = {
  effect: "none",
  paintStrength: 50,
  pixelSize: 48,
};
