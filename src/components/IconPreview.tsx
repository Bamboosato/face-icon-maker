import { useEffect, useRef } from "react";
import { loadImage, renderIconToCanvas } from "../services/renderPipeline";
import { DEFAULT_BACKGROUND_OPTIONS, type BackgroundOptions } from "../types/background";
import type { CropArea, IconShape } from "../types/crop";
import { DEFAULT_EFFECT_OPTIONS, type EffectOptions } from "../types/effect";
import type { ProcessedImage } from "../types/image";

interface IconPreviewProps {
  backgroundOptions?: BackgroundOptions;
  crop: CropArea;
  effectOptions?: EffectOptions;
  image: ProcessedImage;
  shape: IconShape;
  onBackgroundProcessingChange?: (isProcessing: boolean) => void;
}

export function IconPreview({
  image,
  backgroundOptions = DEFAULT_BACKGROUND_OPTIONS,
  crop,
  effectOptions = DEFAULT_EFFECT_OPTIONS,
  shape,
  onBackgroundProcessingChange,
}: IconPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let reportedBackgroundProcessing = false;
    const shouldReportBackgroundProcessing = backgroundOptions.mode !== "original";

    function setBackgroundProcessing(isProcessing: boolean) {
      if (!shouldReportBackgroundProcessing || !onBackgroundProcessingChange) {
        return;
      }

      if (reportedBackgroundProcessing === isProcessing) {
        return;
      }

      reportedBackgroundProcessing = isProcessing;
      onBackgroundProcessingChange(isProcessing);
    }

    async function renderPreview() {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      try {
        setBackgroundProcessing(true);
        const source = await loadImage(image.url);
        const nextCanvas = document.createElement("canvas");
        nextCanvas.width = canvas.width;
        nextCanvas.height = canvas.height;

        await renderIconToCanvas(nextCanvas, source, crop, shape, effectOptions, backgroundOptions);

        if (cancelled) {
          return;
        }

        const context = canvas.getContext("2d");
        context?.clearRect(0, 0, canvas.width, canvas.height);
        context?.drawImage(nextCanvas, 0, 0);
      } finally {
        setBackgroundProcessing(false);
      }
    }

    void renderPreview();

    return () => {
      cancelled = true;
      setBackgroundProcessing(false);
    };
  }, [backgroundOptions, crop, effectOptions, image.url, onBackgroundProcessingChange, shape]);

  return (
    <div className={`preview-canvas ${shape === "circle" ? "circle-preview" : ""}`}>
      <canvas ref={canvasRef} width={192} height={192} aria-label="Icon preview" />
    </div>
  );
}
