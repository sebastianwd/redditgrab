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
} from "@/utils/storage";
import { compact } from "es-toolkit";
import { logger } from "@/utils/logger";
import { parseISO, isValid } from "date-fns";
import {
  getPostTitle,
  getPostAuthor,
  getPostDate,
  getPostDatetime,
} from "@/utils/post-utils";

const scrollToLoadMore = () => {
  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth",
  });
  logger.log("Scrolled to bottom to load more posts");
};

const isPostInDateRange = (
  post: Element,
  startTimestamp?: string,
  endTimestamp?: string
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
        `Invalid start timestamp: ${startTimestamp}, including in range`
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

export default defineContentScript({
  matches: ["*://*.reddit.com/*"],
  cssInjectionMode: "ui",
  async main(ctx) {
    const mountedUIs = new Set();

    const getMediaContainer = (
      element: Element
    ): {
      type: MediaContentType;
      element: Element;
    } | null => {
      const hasVideo = element.querySelector(Selectors.VIDEO_PLAYER);
      const hasSingleImage = element.querySelector(Selectors.SINGLE_IMAGE);
      const hasMultipleImages = element.querySelector(
        Selectors.GALLERY_CAROUSEL
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
              const app = document.createElement("div");
              container.className = cn(
                "ml-auto w-fit bg-transparent float-right"
              );
              container.append(app);
              const root = ReactDOM.createRoot(app);
              root.render(
                <DownloadButton
                  mediaContainer={mediaContainer.element}
                  mediaContentType={mediaContainer.type}
                />
              );
              return root;
            },
            onRemove: (root) => {
              root?.unmount();
            },
          });

          ui.mount();
          mountedUIs.add(element);
        })
      );

      logger.log(`Attached buttons to ${elements.length} elements`);
    };

    await attachButtons();

    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(async () => {
        logger.log("Scroll detected, reattaching buttons...");
        await attachButtons();
      }, 150);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    onMessage("SCAN_PAGE_MEDIA", async () => {
      const posts = document.querySelectorAll("shreddit-post");
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
          Array.from(posts).map(async (post, index) => {
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
                  mediaContainer.element
              );

              mediaCount++;
              console.log(
                "sdfsdf",
                getPostTitle(post),
                getPostAuthor(post),
                getPostDate(post)
              );
              return {
                urls: await getDownloadUrlsFromContainer(
                  mediaContainer.element,
                  mediaContainer.type
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
          })
        )
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

      const currentPost = document.querySelector(
        `[data-wxt-media-id="${mediaPostId}"]`
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
    onMessage("SCROLL_TO_LOAD_MORE", async () => {
      scrollToLoadMore();

      // Wait a bit for content to load
      await new Promise((resolve) => setTimeout(resolve, 2000));

      return { success: true };
    });
  },
});
