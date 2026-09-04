/**
 * Builds a self-contained HTML archive of a single Reddit post.
 *
 * Runs in the content script, not the background, for two reasons:
 * 1. Reddit serves a JS challenge to clients that don't look like a browser
 *    tab; fetching the post JSON from the page context is the path already
 *    proven to work (see `utils/reddit-post-api.ts`).
 * 2. Sanitizing needs `DOMParser`, which does not exist in an MV3 service
 *    worker.
 *
 * Media fetches to `*.redd.it` work here because the manifest holds host
 * permissions for it, which grants the content script a CORS bypass.
 */

import { logger } from "@/utils/logger";
import { parsePostJson, flattenComments, type ArchivePost } from "./tree";
import { collectImageUrls } from "./sanitize";
import { renderArchiveDocument } from "./render";

export type BuildArchiveOptions = {
  /** Embed media as data URIs. Off means every image becomes a link. */
  inlineMedia: boolean;
  /** Total inline budget in bytes. Media past it degrades to links. */
  mediaBudgetBytes: number;
  /** Videos are big; opt-in separately from images. */
  inlineVideo: boolean;
};

export const DEFAULT_ARCHIVE_OPTIONS: BuildArchiveOptions = {
  inlineMedia: true,
  mediaBudgetBytes: 20 * 1024 * 1024,
  inlineVideo: false,
};

export type ArchiveResult = {
  html: string;
  post: ArchivePost;
  stats: {
    servedComments: number;
    claimedComments: number;
    moreStubs: number;
    hiddenComments: number;
    mediaInlined: number;
    mediaSkipped: number;
    mediaBytes: number;
    htmlBytes: number;
    elapsedMs: number;
  };
};

/** Reddit's hard ceiling. `limit=1000` and `depth=20` are ignored. */
const COMMENT_LIMIT = 500;

async function fetchPostJson(postId: string): Promise<[any, any]> {
  const id = postId.replace(/^t3_/, "");
  const res = await fetch(
    `https://www.reddit.com/comments/${id}/.json?raw_json=1&limit=${COMMENT_LIMIT}`,
    { credentials: "include" },
  );
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !contentType.includes("json")) {
    throw new Error(
      `Post JSON unavailable (status ${res.status}, ${contentType || "no content-type"})`,
    );
  }
  return (await res.json()) as [any, any];
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read media blob"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetch media up to the budget. Anything that fails or does not fit is left
 * out of the map, and the renderer turns it into a link rather than a live
 * remote `<img>`.
 */
async function inlineMedia(
  urls: string[],
  options: BuildArchiveOptions,
): Promise<{ map: Map<string, string>; bytes: number; skipped: number }> {
  const map = new Map<string, string>();
  let bytes = 0;
  let skipped = 0;

  for (const url of urls) {
    if (bytes >= options.mediaBudgetBytes) {
      skipped++;
      continue;
    }
    try {
      const res = await fetch(url, { credentials: "omit" });
      if (!res.ok) {
        skipped++;
        continue;
      }
      const blob = await res.blob();
      if (bytes + blob.size > options.mediaBudgetBytes) {
        skipped++;
        continue;
      }
      map.set(url, await blobToDataUri(blob));
      bytes += blob.size;
    } catch (error) {
      logger.warn(`Archive: media fetch failed for ${url}`, error);
      skipped++;
    }
  }

  return { map, bytes, skipped };
}

export async function buildPostArchive(
  postId: string,
  overrides: Partial<BuildArchiveOptions> = {},
): Promise<ArchiveResult> {
  const started = Date.now();
  const options = { ...DEFAULT_ARCHIVE_OPTIONS, ...overrides };

  const post = parsePostJson(await fetchPostJson(postId));

  // Post-level media, plus any image embedded inside a comment body.
  const mediaUrls: string[] = [];
  for (const item of post.media.items) {
    if (item.kind === "video" && !options.inlineVideo) continue;
    mediaUrls.push(item.url);
  }
  for (const comment of flattenComments(post.comments)) {
    mediaUrls.push(...collectImageUrls(comment.bodyHtml));
  }
  mediaUrls.push(...collectImageUrls(post.selftextHtml));

  const unique = [...new Set(mediaUrls)];
  const { map, bytes, skipped } = options.inlineMedia
    ? await inlineMedia(unique, options)
    : { map: new Map<string, string>(), bytes: 0, skipped: unique.length };

  const notes: string[] = [];
  if (skipped > 0) {
    notes.push(
      `${skipped} media file${skipped === 1 ? "" : "s"} left as links (not embedded).`,
    );
  }
  if (!options.inlineVideo && post.media.type === "video") {
    notes.push("Video is linked, not embedded.");
  }

  const html = renderArchiveDocument(post, {
    mediaMap: map,
    archivedAt: new Date().toISOString().slice(0, 10),
    mediaNote: notes.join(" ") || undefined,
  });

  return {
    html,
    post,
    stats: {
      servedComments: post.served,
      claimedComments: post.numCommentsClaimed,
      moreStubs: post.moreStubs,
      hiddenComments: post.hiddenCount,
      mediaInlined: map.size,
      mediaSkipped: skipped,
      mediaBytes: bytes,
      htmlBytes: new Blob([html]).size,
      elapsedMs: Date.now() - started,
    },
  };
}
