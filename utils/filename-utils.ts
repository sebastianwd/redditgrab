export interface FilenameData {
  subreddit: string;
  timestamp: string;
  filename: string;
  extension: string;
}

export function generateFilename(pattern: string, data: FilenameData): string {
  return (
    pattern
      .replace(/{subreddit}/g, data.subreddit)
      .replace(/{timestamp}/g, data.timestamp)
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
