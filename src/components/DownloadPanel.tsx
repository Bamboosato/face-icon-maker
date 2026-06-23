import { Download, RotateCcw, SlidersHorizontal, Upload } from "lucide-react";
import { useState } from "react";
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
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);

  async function handleDownload() {
    try {
      setSaving(true);
      await downloadIcon(image, crop, shape);
    } finally {
      setSaving(false);
    }
  }

  async function handleShare() {
    try {
      setSharing(true);
      await shareIcon(image, crop, shape);
    } finally {
      setSharing(false);
    }
  }

  return (
    <section className="download-surface" aria-labelledby="download-title">
      <div className="download-main">
        <div className="download-title-row">
          <h1 id="download-title">Done</h1>
          <button
            type="button"
            className="icon-button share-button"
            disabled={saving || sharing}
            onClick={handleShare}
            aria-label="Share PNG"
          >
            <Upload size={22} aria-hidden="true" />
          </button>
        </div>
        <IconPreview image={image} crop={crop} shape={shape} />
        <p className="file-name">{buildDownloadFileName(image.originalName)}</p>
      </div>

      <div className="action-stack">
        <button
          type="button"
          className="primary-action"
          disabled={saving || sharing}
          onClick={handleDownload}
        >
          <Download size={19} aria-hidden="true" />
          {saving ? "Saving" : "Save PNG"}
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
