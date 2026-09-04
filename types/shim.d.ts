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
      postAuthor?: string;
      postDate?: string;
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

/**
 * The archive document is rendered in the content script (it needs `DOMParser`,
 * which MV3 service workers lack) and handed to the background purely to be
 * written to disk.
 */
export interface ScanPagePostsMessage {
  success: boolean;
  data: {
    totalPosts: number;
    posts: {
      mediaPostId: string;
      subredditName: string;
      postTitle?: string;
      postAuthor?: string;
      postDate?: string;
    }[];
  };
}

export interface ArchivePostRequest {
  mediaPostId: string;
  subredditName?: string;
  postTitle?: string;
  postAuthor?: string;
  postDate?: string;
}

export interface ArchivePostResponse {
  success: boolean;
  message?: string;
  servedComments?: number;
  moreStubs?: number;
  htmlBytes?: number;
  mediaInlined?: number;
  subreddit?: string;
  title?: string;
}

export interface ArchiveRequestMessage {
  html: string;
  folderDestination: string;
  filename: string;
  servedComments: number;
  moreStubs: number;
}

declare module "webext-bridge" {
  export interface ProtocolMap {
    SCAN_PAGE_MEDIA: ProtocolWithReturn<
      { scrollUp?: boolean; anchorPostId?: string; skipPostIds?: string[] },
      ScanPageMediaMessage
    >;
    GET_CURRENT_POST_ID: ProtocolWithReturn<
      void,
      { success: boolean; postId?: string }
    >;
    MARK_POST_VISITED: ProtocolWithReturn<
      { mediaPostId: string },
      { success: boolean }
    >;
    HIGHLIGHT_CURRENT_POST: ProtocolWithReturn<
      HighlightPostMessage,
      HighlightPostResponse
    >;
    SCROLL_TO_LOAD_MORE: ProtocolWithReturn<
      { scrollUp?: boolean },
      ScrollToLoadMoreResponse
    >;
    DOWNLOAD_REQUEST: ProtocolWithReturn<
      DownloadRequestMessage,
      DownloadRequestResponse
    >;
    ARCHIVE_REQUEST: ProtocolWithReturn<
      ArchiveRequestMessage,
      DownloadRequestResponse
    >;
    SCAN_PAGE_POSTS: ProtocolWithReturn<
      { scrollUp?: boolean; anchorPostId?: string; skipPostIds?: string[] },
      ScanPagePostsMessage
    >;
    ARCHIVE_POST: ProtocolWithReturn<ArchivePostRequest, ArchivePostResponse>;
  }
}
