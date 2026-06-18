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
 * "filename must not contain illegal characters" otherwise. The browser's rule
 * (base::i18n::IsFilenameLegal) bans the reserved punctuation plus every Unicode
 * control (\p{Cc}) and format (\p{Cf}) character. The latter is what breaks
 * "complex" emoji: a ZWJ sequence like 🤷‍♀️ contains a zero-width joiner
 * (U+200D, category Cf). We strip those (and bidi marks, zero-width spaces, BOM)
 * but keep the visible emoji glyphs, which are legal. Cleans each "/" segment,
 * keeps the separators, collapses whitespace, and drops trailing dots/spaces
 * (illegal per Windows path segment).
 */
export function sanitizeDownloadPath(path: string): string {
  const segments = path
    .split("/")
    .map((segment) =>
      segment
        .replace(/[<>:"|?*\\\p{Cc}\p{Cf}]/gu, "")
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
