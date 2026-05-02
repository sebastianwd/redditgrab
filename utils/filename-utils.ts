import filenamify from "filenamify/browser";

export interface FilenameData {
  subreddit: string;
  timestamp: string;
  filename: string;
  extension: string;
  title?: string;
}

/**
 * Strip filesystem-unsafe characters from a string so it's safe to use as a filename
 */
export function sanitizeForFilename(
  raw: string | undefined | null,
  maxLength = 80,
): string {
  if (!raw) return "";
  const cleaned = filenamify(raw, { maxLength, replacement: " " })
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

export function generateFilename(pattern: string, data: FilenameData): string {
  const safeTitle = sanitizeForFilename(data.title) || "untitled";
  return (
    pattern
      .replace(/{subreddit}/g, data.subreddit)
      .replace(/{timestamp}/g, data.timestamp)
      .replace(/{title}/g, safeTitle)
      .replace(/{filename}/g, data.filename) +
    "." +
    data.extension
  );
}

export function extractFilenameFromUrl(url: string): string {
  const urlPath = new URL(url).pathname;
  const lastPart = urlPath.split("/").pop()?.split(".")[0] || "file";
  return lastPart;
}

export function getCurrentTimestamp(): string {
  const now = new Date();
  return now.toISOString().slice(0, 19).replace(/[T:]/g, "-");
}
