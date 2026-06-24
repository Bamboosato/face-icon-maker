export type BackgroundMode = "original" | "transparent" | "solid";

export interface BackgroundOptions {
  color: string;
  mode: BackgroundMode;
}

export const DEFAULT_BACKGROUND_OPTIONS: BackgroundOptions = {
  color: "#eaf6f0",
  mode: "original",
};

export const BACKGROUND_SWATCHES = ["#eaf6f0", "#f8d7da", "#dbeafe", "#fef3c7"] as const;
