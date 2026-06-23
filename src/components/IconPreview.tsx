import { useEffect, useRef } from "react";
import { loadImage, renderIconToCanvas } from "../services/exportService";
import type { CropArea, IconShape } from "../types/crop";
import type { ProcessedImage } from "../types/image";

interface IconPreviewProps {
  crop: CropArea;
  image: ProcessedImage;
  shape: IconShape;
}

export function IconPreview({ image, crop, shape }: IconPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderPreview() {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const source = await loadImage(image.url);

      if (!cancelled) {
        renderIconToCanvas(canvas, source, crop, shape);
      }
    }

    void renderPreview();

    return () => {
      cancelled = true;
    };
  }, [crop, image.url, shape]);

  return (
    <div className={`preview-canvas ${shape === "circle" ? "circle-preview" : ""}`}>
      <canvas ref={canvasRef} width={192} height={192} aria-label="Icon preview" />
    </div>
  );
}
