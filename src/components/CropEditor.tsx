import { Check, Circle, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ReactCrop, { type Crop as ReactCropValue } from "react-image-crop";
import { clampCropToImage } from "../services/cropService";
import type { CropArea, IconShape } from "../types/crop";
import type { ProcessedImage } from "../types/image";
import { IconPreview } from "./IconPreview";
import { ScreenToolbar } from "./FaceSelector";

interface CropEditorProps {
  crop: CropArea;
  image: ProcessedImage;
  shape: IconShape;
  onBack: () => void;
  onComplete: () => void;
  onCropChange: (crop: CropArea) => void;
  onShapeChange: (shape: IconShape) => void;
}

export function CropEditor({
  crop,
  image,
  shape,
  onBack,
  onComplete,
  onCropChange,
  onShapeChange,
}: CropEditorProps) {
  const percentCrop = useMemo(() => toPercentCrop(crop, image), [crop, image]);
  const [uiCrop, setUiCrop] = useState<ReactCropValue>(percentCrop);

  useEffect(() => {
    setUiCrop(percentCrop);
  }, [percentCrop]);

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
          <IconPreview image={image} crop={crop} shape={shape} />

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
