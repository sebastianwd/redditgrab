import { MESSAGE_TARGET, OFFSCREEN_KEYS } from "@/utils/constants";

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

export type DownloadImageOptions = {
  urls: string[];
  folderDestination?: string;
  subredditName?: string;
  useGalleryFolders?: boolean;
  addTitleToImages?: boolean;
  postTitle?: string;
  filenamePattern: string;
  offscreen?: boolean;
};

/**
 * Writing the archive needs `URL.createObjectURL`, which an MV3 service worker
 * does not have. Chrome rejects `data:` URLs in `downloads.download`
 * ("Access denied for URL data:text/html..."), so the document is turned into a
 * blob URL in the offscreen document, exactly like video and image downloads.
 */
export type DownloadArchiveOptions = {
  html: string;
  /** Full, already-sanitized output path including the .html filename. */
  outputPath: string;
};

export interface BaseMessage {
  target: string;
  type: string;
  downloadId?: string;
}

// Offscreen message types
export interface DownloadVideoMessage extends BaseMessage {
  type: typeof OFFSCREEN_KEYS.DOWNLOAD_VIDEO;
  data: DownloadVideoOptions;
}

export interface DownloadImageMessage extends BaseMessage {
  type: typeof OFFSCREEN_KEYS.DOWNLOAD_IMAGE;
  data: DownloadImageOptions;
}

export interface DownloadArchiveMessage extends BaseMessage {
  type: typeof OFFSCREEN_KEYS.DOWNLOAD_ARCHIVE;
  data: DownloadArchiveOptions;
}

export type OffscreenMessage =
  | DownloadVideoMessage
  | DownloadImageMessage
  | DownloadArchiveMessage;

// Background message types (responses from offscreen)
export interface DownloadVideoResponseMessage extends BaseMessage {
  type: typeof OFFSCREEN_KEYS.DOWNLOAD_VIDEO;
  data: {
    url: string;
    filename: string;
  };
}

export interface DownloadImageResponseMessage extends BaseMessage {
  type: typeof OFFSCREEN_KEYS.DOWNLOAD_IMAGE;
  data: {
    url: string;
    filename: string;
  }[];
}

export interface DownloadArchiveResponseMessage extends BaseMessage {
  type: typeof OFFSCREEN_KEYS.DOWNLOAD_ARCHIVE;
  data: {
    url: string;
    filename: string;
  };
}

export type BackgroundMessage =
  | DownloadVideoResponseMessage
  | DownloadImageResponseMessage
  | DownloadArchiveResponseMessage;

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
