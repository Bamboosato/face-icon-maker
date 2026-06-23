import { ArrowLeft, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FaceBox } from "../types/face";
import type { ProcessedImage } from "../types/image";
import { ThresholdControl } from "./ThresholdControl";

const FACE_BOX_DISPLAY_SCALE = 1.18;

interface FaceSelectorProps {
  image: ProcessedImage;
  faces: FaceBox[];
  notice?: string;
  threshold: number;
  thresholdMax: number;
  thresholdMin: number;
  thresholdStep: number;
  thresholdDisabled?: boolean;
  onBack: () => void;
  onRedetect: () => void;
  onSelect: (face: FaceBox) => void;
  onThresholdChange: (value: number) => void;
}

export function FaceSelector({
  image,
  faces,
  notice,
  threshold,
  thresholdMax,
  thresholdMin,
  thresholdStep,
  thresholdDisabled = false,
  onBack,
  onRedetect,
  onSelect,
  onThresholdChange,
}: FaceSelectorProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = imageRef.current;

    if (!element) {
      return undefined;
    }

    const update = () => {
      setDisplaySize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, [image.url]);

  const scaleX = displaySize.width / image.width || 1;
  const scaleY = displaySize.height / image.height || 1;

  return (
    <section className="work-surface" aria-labelledby="face-select-title">
      <ScreenToolbar title="Select Face" onBack={onBack}>
        <button type="button" className="icon-button" onClick={onRedetect} aria-label="Redetect">
          <RotateCcw size={19} aria-hidden="true" />
        </button>
      </ScreenToolbar>

      <div className="counter-row">
        <ThresholdControl
          disabled={thresholdDisabled}
          value={threshold}
          min={thresholdMin}
          max={thresholdMax}
          step={thresholdStep}
          onChange={onThresholdChange}
        />
        <h2 id="face-select-title">
          <span>Faces Detected</span>
          <strong>{faces.length}</strong>
        </h2>
        {notice ? <span className="notice-pill">{notice}</span> : null}
      </div>

      <div className="image-stage">
        <div className="image-frame">
          <img ref={imageRef} src={image.url} alt="Selected photo" />
          {faces.map((face, index) => {
            const displayBox = createDisplayFaceBox(face, scaleX, scaleY, displaySize);

            return (
              <button
                key={face.id}
                type="button"
                className="face-box"
                style={{
                  left: displayBox.left,
                  top: displayBox.top,
                  width: displayBox.width,
                  height: displayBox.height,
                }}
                onClick={() => onSelect(face)}
                aria-label={`Select face ${index + 1}`}
              >
                <span>{index + 1}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function createDisplayFaceBox(
  face: FaceBox,
  scaleX: number,
  scaleY: number,
  displaySize: { width: number; height: number },
) {
  const width = face.width * scaleX * FACE_BOX_DISPLAY_SCALE;
  const height = face.height * scaleY * FACE_BOX_DISPLAY_SCALE;
  const centerX = (face.x + face.width / 2) * scaleX;
  const centerY = (face.y + face.height / 2) * scaleY;

  return {
    left: clamp(centerX - width / 2, 0, Math.max(0, displaySize.width - width)),
    top: clamp(centerY - height / 2, 0, Math.max(0, displaySize.height - height)),
    width,
    height,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

interface ScreenToolbarProps {
  children?: React.ReactNode;
  title: string;
  onBack: () => void;
}

export function ScreenToolbar({ children, title, onBack }: ScreenToolbarProps) {
  return (
    <div className="screen-toolbar">
      <button type="button" className="icon-button" onClick={onBack} aria-label="Back">
        <ArrowLeft size={20} aria-hidden="true" />
      </button>
      <strong>{title}</strong>
      <div className="toolbar-actions">{children}</div>
    </div>
  );
}
