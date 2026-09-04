import type { DownloadArchiveOptions } from "@/types";
import { createBlobUrl } from "./blob-utils";

/**
 * Turn the rendered archive document into something `downloads.download` will
 * accept. Runs in whichever context has DOM APIs: the offscreen document on
 * Chrome, the background page on Firefox MV2.
 *
 * Chrome MV3 refuses `data:` URLs here ("Access denied for URL data:text/..."),
 * so a blob URL is the only workable form.
 */
export async function buildArchiveDownload(
  options: DownloadArchiveOptions & { offscreen?: boolean },
): Promise<{ url: string; filename: string }> {
  const blob = new Blob([options.html], { type: "text/html;charset=utf-8" });
  const url = await createBlobUrl(blob);
  return { url, filename: options.outputPath };
}
