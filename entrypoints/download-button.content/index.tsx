import "~/assets/tailwind.css";
import ReactDOM from "react-dom/client";
import type { MediaContentType } from "~/types";
import DownloadButton from "@/components/download-button";
import { onMessage } from "webext-bridge/content-script";
import { Selectors } from "@/utils/constants";
import {
  processedPostIds,
  useDateRange,
  dateRangeStart,
  dateRangeEnd,
  showDownloadedMarkers,
} from "@/utils/storage";
import { compact } from "es-toolkit";
import { logger } from "@/utils/logger";
import { parseISO, isValid } from "date-fns";
import { markPostAsVisited } from "@/utils/mark-visited";
import { getPostIdentifier, setPostIdentifier } from "@/utils/post-identifier";
import {
  getPostTitle,
  getPostAuthor,
  getPostDate,
  getPostDatetime,
} from "@/utils/post-utils";
import {
  isSearchResultsPage,
  getSearchResultRoots,
  getSearchThingId,
  findSearchRowByThingId,
  extractSearchResultMedia,
} from "@/utils/search-scraping";

const scrollToLoadMore = (scrollUp: boolean) => {
  if (scrollUp) {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
    logger.log("Scrolled to top to load newer posts");
  } else {
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth",
    });
    logger.log("Scrolled to bottom to load more posts");
  }
};

const isPostInDateRange = (
  post: Element,
  startTimestamp?: string,
  endTimestamp?: string,
): boolean => {
  if (!startTimestamp && !endTimestamp) return true;

  try {
    // Get the post datetime using shared function
    const datetime = getPostDatetime(post);
    if (!datetime) {
      logger.log("No datetime found for post, including in range");
      return true; // If we can't determine date, include it
    }

    // Parse the post date using date-fns
    const postDate = parseISO(datetime);
    if (!isValid(postDate)) {
      logger.log(`Invalid post date format: ${datetime}, including in range`);
      return true;
    }

    const postTimestamp = postDate.getTime();

    // Parse start and end timestamps if provided
    const start = startTimestamp ? parseInt(startTimestamp) : null;
    const end = endTimestamp ? parseInt(endTimestamp) : null;

    // Validate parsed timestamps
    if (start && isNaN(start)) {
      logger.log(
        `Invalid start timestamp: ${startTimestamp}, including in range`,
      );
      return true;
    }

    if (end && isNaN(end)) {
      logger.log(`Invalid end timestamp: ${endTimestamp}, including in range`);
      return true;
    }

    // Check if post is before start timestamp
    if (start && postTimestamp < start) {
      return false;
    }

    // Check if post is after end timestamp
    if (end && postTimestamp > end) {
      return false;
    }
    return true;
  } catch (error) {
    logger.error("Error checking post date range:", error);
    return true; // If there's an error, include the post
  }
};

// ── Search-result download highlight ─────────────────────────────────────────
// Overlay border that scrolls with the row (approach from civitai-dl). Styled
// via the CSSOM + Web Animations API rather than an injected <style>, because
// Reddit's CSP blocks injected stylesheets (which left the overlay invisible).
// Each highlight persists until the next one starts; a long timeout cleans up
// the final one.
const RG_HIGHLIGHT_TIMEOUT_MS = 20000;

const clearHighlights = () => {
  document
    .querySelectorAll("[data-rg-dl-highlight]")
    .forEach((el) => el.remove());
};

/** Prefer a clipped, rounded ancestor so the border hugs the visible tile. */
const getHighlightTarget = (card: HTMLElement): HTMLElement => {
  let el: HTMLElement | null = card;
  while (el && el !== document.body) {
    const { overflow, overflowX, overflowY, borderRadius } =
      getComputedStyle(el);
    const clipped = [overflow, overflowX, overflowY].some(
      (value) => value === "hidden" || value === "clip",
    );
    if (clipped && borderRadius !== "0px") return el;
    el = el.parentElement;
  }
  return card;
};

/**
 * Resolve an element that forms a real positioning box. Reddit's search rows are
 * `search-telemetry-tracker` custom elements with `display:inline` (or
 * `contents`), where `position:relative` has no useful box, so an absolute child
 * (`right:0`) lands on the wrong side. Fall through to the first block-level child.
 */
const resolveBoxElement = (el: HTMLElement): HTMLElement => {
  const display = getComputedStyle(el).display;
  if (display === "inline" || display === "contents") {
    const child = el.firstElementChild as HTMLElement | null;
    if (child) return child;
  }
  return el;
};

/** Overlay inside the card so it scrolls with the page (no per-frame sync). */
const highlightCard = (card: HTMLElement) => {
  clearHighlights();

  const target = resolveBoxElement(getHighlightTarget(card));
  if (getComputedStyle(target).position === "static") {
    target.style.position = "relative";
  }

  const overlay = document.createElement("div");
  overlay.dataset.rgDlHighlight = "";
  // Explicit offsets (not the `inset` shorthand) so the overlay reliably fills
  // the row in Firefox, where `inset:0` via cssText didn't apply (rendered as a
  // small box in the corner).
  overlay.style.cssText = [
    "position:absolute",
    "top:0",
    "left:0",
    "right:0",
    "bottom:0",
    "pointer-events:none",
    "z-index:9998",
    "box-sizing:border-box",
    "border:3px solid #3b82f6",
    "border-radius:8px",
  ].join(";");
  target.appendChild(overlay);

  const animation = overlay.animate(
    [
      {
        boxShadow:
          "0 0 0 2px rgba(59,130,246,0.45), 0 0 22px rgba(59,130,246,0.45)",
        borderColor: "#3b82f6",
      },
      {
        boxShadow:
          "0 0 0 3px rgba(96,165,250,0.55), 0 0 34px rgba(96,165,250,0.70)",
        borderColor: "#60a5fa",
      },
      {
        boxShadow:
          "0 0 0 2px rgba(59,130,246,0.45), 0 0 22px rgba(59,130,246,0.45)",
        borderColor: "#3b82f6",
      },
    ],
    { duration: 1400, iterations: Infinity, easing: "ease-in-out" },
  );

  window.setTimeout(() => {
    animation.cancel();
    overlay.remove();
  }, RG_HIGHLIGHT_TIMEOUT_MS);
};

// ── "Downloaded" corner marker (green triangle + check), shown on posts/rows
//    whose id is in processedPostIds. Styled via CSSOM (CSP-safe). ─────────────
const RG_DOWNLOADED_ATTR = "data-rg-downloaded";

const addDownloadedBadge = (el: HTMLElement) => {
  if (el.querySelector(`:scope > [${RG_DOWNLOADED_ATTR}]`)) return;
  if (getComputedStyle(el).position === "static") {
    el.style.position = "relative";
  }
  const wrap = document.createElement("div");
  wrap.setAttribute(RG_DOWNLOADED_ATTR, "");
  wrap.title = "Downloaded with RedditGrab";
  wrap.style.cssText = [
    "position:absolute",
    "top:0",
    "right:0",
    "width:24px",
    "height:24px",
    "z-index:9997",
    "pointer-events:none",
  ].join(";");

  const triangle = document.createElement("div");
  triangle.style.cssText = [
    "position:absolute",
    "top:0",
    "right:0",
    "width:0",
    "height:0",
    "border-style:solid",
    "border-width:0 24px 24px 0",
    "border-color:transparent #16a34a transparent transparent",
    "filter:drop-shadow(0 1px 1px rgba(0,0,0,0.35))",
  ].join(";");

  const check = document.createElement("span");
  check.textContent = "✓";
  check.style.cssText = [
    "position:absolute",
    "top:1px",
    "right:2px",
    "color:#fff",
    "font-size:12px",
    "font-weight:700",
    "line-height:14px",
  ].join(";");

  wrap.appendChild(triangle);
  wrap.appendChild(check);
  el.appendChild(wrap);
};

const removeDownloadedBadge = (el: HTMLElement) => {
  el.querySelector(`:scope > [${RG_DOWNLOADED_ATTR}]`)?.remove();
};

/** Add/remove the downloaded marker on every visible post/row to match storage. */
const refreshDownloadedMarkers = async () => {
  // Off by default; when disabled, strip any badges and bail.
  if (!(await showDownloadedMarkers.getValue())) {
    document
      .querySelectorAll(`[${RG_DOWNLOADED_ATTR}]`)
      .forEach((b) => b.remove());
    return;
  }

  const ids = new Set(await processedPostIds.getValue());
  const onSearch = isSearchResultsPage();
  const targets = onSearch
    ? getSearchResultRoots()
    : Array.from(document.querySelectorAll("shreddit-post"));

  for (const el of targets) {
    const target = el as HTMLElement;
    const id = onSearch ? getSearchThingId(target) : getPostIdentifier(target);
    const box = resolveBoxElement(target);
    const hasBadge = !!box.querySelector(`:scope > [${RG_DOWNLOADED_ATTR}]`);
    if (id && ids.has(id)) {
      if (!hasBadge) addDownloadedBadge(box);
    } else if (hasBadge) {
      removeDownloadedBadge(box);
    }
  }
};

// Thing-ids that resolved to no downloadable media (external hosts, text posts,
// failed fetches). Session-only, cleared on page reload. Prevents the mass
// downloader from re-fetching the same dead posts every scan cycle (which would
// pile up requests and invite rate limiting). Kept separate from
// processedPostIds so these never get a "downloaded" marker.
const unsupportedThingIds = new Set<string>();

const scanSearchPageMedia = async () => {
  const roots = getSearchResultRoots();

  const processedIds = await processedPostIds.getValue();
  const processedSet = new Set(processedIds);

  const useDateRangeFilter = await useDateRange.getValue();
  const startDate = useDateRangeFilter
    ? await dateRangeStart.getValue()
    : undefined;
  const endDate = useDateRangeFilter
    ? await dateRangeEnd.getValue()
    : undefined;

  let mediaCount = 0;

  const mediaUrls = compact(
    await Promise.all(
      roots.map(async (root) => {
        // Cheap, fetch-free checks first so we never re-fetch JSON/HLS for posts
        // already downloaded or filtered out (re-fetching invites rate limiting).
        const thingId = getSearchThingId(root);
        if (!thingId) return null;

        if (processedSet.has(thingId)) {
          logger.log(`Skipping already processed post: ${thingId}`);
          return null;
        }

        if (unsupportedThingIds.has(thingId)) {
          logger.log(`Skipping unsupported post (cached): ${thingId}`);
          return null;
        }

        if (!isPostInDateRange(root, startDate, endDate)) {
          logger.log(`Skipping post outside date range: ${thingId}`);
          return null;
        }

        const media = await extractSearchResultMedia(root);
        if (!media) {
          // No downloadable media this session: don't re-fetch it next cycle.
          unsupportedThingIds.add(thingId);
          return null;
        }

        // Tag the root so HIGHLIGHT_CURRENT_POST / MARK_POST_VISITED can find it.
        root.setAttribute("data-wxt-media-id", media.mediaPostId);

        mediaCount++;

        return {
          urls: media.urls,
          type: media.type,
          subredditName: media.subredditName,
          mediaPostId: media.mediaPostId,
          postTitle: media.postTitle,
          postAuthor: media.postAuthor ?? getPostAuthor(root),
          postDate: media.postDate ?? getPostDate(root),
        };
      }),
    ),
  );

  return {
    success: true,
    data: {
      totalPosts: mediaCount,
      mediaUrls,
    },
  };
};

const findVideoPlayer = (element: Element) => {
  let el: Element | null = null;
  for (const selector of Selectors.VIDEO_PLAYER) {
    el = element.querySelector(selector);
    if (el) break;
  }
  return el;
};

export default defineContentScript({
  matches: ["*://*.reddit.com/*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    const mountedUIs = new Set();

    const getMediaContainer = (
      element: Element,
    ): {
      type: MediaContentType;
      element: Element;
    } | null => {
      const hasVideo = findVideoPlayer(element);

      const hasSingleImage = element.querySelector(Selectors.SINGLE_IMAGE);
      const hasMultipleImages = element.querySelector(
        Selectors.GALLERY_CAROUSEL,
      );
      const hasRedGifs = element.querySelector(Selectors.REDGIFS_EMBED);

      if (hasVideo)
        return {
          type: "video",
          element: hasVideo,
        };
      if (hasSingleImage)
        return {
          type: "single-image",
          element: hasSingleImage,
        };
      if (hasMultipleImages) {
        return {
          type: "multiple-images",
          element: hasMultipleImages,
        };
      }
      if (hasRedGifs) {
        return {
          type: "video",
          element: hasRedGifs,
        };
      }

      return null;
    };

    const attachButtons = async () => {
      const elements = document.querySelectorAll("shreddit-post");

      await Promise.all(
        Array.from(elements).map(async (element) => {
          if (mountedUIs.has(element)) return;

          const mediaContainer = getMediaContainer(element);

          if (!mediaContainer) return;

          const ui = await createShadowRootUi(ctx, {
            name: "media-downloader-button",
            position: "inline",
            anchor: element,
            append: "last",
            onMount: (container) => {
              const style = document.createElement('style');
              style.textContent = `
                button { margin-top: 0 !important; }
                div { line-height: normal !important; }
                body { height: auto !important; }
              `;
              container.append(style);

              const app = document.createElement("div");
              container.className = cn(
                "ml-auto w-fit bg-transparent float-right",
              );
              container.append(app);
              const root = ReactDOM.createRoot(app);
              root.render(
                <DownloadButton
                  mediaContainer={mediaContainer.element}
                  mediaContentType={mediaContainer.type}
                />,
              );
              return root;
            },
            onRemove: (root) => {
              root?.unmount();
            },
          });

          ui.mount();
          mountedUIs.add(element);
        }),
      );

      logger.log(`Attached buttons to ${elements.length} elements`);
    };

    await attachButtons();
    await refreshDownloadedMarkers();

    // Re-apply downloaded markers live as downloads complete (mass or single)
    // and when the show/hide setting is toggled.
    processedPostIds.watch(() => {
      refreshDownloadedMarkers();
    });
    showDownloadedMarkers.watch(() => {
      refreshDownloadedMarkers();
    });

    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(async () => {
        logger.log("Scroll detected, reattaching buttons...");
        await attachButtons();
        await refreshDownloadedMarkers();
      }, 150);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    onMessage("GET_CURRENT_POST_ID", async () => {
      const posts = Array.from(document.querySelectorAll("shreddit-post"));
      const viewportCenterY = window.innerHeight / 2;

      for (const post of posts) {
        setPostIdentifier(post);
      }

      // Find the post that contains the vertical center of the viewport
      for (const post of posts) {
        const rect = post.getBoundingClientRect();
        if (rect.top <= viewportCenterY && rect.bottom >= viewportCenterY) {
          return { success: true, postId: getPostIdentifier(post) };
        }
      }

      // Fallback: first post that intersects viewport (smallest top >= 0)
      let best: { post: Element; top: number } | null = null;
      for (const post of posts) {
        const rect = post.getBoundingClientRect();
        if (rect.bottom >= 0 && rect.top <= window.innerHeight) {
          if (!best || rect.top < best.top) best = { post, top: rect.top };
        }
      }
      if (best) {
        return { success: true, postId: getPostIdentifier(best.post) };
      }

      return { success: false };
    });

    onMessage("MARK_POST_VISITED", async ({ data }) => {
      const { mediaPostId } = data;
      const post = document.querySelector(
        `[data-wxt-media-id="${mediaPostId}"]`,
      );
      if (post) {
        markPostAsVisited(post);
        return { success: true };
      }
      return { success: false };
    });

    onMessage("SCAN_PAGE_MEDIA", async ({ data }) => {
      if (isSearchResultsPage()) {
        return scanSearchPageMedia();
      }

      const { scrollUp = false, anchorPostId } = data ?? {};

      let postsArray = Array.from(document.querySelectorAll("shreddit-post"));

      // When scroll up with anchor: only consider the anchor post and posts above it (lower index = above)
      if (scrollUp && anchorPostId) {
        let anchorIndex = -1;
        for (let i = 0; i < postsArray.length; i++) {
          setPostIdentifier(postsArray[i]);
          if (getPostIdentifier(postsArray[i]) === anchorPostId) {
            anchorIndex = i;
            break;
          }
        }
        if (anchorIndex >= 0) {
          postsArray = postsArray.slice(0, anchorIndex + 1).toReversed();
          logger.log(
            `Scroll up: limiting to current and above, downloading bottom-to-top (anchor index ${anchorIndex}, ${postsArray.length} posts)`,
          );
        } else {
          logger.warn(
            `Scroll up: anchor post ${anchorPostId} not found, scanning all posts`,
          );
        }
      }

      let mediaCount = 0;

      // Get already processed post IDs from storage
      const processedIds = await processedPostIds.getValue();
      const processedSet = new Set(processedIds);

      // Get date range settings
      const useDateRangeFilter = await useDateRange.getValue();
      const startDate = useDateRangeFilter
        ? await dateRangeStart.getValue()
        : undefined;
      const endDate = useDateRangeFilter
        ? await dateRangeEnd.getValue()
        : undefined;

      const mediaUrls = compact(
        await Promise.all(
          postsArray.map(async (post, index) => {
            const mediaContainer = getMediaContainer(post);

            if (mediaContainer) {
              const uniqueId = setPostIdentifier(post);

              // Skip if we've already processed this post
              if (processedSet.has(uniqueId)) {
                logger.log(`Skipping already processed post: ${uniqueId}`);
                return null;
              }

              // Check if post is within date range
              if (!isPostInDateRange(post, startDate, endDate)) {
                logger.log(`Skipping post outside date range: ${uniqueId}`);
                return null;
              }

              const subredditName = getSubredditNameFromContainer(
                mediaContainer.element.closest("shreddit-post") ||
                  mediaContainer.element,
              );

              mediaCount++;

              return {
                urls: await getDownloadUrlsFromContainer(
                  mediaContainer.element,
                  mediaContainer.type,
                ),
                type: mediaContainer.type,
                subredditName,
                mediaPostId: uniqueId,
                postTitle: getPostTitle(post),
                postAuthor: getPostAuthor(post),
                postDate: getPostDate(post),
              };
            }

            return null;
          }),
        ),
      );

      return {
        success: true,
        data: {
          totalPosts: mediaCount,
          mediaUrls,
        },
      };
    });

    onMessage("HIGHLIGHT_CURRENT_POST", async ({ data }) => {
      const { mediaPostId, subredditName, mediaType } = data;

      // Search result rows: the feed-style text indicator renders as broken
      // vertical text. Use a pulsing overlay border + smooth center-scroll to the
      // current row (scrollIntoView is correct for window-scrolled pages).
      if (isSearchResultsPage()) {
        const row = findSearchRowByThingId(mediaPostId);
        if (row) {
          row.scrollIntoView({ behavior: "smooth", block: "center" });
          highlightCard(row);
        }
        return { success: true };
      }

      const currentPost = document.querySelector(
        `[data-wxt-media-id="${mediaPostId}"]`,
      ) as HTMLElement;

      if (currentPost) {
        currentPost.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        // Add highlight styling
        const originalStyle = currentPost.style.cssText;
        currentPost.style.cssText += `
          border: 3px solid #3b82f6 !important;
          background-color: rgba(59, 130, 246, 0.1) !important;
          transition: all 0.3s ease !important;
        `;

        // Show a temporary indicator
        const indicator = document.createElement("div");
        indicator.style.cssText = `
          position: absolute;
          top: 10px;
          right: 10px;
          background: #3b82f6;
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: bold;
          z-index: 9999;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;
        indicator.textContent = `Downloading ${mediaType}...`;

        // Position the indicator relative to the post
        currentPost.style.position = "relative";
        currentPost.appendChild(indicator);

        // Remove highlighting and indicator after 2 seconds
        setTimeout(() => {
          currentPost.style.cssText = originalStyle;
          if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
          }
        }, 2000);
      }

      return { success: true };
    });

    // Handle scroll to load more posts
    onMessage("SCROLL_TO_LOAD_MORE", async ({ data }) => {
      const { scrollUp = false } = data ?? {};
      scrollToLoadMore(scrollUp);

      // Wait a bit for content to load
      await new Promise((resolve) => setTimeout(resolve, 2000));

      return { success: true };
    });
  },
});
