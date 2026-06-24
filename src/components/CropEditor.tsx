import { Brush, Check, Circle, Grid2x2, Palette, Sparkles, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ReactCrop, { type Crop as ReactCropValue } from "react-image-crop";
import { clampCropToImage } from "../services/cropService";
import {
  BACKGROUND_SWATCHES,
  type BackgroundMode,
  type BackgroundOptions,
} from "../types/background";
import type { CropArea, IconShape } from "../types/crop";
import {
  PAINT_STRENGTH_MAX,
  PAINT_STRENGTH_MIN,
  PAINT_STRENGTH_STEP,
  type EffectOptions,
  type IconEffect,
  type PixelArtSize,
} from "../types/effect";
import type { ProcessedImage } from "../types/image";
import { IconPreview } from "./IconPreview";
import { ScreenToolbar } from "./FaceSelector";

const PIXEL_SIZE_OPTIONS: { label: string; value: PixelArtSize }[] = [
  { label: "Small", value: 64 },
  { label: "Medium", value: 48 },
  { label: "Large", value: 32 },
];

interface CropEditorProps {
  backgroundOptions: BackgroundOptions;
  crop: CropArea;
  effectOptions: EffectOptions;
  image: ProcessedImage;
  shape: IconShape;
  onBack: () => void;
  onBackgroundOptionsChange: (options: BackgroundOptions) => void;
  onBackgroundProcessingChange: (isProcessing: boolean) => void;
  onComplete: () => void;
  onCropChange: (crop: CropArea) => void;
  onEffectOptionsChange: (options: EffectOptions) => void;
  onShapeChange: (shape: IconShape) => void;
}

export function CropEditor({
  backgroundOptions,
  crop,
  effectOptions,
  image,
  shape,
  onBack,
  onBackgroundOptionsChange,
  onBackgroundProcessingChange,
  onComplete,
  onCropChange,
  onEffectOptionsChange,
  onShapeChange,
}: CropEditorProps) {
  const percentCrop = useMemo(() => toPercentCrop(crop, image), [crop, image]);
  const [uiCrop, setUiCrop] = useState<ReactCropValue>(percentCrop);

  useEffect(() => {
    setUiCrop(percentCrop);
  }, [percentCrop]);

  function handleEffectChange(effect: IconEffect) {
    onEffectOptionsChange({ ...effectOptions, effect });
  }

  function handlePixelSizeChange(pixelSize: PixelArtSize) {
    onEffectOptionsChange({ ...effectOptions, pixelSize });
  }

  function handlePaintStrengthChange(paintStrength: number) {
    onEffectOptionsChange({ ...effectOptions, paintStrength });
  }

  function handleBackgroundModeChange(mode: BackgroundMode) {
    onBackgroundOptionsChange({ ...backgroundOptions, mode });
  }

  function handleBackgroundColorChange(color: string) {
    onBackgroundOptionsChange({ ...backgroundOptions, color, mode: "solid" });
  }

  return (
    <section className="work-surface" aria-labelledby="crop-title">
      <ScreenToolbar title="Edit Icon" onBack={onBack} />

      <div className="editor-grid">
        <div className="crop-panel">
          <h2 id="crop-title">Crop</h2>
          <ReactCrop
            crop={uiCrop}
            aspect={1}
            keepSelection
            circularCrop={shape === "circle"}
            minWidth={48}
            minHeight={48}
            onChange={(_, nextPercentCrop) => {
              setUiCrop(nextPercentCrop);
              onCropChange(clampCropToImage(fromPercentCrop(nextPercentCrop, image), image));
            }}
          >
            <img src={image.url} alt="Crop source" />
          </ReactCrop>
        </div>

        <aside className="preview-panel">
          <h2>Preview</h2>
          <IconPreview
            image={image}
            backgroundOptions={backgroundOptions}
            crop={crop}
            effectOptions={effectOptions}
            shape={shape}
            onBackgroundProcessingChange={onBackgroundProcessingChange}
          />

          <div className="control-group">
            <h3>Shape</h3>
            <div className="segmented-control" role="group" aria-label="Icon shape">
              <button
                type="button"
                className={shape === "square" ? "selected" : ""}
                onClick={() => onShapeChange("square")}
                aria-pressed={shape === "square"}
              >
                <Square size={18} aria-hidden="true" />
                <span>Square</span>
              </button>
              <button
                type="button"
                className={shape === "circle" ? "selected" : ""}
                onClick={() => onShapeChange("circle")}
                aria-pressed={shape === "circle"}
              >
                <Circle size={18} aria-hidden="true" />
                <span>Circle</span>
              </button>
            </div>
          </div>

          <div className="control-group">
            <h3>Style</h3>
            <div
              className="segmented-control style-segmented-control"
              role="group"
              aria-label="Icon style"
            >
              <button
                type="button"
                className={effectOptions.effect === "none" ? "selected" : ""}
                onClick={() => handleEffectChange("none")}
                aria-pressed={effectOptions.effect === "none"}
              >
                <Palette size={18} aria-hidden="true" />
                <span>Natural</span>
              </button>
              <button
                type="button"
                className={effectOptions.effect === "pixel-art" ? "selected" : ""}
                onClick={() => handleEffectChange("pixel-art")}
                aria-pressed={effectOptions.effect === "pixel-art"}
              >
                <Grid2x2 size={18} aria-hidden="true" />
                <span>Pixel</span>
              </button>
              <button
                type="button"
                className={effectOptions.effect === "comic" ? "selected" : ""}
                onClick={() => handleEffectChange("comic")}
                aria-pressed={effectOptions.effect === "comic"}
              >
                <Sparkles size={18} aria-hidden="true" />
                <span>Comic</span>
              </button>
              <button
                type="button"
                className={effectOptions.effect === "paint" ? "selected" : ""}
                onClick={() => handleEffectChange("paint")}
                aria-pressed={effectOptions.effect === "paint"}
              >
                <Brush size={18} aria-hidden="true" />
                <span>Paint</span>
              </button>
            </div>
            <div className="effect-detail-slot">
              <div
                className={`pixel-size-slot ${
                  effectOptions.effect === "pixel-art" ? "visible" : ""
                }`}
                role="group"
                aria-label="Pixel size"
                aria-hidden={effectOptions.effect !== "pixel-art"}
              >
                {PIXEL_SIZE_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={effectOptions.pixelSize === option.value ? "selected" : ""}
                    disabled={effectOptions.effect !== "pixel-art"}
                    onClick={() => handlePixelSizeChange(option.value)}
                    aria-pressed={effectOptions.pixelSize === option.value}
                    tabIndex={effectOptions.effect === "pixel-art" ? 0 : -1}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <label
                className={`paint-strength-slot ${
                  effectOptions.effect === "paint" ? "visible" : ""
                }`}
                aria-hidden={effectOptions.effect !== "paint"}
              >
                <span>Strength</span>
                <input
                  type="range"
                  min={PAINT_STRENGTH_MIN}
                  max={PAINT_STRENGTH_MAX}
                  step={PAINT_STRENGTH_STEP}
                  value={effectOptions.paintStrength}
                  disabled={effectOptions.effect !== "paint"}
                  tabIndex={effectOptions.effect === "paint" ? 0 : -1}
                  onChange={(event) =>
                    handlePaintStrengthChange(event.currentTarget.valueAsNumber)
                  }
                />
                <output>{effectOptions.paintStrength}</output>
              </label>
            </div>
          </div>

          <div className="control-group">
            <h3>Background</h3>
            <div className="compact-segmented-control" role="group" aria-label="Icon background">
              <button
                type="button"
                className={backgroundOptions.mode === "original" ? "selected" : ""}
                onClick={() => handleBackgroundModeChange("original")}
                aria-pressed={backgroundOptions.mode === "original"}
              >
                Original
              </button>
              <button
                type="button"
                className={backgroundOptions.mode === "transparent" ? "selected" : ""}
                onClick={() => handleBackgroundModeChange("transparent")}
                aria-pressed={backgroundOptions.mode === "transparent"}
              >
                Clear
              </button>
              <button
                type="button"
                className={backgroundOptions.mode === "solid" ? "selected" : ""}
                onClick={() => handleBackgroundModeChange("solid")}
                aria-pressed={backgroundOptions.mode === "solid"}
              >
                Color
              </button>
            </div>
            <div
              className={`background-swatch-row ${backgroundOptions.mode === "solid" ? "visible" : ""}`}
              aria-hidden={backgroundOptions.mode !== "solid"}
            >
              {BACKGROUND_SWATCHES.map((color) => (
                <button
                  type="button"
                  key={color}
                  className={backgroundOptions.color === color ? "selected" : ""}
                  disabled={backgroundOptions.mode !== "solid"}
                  onClick={() => handleBackgroundColorChange(color)}
                  tabIndex={backgroundOptions.mode === "solid" ? 0 : -1}
                  style={{ backgroundColor: color }}
                  aria-label={`Background ${color}`}
                  aria-pressed={backgroundOptions.color === color}
                />
              ))}
            </div>
          </div>

          <div className="completion-actions">
            <button type="button" className="primary-action" onClick={onComplete}>
              <Check size={19} aria-hidden="true" />
              Done
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function toPercentCrop(crop: CropArea, image: ProcessedImage): ReactCropValue {
  return {
    unit: "%",
    x: (crop.x / image.width) * 100,
    y: (crop.y / image.height) * 100,
    width: (crop.width / image.width) * 100,
    height: (crop.height / image.height) * 100,
  };
}

function fromPercentCrop(crop: ReactCropValue, image: ProcessedImage): CropArea {
  return {
    x: (crop.x / 100) * image.width,
    y: (crop.y / 100) * image.height,
    width: (crop.width / 100) * image.width,
    height: (crop.height / 100) * image.height,
  };
}
