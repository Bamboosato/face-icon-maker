export type IconEffect = "none" | "pixel-art";

export type PixelArtSize = 32 | 48 | 64;

export interface EffectOptions {
  effect: IconEffect;
  pixelSize: PixelArtSize;
}

export const DEFAULT_EFFECT_OPTIONS: EffectOptions = {
  effect: "none",
  pixelSize: 48,
};
