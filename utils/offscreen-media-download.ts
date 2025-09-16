import {
  DownloadImageOptions,
  DownloadVideoOptions,
  isBackgroundMessage,
} from "@/types";
import { OFFSCREEN_DOCUMENT_PATH } from "@/utils/constants";

declare const self: ServiceWorkerGlobalScope;

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

  await browser.runtime.sendMessage({
    type: OFFSCREEN_KEYS.DOWNLOAD_VIDEO,
    target: MESSAGE_TARGET.OFFSCREEN,
    data: options,
  });
};

export const offscreenDownloadGalleryImages = async (
  options: Omit<DownloadImageOptions, "offscreen">
) => {
  if (!browser.offscreen) {
    return;
  }

  await createOffscreenDocument();

  await browser.runtime.sendMessage({
    type: OFFSCREEN_KEYS.DOWNLOAD_IMAGE,
    target: MESSAGE_TARGET.OFFSCREEN,
    data: options,
  });
};

export async function handleOffscreenMessages(message: any) {
  if (!isBackgroundMessage(message)) {
    return;
  }

  switch (message.type) {
    case OFFSCREEN_KEYS.DOWNLOAD_VIDEO:
      await browser.downloads.download({
        url: message.data.url,
        filename: message.data.filename,
        saveAs: false,
      });
      break;
    case OFFSCREEN_KEYS.DOWNLOAD_IMAGE:
      await Promise.all(
        message.data.map((item) =>
          browser.downloads.download({
            url: item.url,
            filename: item.filename,
            saveAs: false,
          })
        )
      );
      break;
    default:
      console.warn(
        `Unexpected message received: '${JSON.stringify(message)}'.`
      );
  }
}
