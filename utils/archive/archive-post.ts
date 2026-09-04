/**
 * One code path for "archive this post", shared by the per-post menu and the
 * sidebar's mass-archive loop.
 *
 * Everything here runs in the content script: fetching the post JSON needs the
 * page's cookies, and sanitizing needs `DOMParser`, which an MV3 service worker
 * does not have. Only the finished document crosses into the background, where
 * `browser.downloads` lives.
 */

import { sendMessage } from "webext-bridge/content-script";
import {
  folderDestination as folderDestinationStorage,
  archiveInlineMedia as archiveInlineMediaStorage,
  archiveInlineVideo as archiveInlineVideoStorage,
} from "@/utils/storage";
import { processFolderDestination } from "@/utils/post-utils";
import { sanitizeForFilename } from "@/utils/filename-utils";
import { buildPostArchive } from "./build-archive";

export type ArchivePostStats = {
  servedComments: number;
  moreStubs: number;
  htmlBytes: number;
  mediaInlined: number;
  subreddit: string;
  title: string;
};

export type ArchivePostInput = {
  /** Reddit thing id, with or without the `t3_` prefix. */
  postId: string;
  /** Present for the per-post menu; absent when driven from the sidebar. */
  postElement?: Element | null;
  /** Fallbacks for folder templating when there is no post element. */
  subredditName?: string;
  postTitle?: string;
  postAuthor?: string;
  postDate?: string;
};

export async function archivePost(
  input: ArchivePostInput,
): Promise<ArchivePostStats> {
  const thingId = input.postId.replace(/^t3_/, "");
  if (!thingId) throw new Error("Could not determine the post id");

  const [inlineMedia, inlineVideo, folderPattern] = await Promise.all([
    archiveInlineMediaStorage.getValue(),
    archiveInlineVideoStorage.getValue(),
    folderDestinationStorage.getValue(),
  ]);

  const { html, post, stats } = await buildPostArchive(thingId, {
    inlineMedia,
    inlineVideo,
  });

  const subredditName = post.subreddit || input.subredditName || "unknown";

  const finalFolderDestination = processFolderDestination(
    folderPattern,
    input.postElement ?? null,
    subredditName,
    input.postDate,
    input.postAuthor ?? post.author,
    input.postTitle ?? post.title,
  );

  // The post id keeps the filename unique: two posts in a subreddit can share
  // a title, and a truncated title collides more often than you would think.
  const filename = `${sanitizeForFilename(post.title, 80) || "post"} (${thingId}).html`;

  const response = await sendMessage(
    "ARCHIVE_REQUEST",
    {
      html,
      folderDestination: finalFolderDestination,
      filename,
      servedComments: stats.servedComments,
      moreStubs: stats.moreStubs,
    },
    "background",
  );

  if (!response?.success) {
    throw new Error(response?.message || "Download failed");
  }

  return {
    servedComments: stats.servedComments,
    moreStubs: stats.moreStubs,
    htmlBytes: stats.htmlBytes,
    mediaInlined: stats.mediaInlined,
    subreddit: subredditName,
    title: post.title,
  };
}
