import { ImagePlus, Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { ThresholdControl } from "./ThresholdControl";

interface UploadAreaProps {
  disabled?: boolean;
  threshold: number;
  thresholdMax: number;
  thresholdMin: number;
  thresholdStep: number;
  onFileSelected: (file: File) => void;
  onThresholdChange: (value: number) => void;
}

export function UploadArea({
  disabled = false,
  threshold,
  thresholdMax,
  thresholdMin,
  thresholdStep,
  onFileSelected,
  onThresholdChange,
}: UploadAreaProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  function openFilePicker() {
    if (!disabled) {
      inputRef.current?.click();
    }
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file) {
      onFileSelected(file);
    }
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragActive(false);

    const file = event.dataTransfer.files[0];

    if (file) {
      onFileSelected(file);
    }
  }

  return (
    <section className="upload-zone" aria-labelledby="upload-title">
      <div className="brand-line">
        <span className="brand-mark">
          <ImagePlus size={22} aria-hidden="true" />
        </span>
        <div>
          <h1 id="upload-title">Face Icon Maker</h1>
          <p>Create a profile icon from a group photo.</p>
        </div>
      </div>

      <ThresholdControl
        disabled={disabled}
        value={threshold}
        min={thresholdMin}
        max={thresholdMax}
        step={thresholdStep}
        onChange={onThresholdChange}
      />

      <button
        type="button"
        className={`drop-target ${dragActive ? "drop-target-active" : ""}`}
        disabled={disabled}
        onClick={openFilePicker}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragActive(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <Upload size={34} aria-hidden="true" />
        <span>Select Photo</span>
        <small>JPEG / PNG</small>
      </button>

      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleChange}
      />
    </section>
  );
}
