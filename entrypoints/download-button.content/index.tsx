import "~/assets/tailwind.css";
import ReactDOM from "react-dom/client";
import type { MediaContentType } from "~/types";
import DownloadButton from "@/components/download-button";
import { onMessage } from "webext-bridge/content-script";
import { Selectors } from "@/utils/constants";
import { processedPostIds } from "@/utils/storage";
import { compact } from "es-toolkit";
import { logger } from "@/utils/logger";

const scrollToLoadMore = () => {
  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth",
  });
  logger.log("Scrolled to bottom to load more posts");
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

              const subredditName = getSubredditNameFromContainer(
                mediaContainer.element.closest("shreddit-post") ||
                  mediaContainer.element
              );

              mediaCount++;
              return {
                urls: await getDownloadUrlsFromContainer(
                  mediaContainer.element,
                  mediaContainer.type
                ),
                type: mediaContainer.type,
                subredditName,
                mediaPostId: uniqueId,
                postTitle: getPostTitle(post),
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
