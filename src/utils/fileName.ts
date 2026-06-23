const INVALID_FILE_NAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

export function buildDownloadFileName(originalName: string, date = new Date()): string {
  const baseName = originalName.replace(/\.[^/.]+$/, "") || "face-icon";
  const safeBaseName = baseName.replace(INVALID_FILE_NAME_CHARS, "_").trim() || "face-icon";
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${safeBaseName}_face${year}${month}${day}.png`;
}
