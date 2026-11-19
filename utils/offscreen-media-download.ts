import {
  DownloadImageOptions,
  DownloadVideoOptions,
  isBackgroundMessage,
} from "@/types";
import { OFFSCREEN_DOCUMENT_PATH } from "@/utils/constants";
import {
  hasMediaHash,
  hasSimilarImageHash,
  saveImagePerceptualHash,
  saveMediaHash,
} from "@/utils/media-hash";

declare const self: ServiceWorkerGlobalScope;

const pendingDownloads = new Map<
  string,
  { resolve: () => void; reject: (err: any) => void }
>();

async function hasOffscreenDocument() {
  const contexts = await browser.runtime?.getContexts({
    contextTypes: [browser.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [browser.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
  });

  if (contexts != null) {
    return contexts.length > 0;
  } else {
    const matchedClients = await self.clients.matchAll();
    return matchedClients.some((client) =>
      client.url.includes(browser.runtime.id)
    );
  }
}

export async function createOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    return;
  }

  await browser.offscreen.createDocument({
    url: browser.runtime.getURL(OFFSCREEN_DOCUMENT_PATH),
    reasons: [browser.offscreen.Reason.WORKERS],
    justification: "FFmpeg",
  });
}

export const offscreenDownloadVideo = async (
  options: Omit<DownloadVideoOptions, "offscreen">
) => {
  if (!browser.offscreen) {
    return;
  }
  await createOffscreenDocument();

  const downloadId = crypto.randomUUID();
  const downloadComplete = new Promise<void>((resolve, reject) => {
    pendingDownloads.set(downloadId, { resolve, reject });
  });

  await browser.runtime.sendMessage({
    type: OFFSCREEN_KEYS.DOWNLOAD_VIDEO,
    target: MESSAGE_TARGET.OFFSCREEN,
    data: options,
    downloadId,
  });

  await downloadComplete;
};

export const offscreenDownloadGalleryImages = async (
  options: Omit<DownloadImageOptions, "offscreen">
) => {
  if (!browser.offscreen) {
    return;
  }

  await createOffscreenDocument();

  const downloadId = crypto.randomUUID();
  const downloadComplete = new Promise<void>((resolve, reject) => {
    pendingDownloads.set(downloadId, { resolve, reject });
  });

  await browser.runtime.sendMessage({
    type: OFFSCREEN_KEYS.DOWNLOAD_IMAGE,
    target: MESSAGE_TARGET.OFFSCREEN,
    data: options,
    downloadId,
  });

  await downloadComplete;
};

export async function handleOffscreenMessages(message: any) {
  if (!isBackgroundMessage(message)) {
    return;
  }

  const { downloadId } = message;

  try {
    switch (message.type) {
      case OFFSCREEN_KEYS.DOWNLOAD_VIDEO: {
        const video = message.data as { url?: string; filename?: string; error?: string; hash?: string; skipDuplicateMedia?: boolean; skipped?: boolean };
        if (video?.skipped) break;
        if (!video?.url) {
          throw new Error(video?.error || "No video file produced");
        }
        await browser.downloads.download({
          url: video.url,
          filename: video.filename,
          saveAs: false,
        });
        if (video.skipDuplicateMedia && video.hash) {
          await saveMediaHash(video.hash);
        }
        break;
      }
      case OFFSCREEN_KEYS.DOWNLOAD_IMAGE: {
        const items = message.data as
          | { url: string; filename: string; hash?: string; perceptualHash?: string; skipDuplicateMedia?: boolean }[]
          | { error?: string };
        if (!Array.isArray(items)) {
          throw new Error(items?.error || "No image files produced");
        }
        for (const item of items) {
          if (item.skipDuplicateMedia) {
            if (
              (item.perceptualHash && (await hasSimilarImageHash(item.perceptualHash))) ||
              (item.hash && (await hasMediaHash(item.hash)))
            ) continue;
          }
          await browser.downloads.download({
            url: item.url,
            filename: item.filename,
            saveAs: false,
          });
          if (item.skipDuplicateMedia && item.hash) {
            await saveMediaHash(item.hash);
            if (item.perceptualHash) {
              await saveImagePerceptualHash(item.perceptualHash);
            }
          }
        }
        break;
      }
      default:
        console.warn(
          `Unexpected message received: '${JSON.stringify(message)}'.`
        );
        return;
    }

    if (downloadId) {
      pendingDownloads.get(downloadId)?.resolve();
      pendingDownloads.delete(downloadId);
    }
  } catch (error) {
    if (downloadId) {
      pendingDownloads.get(downloadId)?.reject(error);
      pendingDownloads.delete(downloadId);
    } else {
      throw error;
    }
  }
}
