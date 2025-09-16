import { DownloadVideoOptions, isBackgroundMessage } from "@/types";
import { OFFSCREEN_DOCUMENT_PATH } from "@/utils/contants";

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
    data: {
      url: options.url,
      folderDestination: options.folderDestination,
      subredditName: options.subredditName,
      addTitleToVideo: options.addTitleToVideo,
      postTitle: options.postTitle,
      filenamePattern: options.filenamePattern,
    },
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
    default:
      console.warn(`Unexpected message received: '${message.type}'.`);
  }
}
