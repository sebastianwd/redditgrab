import { MESSAGE_TARGET, OFFSCREEN_KEYS } from "@/utils/contants";

export type MediaContentType = "video" | "single-image" | "multiple-images";

export type DownloadVideoOptions = {
  url: string;
  folderDestination: string;
  subredditName: string;
  addTitleToVideo: boolean;
  postTitle: string;
  filenamePattern: string;
  offscreen?: boolean;
};

export interface BaseMessage {
  target: string;
  type: string;
}

// Offscreen message types
export interface DownloadVideoMessage extends BaseMessage {
  type: typeof OFFSCREEN_KEYS.DOWNLOAD_VIDEO;
  data: DownloadVideoOptions;
}

export type OffscreenMessage = DownloadVideoMessage;

// Background message types (responses from offscreen)
export interface DownloadVideoResponseMessage extends BaseMessage {
  type: typeof OFFSCREEN_KEYS.DOWNLOAD_VIDEO;
  data: {
    url: string;
    filename: string;
  };
}

export type BackgroundMessage = DownloadVideoResponseMessage;

// Type guards
export function isOffscreenMessage(message: any): message is OffscreenMessage {
  if (message?.target !== MESSAGE_TARGET.OFFSCREEN || !message?.type) {
    return false;
  }
  return true;
}

export function isBackgroundMessage(
  message: any
): message is BackgroundMessage {
  if (message?.target !== MESSAGE_TARGET.BACKGROUND || !message?.type) {
    return false;
  }
  return true;
}
