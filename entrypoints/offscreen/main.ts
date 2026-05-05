import { MESSAGE_TARGET, OFFSCREEN_KEYS } from "@/utils/constants";
import { OffscreenMessage, isOffscreenMessage } from "@/types";

browser.runtime.onMessage.addListener((message: any) => {
  if (!isOffscreenMessage(message)) {
    return;
  }
  handleMessages(message);
});

function handleMessages(message: OffscreenMessage & { downloadId?: string }) {
  if (message?.target !== MESSAGE_TARGET.OFFSCREEN || !message?.type) {
    return;
  }

  const { downloadId } = message;

  switch (message.type) {
    case OFFSCREEN_KEYS.DOWNLOAD_VIDEO:
      downloadVideo({
        ...message.data,
        offscreen: true,
      }).then((result) => {
        sendToBackground(OFFSCREEN_KEYS.DOWNLOAD_VIDEO, result, downloadId);
      });

      break;
    case OFFSCREEN_KEYS.DOWNLOAD_IMAGE:
      downloadGalleryImages({
        ...message.data,
        offscreen: true,
      }).then((result) => {
        sendToBackground(OFFSCREEN_KEYS.DOWNLOAD_IMAGE, result, downloadId);
      });
      break;
    default:
      console.warn(
        `Unexpected message received: '${JSON.stringify(message)}'.`
      );
      return;
  }
}

function sendToBackground(type: string, data: any, downloadId?: string) {
  chrome.runtime.sendMessage({
    type,
    target: MESSAGE_TARGET.BACKGROUND,
    data,
    downloadId,
  });
}
