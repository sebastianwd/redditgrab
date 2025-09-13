import { ProtocolWithReturn } from "webext-bridge";
import { MediaContentType } from "../types";

export interface ScanPageMediaMessage {
  success: boolean;
  data: {
    totalPosts: number;
    mediaUrls: {
      urls: string[];
      type: MediaContentType;
      mediaContainer: Element;
      subredditName: string;
    }[];
  };
}

export interface HighlightPostMessage {
  postIndex: number;
  subredditName: string;
  mediaType: string;
}

export interface HighlightPostResponse {
  success: boolean;
}

declare module "webext-bridge" {
  export interface ProtocolMap {
    SCAN_PAGE_MEDIA: ProtocolWithReturn<void, ScanPageMediaMessage>;
    HIGHLIGHT_CURRENT_POST: ProtocolWithReturn<
      HighlightPostMessage,
      HighlightPostResponse
    >;
  }
}
