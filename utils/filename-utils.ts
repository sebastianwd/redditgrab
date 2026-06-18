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

/**
 * Sanitize a full download path for browser.downloads.download, which throws
 * "filename must not contain illegal characters" otherwise. Cleans each "/"
 * segment (folders + final filename) but keeps the separators: strips chars
 * illegal on Windows/Chrome/Firefox plus control chars, collapses whitespace,
 * and drops trailing dots/spaces (illegal per Windows path segment).
 */
export function sanitizeDownloadPath(path: string): string {
  const segments = path
    .split("/")
    .map((segment) =>
      segment
        // eslint-disable-next-line no-control-regex
        .replace(/[<>:"|?*\\\x00-\x1f\x7f]/g, "")
        .replace(/\s+/g, " ")
        .replace(/[ .]+$/g, "")
        .trim(),
    )
    .filter((segment) => segment.length > 0);
  return segments.join("/");
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
