import { Download, RotateCcw, SlidersHorizontal, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { useIsSmartphone } from "../hooks/useIsSmartphone";
import { downloadIcon, shareIcon } from "../services/exportService";
import {
  isSuperResolutionSuggested,
  shouldOfferSuperResolution,
} from "../services/superResolutionService";
import type { BackgroundOptions } from "../types/background";
import type { CropArea, IconShape } from "../types/crop";
import type { EffectOptions } from "../types/effect";
import type { ProcessedImage } from "../types/image";
import type { FaceBox } from "../types/face";
import { createSegmentationAnchor } from "../services/cropService";
import { buildDownloadFileName } from "../utils/fileName";
import { IconPreview } from "./IconPreview";
import type { AnimalEffectOptions } from "../types/animal";

interface DownloadPanelProps {
  backgroundOptions: BackgroundOptions;
  crop: CropArea;
  effectOptions: EffectOptions;
  image: ProcessedImage;
  shape: IconShape;
  selectedFace: FaceBox;
  onBackgroundProcessingChange: (isProcessing: boolean) => void;
  onEdit: () => void;
  onReset: () => void;
  animalEffect: AnimalEffectOptions;
}

export function DownloadPanel({
  image,
  backgroundOptions,
  crop,
  effectOptions,
  shape,
  selectedFace,
  onBackgroundProcessingChange,
  onEdit,
  onReset,
  animalEffect,
}: DownloadPanelProps) {
  const isSmartphone = useIsSmartphone();
  const [processing, setProcessing] = useState(false);
  const [enhanceFace, setEnhanceFace] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const offerEnhancement = shouldOfferSuperResolution(crop);
  const enhancementSuggested = isSuperResolutionSuggested(crop);
  const subjectAnchor = createSegmentationAnchor(selectedFace, crop);
  const enhancementInProgress = processing && enhanceFace;
  const primaryLabel = enhancementInProgress
    ? "Cancel enhancement"
    : processing
    ? isSmartphone
      ? "Sharing"
      : "Saving"
    : isSmartphone
      ? "Share PNG"
      : "Save PNG";

  async function handlePrimaryAction() {
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setProcessing(true);
      setStatusMessage(enhanceFace ? "Preparing face enhancement" : "");
      if (backgroundOptions.mode !== "original") {
        onBackgroundProcessingChange(true);
      }

      const options = {
        enhanceFace: offerEnhancement && enhanceFace,
        signal: abortController.signal,
        onEnhancementProgress: ({ message }: { message: string }) => setStatusMessage(message),
        subjectAnchor,
        animalEffect,
      };
      const result = isSmartphone
        ? await shareIcon(image, crop, shape, effectOptions, backgroundOptions, options)
        : await downloadIcon(image, crop, shape, effectOptions, backgroundOptions, options);

      setStatusMessage(
        result.warning ?? (result.enhanced ? "Enhanced PNG ready" : ""),
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatusMessage("Face enhancement cancelled");
        return;
      }

      setStatusMessage("Could not save the PNG. Please try again.");
    } finally {
      abortControllerRef.current = null;
      if (backgroundOptions.mode !== "original") {
        onBackgroundProcessingChange(false);
      }

      setProcessing(false);
    }
  }

  return (
    <section className="download-surface" aria-labelledby="download-title">
      <div className="download-main">
        <h1 id="download-title">Done</h1>
        <IconPreview
          image={image}
          backgroundOptions={backgroundOptions}
          crop={crop}
          effectOptions={effectOptions}
          shape={shape}
          subjectAnchor={subjectAnchor}
          animalEffect={animalEffect}
          onBackgroundProcessingChange={onBackgroundProcessingChange}
        />
        <p className="file-name">{buildDownloadFileName(image.originalName)}</p>
      </div>

      <div className="action-stack">
        {offerEnhancement ? (
          <label className="enhancement-option">
            <input
              type="checkbox"
              checked={enhanceFace}
              disabled={processing}
              onChange={(event) => {
                setEnhanceFace(event.target.checked);
                setStatusMessage("");
              }}
            />
            <span className="enhancement-option-copy">
              <span className="enhancement-option-title">
                <Sparkles size={18} aria-hidden="true" />
                Enhance low-resolution face
              </span>
              <small role="status" aria-live="polite">
                {enhanceFace && statusMessage
                  ? statusMessage
                  : enhancementSuggested
                    ? "Recommended for this crop. Processing stays on this device."
                    : "Optional. Processing stays on this device."}
              </small>
            </span>
          </label>
        ) : null}

        <button
          type="button"
          className={enhancementInProgress ? "secondary-action" : "primary-action"}
          disabled={processing && !enhancementInProgress}
          onClick={
            enhancementInProgress
              ? () => abortControllerRef.current?.abort()
              : handlePrimaryAction
          }
        >
          {!isSmartphone && !enhancementInProgress ? (
            <Download size={19} aria-hidden="true" />
          ) : null}
          {primaryLabel}
        </button>
        <button type="button" className="secondary-action" disabled={processing} onClick={onEdit}>
          <SlidersHorizontal size={18} aria-hidden="true" />
          Edit
        </button>
        <button type="button" className="secondary-action" disabled={processing} onClick={onReset}>
          <RotateCcw size={18} aria-hidden="true" />
          Start Over
        </button>
      </div>
    </section>
  );
}
