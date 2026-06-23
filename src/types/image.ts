export interface ProcessedImage {
  originalName: string;
  url: string;
  width: number;
  height: number;
  fileSize: number;
  megapixels: number;
  orientation: number;
}

export type ImageErrorCode =
  | "unsupported-format"
  | "file-too-large"
  | "dimensions-too-large"
  | "load-failed";

export class ImageProcessingError extends Error {
  code: ImageErrorCode;

  constructor(code: ImageErrorCode, message: string) {
    super(message);
    this.name = "ImageProcessingError";
    this.code = code;
  }
}
