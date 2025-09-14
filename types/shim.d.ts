import { ProtocolWithReturn } from "webext-bridge";
import { MediaContentType } from "../types";

export interface ScanPageMediaMessage {
  success: boolean;
  data: {
    totalPosts: number;
    mediaUrls: {
      urls: string[];
      type: MediaContentType;
      subredditName: string;
      mediaPostId: string;
      postTitle?: string;
    }[];
  };
}

export interface HighlightPostMessage {
  mediaPostId: string;
  subredditName: string;
  mediaType: string;
}

export interface HighlightPostResponse {
  success: boolean;
}

export interface ScrollToLoadMoreResponse {
  success: boolean;
}

export interface DownloadRequestMessage {
  timestamp: number;
  mediaContentType: MediaContentType;
  urls: string[];
  folderDestination: string;
  subredditName: string;
  useGalleryFolders: boolean;
  addTitleToImages: boolean;
  addTitleToVideos: boolean;
  postTitle?: string;
}

export interface DownloadRequestResponse {
  success: boolean;
  message?: string;
}

declare module "webext-bridge" {
  export interface ProtocolMap {
    SCAN_PAGE_MEDIA: ProtocolWithReturn<void, ScanPageMediaMessage>;
    HIGHLIGHT_CURRENT_POST: ProtocolWithReturn<
      HighlightPostMessage,
      HighlightPostResponse
    >;
    SCROLL_TO_LOAD_MORE: ProtocolWithReturn<void, ScrollToLoadMoreResponse>;
    DOWNLOAD_REQUEST: ProtocolWithReturn<
      DownloadRequestMessage,
      DownloadRequestResponse
    >;
  }
}
