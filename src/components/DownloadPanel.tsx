import { Download, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useIsSmartphone } from "../hooks/useIsSmartphone";
import { downloadIcon, shareIcon } from "../services/exportService";
import type { CropArea, IconShape } from "../types/crop";
import type { ProcessedImage } from "../types/image";
import { buildDownloadFileName } from "../utils/fileName";
import { IconPreview } from "./IconPreview";

interface DownloadPanelProps {
  crop: CropArea;
  image: ProcessedImage;
  shape: IconShape;
  onEdit: () => void;
  onReset: () => void;
}

export function DownloadPanel({ image, crop, shape, onEdit, onReset }: DownloadPanelProps) {
  const isSmartphone = useIsSmartphone();
  const [processing, setProcessing] = useState(false);
  const primaryLabel = processing
    ? isSmartphone
      ? "Sharing"
      : "Saving"
    : isSmartphone
      ? "Share PNG"
      : "Save PNG";

  async function handlePrimaryAction() {
    try {
      setProcessing(true);
      if (isSmartphone) {
        await shareIcon(image, crop, shape);
        return;
      }

      await downloadIcon(image, crop, shape);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <section className="download-surface" aria-labelledby="download-title">
      <div className="download-main">
        <h1 id="download-title">Done</h1>
        <IconPreview image={image} crop={crop} shape={shape} />
        <p className="file-name">{buildDownloadFileName(image.originalName)}</p>
      </div>

      <div className="action-stack">
        <button
          type="button"
          className="primary-action"
          disabled={processing}
          onClick={handlePrimaryAction}
        >
          {!isSmartphone && <Download size={19} aria-hidden="true" />}
          {primaryLabel}
        </button>
        <button type="button" className="secondary-action" onClick={onEdit}>
          <SlidersHorizontal size={18} aria-hidden="true" />
          Edit
        </button>
        <button type="button" className="secondary-action" onClick={onReset}>
          <RotateCcw size={18} aria-hidden="true" />
          Start Over
        </button>
      </div>
    </section>
  );
}
