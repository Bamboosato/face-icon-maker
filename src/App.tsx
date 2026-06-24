import { AlertTriangle, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CropEditor } from "./components/CropEditor";
import { DownloadPanel } from "./components/DownloadPanel";
import { FaceSelector } from "./components/FaceSelector";
import { UploadArea } from "./components/UploadArea";
import { createAutoCrop } from "./services/cropService";
import { detectFaces } from "./services/faceDetection";
import { processImageFile } from "./services/imageService";
import {
  DEFAULT_BACKGROUND_OPTIONS,
  type BackgroundOptions,
} from "./types/background";
import type { CropArea, IconShape } from "./types/crop";
import { DEFAULT_EFFECT_OPTIONS, type EffectOptions } from "./types/effect";
import type { FaceBox } from "./types/face";
import { ImageProcessingError, type ProcessedImage } from "./types/image";

type Screen = "upload" | "select" | "edit" | "download";
const DEFAULT_DETECTION_THRESHOLD = 0.5;
const DETECTION_THRESHOLD_MIN = 0.1;
const DETECTION_THRESHOLD_MAX = 0.95;
const DETECTION_THRESHOLD_STEP = 0.05;
const ERROR_TOAST_TIMEOUT_MS = 5000;

function App() {
  const [screen, setScreen] = useState<Screen>("upload");
  const [image, setImage] = useState<ProcessedImage | null>(null);
  const [faces, setFaces] = useState<FaceBox[]>([]);
  const [selectedFace, setSelectedFace] = useState<FaceBox | null>(null);
  const [crop, setCrop] = useState<CropArea | null>(null);
  const [shape, setShape] = useState<IconShape>("square");
  const [effectOptions, setEffectOptions] = useState<EffectOptions>(DEFAULT_EFFECT_OPTIONS);
  const [backgroundOptions, setBackgroundOptions] =
    useState<BackgroundOptions>(DEFAULT_BACKGROUND_OPTIONS);
  const [detectionThreshold, setDetectionThreshold] = useState(DEFAULT_DETECTION_THRESHOLD);
  const [busyMessage, setBusyMessage] = useState("");
  const [backgroundProcessingCount, setBackgroundProcessingCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const visibleBusyMessage =
    busyMessage || (backgroundProcessingCount > 0 ? "Processing background" : "");

  useEffect(() => {
    return () => {
      if (image?.url) {
        URL.revokeObjectURL(image.url);
      }
    };
  }, [image?.url]);

  useEffect(() => {
    if (!errorMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setErrorMessage("");
    }, ERROR_TOAST_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [errorMessage]);

  const notice = useMemo(() => {
    if (faces.length >= 10) {
      return "Many faces found. Select one.";
    }

    return "";
  }, [faces.length]);

  async function handleFileSelected(file: File) {
    setErrorMessage("");
    setBusyMessage("Preparing image");

    try {
      const processedImage = await processImageFile(file);

      if (image?.url) {
        URL.revokeObjectURL(image.url);
      }

      setImage(processedImage);
      setFaces([]);
      setSelectedFace(null);
      setCrop(null);
      setShape("square");
      setEffectOptions(DEFAULT_EFFECT_OPTIONS);
      setBackgroundOptions(DEFAULT_BACKGROUND_OPTIONS);
      setBackgroundProcessingCount(0);

      await runFaceDetection(processedImage, detectionThreshold);
    } catch (error) {
      setScreen("upload");
      setErrorMessage(toUserMessage(error));
    } finally {
      setBusyMessage("");
    }
  }

  async function runFaceDetection(
    targetImage = image,
    threshold = detectionThreshold,
    stayOnSelectWhenEmpty = false,
  ) {
    if (!targetImage) {
      return;
    }

    setBusyMessage("Detecting faces");
    setErrorMessage("");

    try {
      const detectedFaces = await detectFaces(targetImage, threshold);

      if (detectedFaces.length === 0) {
        setFaces([]);
        setSelectedFace(null);
        setCrop(null);
        setErrorMessage("No faces found. Try another image.");

        if (!stayOnSelectWhenEmpty) {
          setScreen("upload");
        }

        return;
      }

      setFaces(detectedFaces);
      setScreen("select");
    } catch {
      setScreen("upload");
      setErrorMessage("Face detection failed. Try another image.");
    } finally {
      setBusyMessage("");
    }
  }

  function handleThresholdChange(value: number) {
    setDetectionThreshold(value);

    if (image && screen === "select") {
      void runFaceDetection(image, value, true);
    }
  }

  function handleFaceSelect(face: FaceBox) {
    if (!image) {
      return;
    }

    setSelectedFace(face);
    setCrop(createAutoCrop(face, image));
    setScreen("edit");
  }

  function handleReset() {
    if (image?.url) {
      URL.revokeObjectURL(image.url);
    }

    setImage(null);
    setFaces([]);
    setSelectedFace(null);
    setCrop(null);
    setShape("square");
    setEffectOptions(DEFAULT_EFFECT_OPTIONS);
    setBackgroundOptions(DEFAULT_BACKGROUND_OPTIONS);
    setBackgroundProcessingCount(0);
    setErrorMessage("");
    setBusyMessage("");
    setScreen("upload");
  }

  const handleBackgroundProcessingChange = useCallback((isProcessing: boolean) => {
    setBackgroundProcessingCount((currentCount) =>
      Math.max(0, currentCount + (isProcessing ? 1 : -1)),
    );
  }, []);

  return (
    <main className="app-shell">
      <div className="app-container">
        {errorMessage || visibleBusyMessage ? (
          <div className="toast-stack" aria-live="polite">
            {errorMessage ? <StatusMessage tone="error" message={errorMessage} /> : null}
            {visibleBusyMessage ? <BusyMessage message={visibleBusyMessage} /> : null}
          </div>
        ) : null}

        {screen === "upload" ? (
          <UploadArea
            disabled={Boolean(busyMessage)}
            threshold={detectionThreshold}
            thresholdMin={DETECTION_THRESHOLD_MIN}
            thresholdMax={DETECTION_THRESHOLD_MAX}
            thresholdStep={DETECTION_THRESHOLD_STEP}
            onFileSelected={handleFileSelected}
            onThresholdChange={handleThresholdChange}
          />
        ) : null}

        {screen === "select" && image ? (
          <FaceSelector
            image={image}
            faces={faces}
            notice={notice}
            threshold={detectionThreshold}
            thresholdMin={DETECTION_THRESHOLD_MIN}
            thresholdMax={DETECTION_THRESHOLD_MAX}
            thresholdStep={DETECTION_THRESHOLD_STEP}
            thresholdDisabled={Boolean(busyMessage)}
            onBack={handleReset}
            onRedetect={() => void runFaceDetection(image, detectionThreshold, true)}
            onSelect={handleFaceSelect}
            onThresholdChange={handleThresholdChange}
          />
        ) : null}

        {screen === "edit" && image && selectedFace && crop ? (
          <CropEditor
            image={image}
            backgroundOptions={backgroundOptions}
            crop={crop}
            effectOptions={effectOptions}
            shape={shape}
            onBack={() => setScreen("select")}
            onBackgroundOptionsChange={setBackgroundOptions}
            onBackgroundProcessingChange={handleBackgroundProcessingChange}
            onComplete={() => setScreen("download")}
            onCropChange={setCrop}
            onEffectOptionsChange={setEffectOptions}
            onShapeChange={setShape}
          />
        ) : null}

        {screen === "download" && image && crop ? (
          <DownloadPanel
            image={image}
            backgroundOptions={backgroundOptions}
            crop={crop}
            effectOptions={effectOptions}
            shape={shape}
            onBackgroundProcessingChange={handleBackgroundProcessingChange}
            onEdit={() => setScreen("edit")}
            onReset={handleReset}
          />
        ) : null}
      </div>
    </main>
  );
}

function BusyMessage({ message }: { message: string }) {
  return (
    <div className="status-banner">
      <Loader2 size={18} aria-hidden="true" className="spin" />
      <span>{message}</span>
    </div>
  );
}

function StatusMessage({ message, tone }: { message: string; tone: "error" }) {
  return (
    <div className={`status-banner ${tone}`}>
      <AlertTriangle size={18} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

function toUserMessage(error: unknown): string {
  if (error instanceof ImageProcessingError) {
    return error.message;
  }

  return "Could not load image. Try another image.";
}

export default App;
