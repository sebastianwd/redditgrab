import type { MediaContentType } from "@/types";
import { getGalleryImageUrls } from "./media-download";
import { fetchPostMedia } from "./reddit-post-api";
import { logger } from "./logger";

/**
 * Search results do not render `shreddit-post` elements, so this module handles
 * detecting them and extracting per-result media for the mass-download pipeline.
 *
 * Two layouts:
 * - Posts tab: a `search-telemetry-tracker` wrapper with
 *   `[data-testid="search-sdui-post"]` (image/gallery/redgifs) or an inner
 *   `[data-testid="search-post-with-content-preview"]` (video).
 * - Media tab: a thumbnail grid of `<a href="/comments/<id>/">` tiles (no
 *   testid/thingid); the post id comes from the permalink.
 *
 * Galleries on the Posts tab read full images from the in-page carousel; every
 * other case resolves full media via the post JSON (see reddit-post-api).
 */

const RESULT_ROOT_SELECTOR =
  '[data-testid="search-sdui-post"], [data-testid="search-post-with-content-preview"]';

// Media tab (`type=media`) is a thumbnail grid: each tile is an `<a>` linking to
// the post and containing the media thumbnail. No `data-testid`/`data-thingid`,
// so the post id comes from the `/comments/<id>/` href and full media resolves
// via the post JSON (same path as thumbnail-only Posts-tab results).
const MEDIA_TILE_SELECTOR = 'a[href*="/comments/"]';
const COMMENTS_ID_RE = /\/comments\/([a-z0-9]+)/i;

/** True when the current page is a Reddit search results page. */
export const isSearchResultsPage = (): boolean => {
  if (window.location.pathname.includes("/search")) return true;
  return document.querySelector(RESULT_ROOT_SELECTOR) !== null;
};

// Media-tab tiles wrap their media in these; Posts-tab rows never do.
const MEDIA_GRID_SIGNAL =
  '[data-id="search-media-post-unit"], a[href*="/comments/"] shreddit-aspect-ratio';

/** True when on the search Media tab (grid of media thumbnails). */
const isMediaSearchTab = (): boolean => {
  // Posts/Comments tabs render these result roots; the Media grid does not.
  if (document.querySelector(RESULT_ROOT_SELECTOR)) return false;
  const type = new URLSearchParams(window.location.search).get("type");
  if (type === "media") return true;
  // Fallback when the URL param isn't present: detect the media grid in the DOM.
  return document.querySelector(MEDIA_GRID_SIGNAL) !== null;
};

/**
 * Media-tab grid tiles, one anchor per post. Each post has two `/comments/`
 * links (the thumbnail tile and the title), so we dedupe by post id. We do NOT
 * require an `<img>` — NSFW posts render blurred/placeholder thumbnails that
 * aren't plain images, and filtering on `img` dropped every tile. When both
 * anchors exist we prefer the one holding the thumbnail (better highlight/badge
 * anchor), otherwise we keep the first seen.
 */
const getMediaTabRoots = (): Element[] => {
  const byId = new Map<string, Element>();
  for (const anchor of document.querySelectorAll(MEDIA_TILE_SELECTOR)) {
    const id = anchor.getAttribute("href")?.match(COMMENTS_ID_RE)?.[1];
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, anchor);
    } else if (
      anchor.querySelector("img, faceplate-img, video") &&
      !existing.querySelector("img, faceplate-img, video")
    ) {
      byId.set(id, anchor);
    }
  }
  return Array.from(byId.values());
};

/** All search result root elements currently in the DOM (Posts or Media tab). */
export const getSearchResultRoots = (): Element[] =>
  isMediaSearchTab()
    ? getMediaTabRoots()
    : Array.from(document.querySelectorAll(RESULT_ROOT_SELECTOR));

/** Reddit thing id (e.g. "t3_1tww4q0") for a search result. */
export const getSearchThingId = (root: Element): string | null => {
  const direct = root.getAttribute("data-thingid");
  if (direct) return direct;

  // Outer tracker may hold the thingid while the testid is on a child.
  const tracker = root.closest("[data-thingid]");
  if (tracker?.getAttribute("data-thingid")) {
    return tracker.getAttribute("data-thingid");
  }

  // Gallery carousel carries the post id.
  const carousel = root.querySelector("gallery-carousel[post-id]");
  const postId = carousel?.getAttribute("post-id");
  if (postId) return postId;

  // Title anchor id: "search-post-title-t3_xxx".
  const titleEl = root.querySelector('[id^="search-post-title-"]');
  const titleId = titleEl?.getAttribute("id");
  if (titleId) return titleId.replace("search-post-title-", "");

  // Media-tab tile (or any result): derive from the post permalink.
  const commentsHref = root.matches(MEDIA_TILE_SELECTOR)
    ? root.getAttribute("href")
    : root.querySelector(MEDIA_TILE_SELECTOR)?.getAttribute("href");
  const commentsId = commentsHref?.match(COMMENTS_ID_RE)?.[1];
  if (commentsId) return `t3_${commentsId}`;

  return null;
};

/**
 * Re-find a search result row by its thing id from the live DOM. More robust
 * than relying on the `data-wxt-media-id` we tag during the scan, which Reddit's
 * faceplate framework can wipe on re-render (observed differing across browsers).
 */
export const findSearchRowByThingId = (
  thingId: string,
): HTMLElement | null => {
  for (const root of getSearchResultRoots()) {
    if (getSearchThingId(root) === thingId) return root as HTMLElement;
  }
  const tagged = document.querySelector(`[data-wxt-media-id="${thingId}"]`);
  return tagged as HTMLElement | null;
};

/** Subreddit name from a result's community link, without the "r/" prefix. */
export const getSearchSubredditName = (root: Element): string => {
  const link = root.querySelector('a[href^="/r/"]');
  const href = link?.getAttribute("href");
  const match = href?.match(/^\/r\/([^/]+)/);
  return match ? match[1] : "unknown";
};

/** Post title text from a search result. */
export const getSearchPostTitle = (root: Element): string => {
  const el = root.querySelector(
    '[data-testid="post-title-text"], a[data-testid="post-title"]',
  );
  return el?.textContent?.trim() ?? "";
};

export type SearchResultMedia = {
  type: MediaContentType;
  urls: string[];
  mediaPostId: string;
  subredditName: string;
  postTitle: string;
  /** Present when sourced from the post API (richer than search DOM). */
  postAuthor?: string;
  postDate?: string;
};

/**
 * Extract downloadable media from a single search result.
 *
 * Gallery posts ship their full `gallery-carousel` inside a hidden container,
 * so we read full-resolution images straight from the page. Video, redgifs, and
 * single-image results expose only a thumbnail, so we fetch the post's own data
 * to resolve full media (and richer metadata).
 */
export const extractSearchResultMedia = async (
  root: Element,
): Promise<SearchResultMedia | null> => {
  const thingId = getSearchThingId(root);
  if (!thingId) {
    logger.warn("Search result without thing id, skipping");
    return null;
  }

  // Never let one bad result reject the whole scan batch (which would abort the
  // entire mass download). Any failure here resolves to "skip this result".
  try {
    const carousel = root.querySelector("gallery-carousel");
    if (carousel) {
      const urls = await getGalleryImageUrls(root);
      if (urls.length === 0) {
        logger.warn(`Gallery ${thingId} had no extractable images, skipping`);
        return null;
      }
      return {
        type: "multiple-images",
        urls,
        mediaPostId: thingId,
        subredditName: getSearchSubredditName(root),
        postTitle: getSearchPostTitle(root),
      };
    }

    // Thumbnail-only types (video, redgifs, single image): resolve via post API.
    const media = await fetchPostMedia(thingId);
    if (!media) return null;

    return {
      type: media.type,
      urls: media.urls,
      mediaPostId: thingId,
      subredditName: media.subredditName || getSearchSubredditName(root),
      postTitle: media.postTitle || getSearchPostTitle(root),
      postAuthor: media.postAuthor,
      postDate: media.postDate,
    };
  } catch (error) {
    logger.warn(`Failed to extract media for ${thingId}, skipping`, error);
    return null;
  }
};
