import { Selectors } from "@/utils/constants";
import { logger } from "@/utils/logger";
import { MediaContentType } from "@/types";

export const getDownloadUrlsFromContainer = async (
  mediaContainer: Element,
  mediaContentType: MediaContentType
) => {
  let urls: string[] = [];

  switch (mediaContentType) {
    case "multiple-images":
      urls = await getGalleryImageUrls(mediaContainer);
      break;
    case "single-image":
      const imageUrl = await getSingleImageUrl(mediaContainer);
      if (imageUrl) {
        urls = [imageUrl];
      }
      break;
    case "video":
      const videoUrl = await getVideoUrl(mediaContainer);
      if (videoUrl) {
        urls = [videoUrl];
      }
      break;
  }

  return urls;
};

interface ScrapingState {
  isScraping: boolean;
  downloadedPosts: Set<string>;
  currentPostId: string | null;
  totalPosts: number;
  downloadedCount: number;
}

interface ScrapingMessage {
  type: "START_MASS_SCRAPE" | "STOP_MASS_SCRAPE" | "GET_SCRAPING_STATUS";
}

interface ScrapingResponse {
  success: boolean;
  message?: string;
  data?: {
    isScraping: boolean;
    downloadedCount: number;
    totalPosts: number;
    currentPostId: string | null;
  };
}

// Global state for mass scraping
const scrapingState: ScrapingState = {
  isScraping: false,
  downloadedPosts: new Set(),
  currentPostId: null,
  totalPosts: 0,
  downloadedCount: 0,
};

// Function to get unique post ID
function getPostId(element: Element): string {
  // Try to get post ID from various attributes
  const postId =
    element.getAttribute("data-post-id") ||
    element.getAttribute("id") ||
    element.querySelector("[data-post-id]")?.getAttribute("data-post-id") ||
    `post-${Date.now()}-${Math.random()}`;
  return postId;
}

// Function to highlight current post being downloaded
function highlightPost(postElement: Element, isDownloading: boolean) {
  const existingHighlight = postElement.querySelector(".mass-scrape-highlight");
  if (existingHighlight) {
    existingHighlight.remove();
  }

  if (isDownloading) {
    const highlight = document.createElement("div");
    highlight.className = "mass-scrape-highlight";
    highlight.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(59, 130, 246, 0.1);
      border: 2px solid #3b82f6;
      border-radius: 8px;
      pointer-events: none;
      z-index: 1000;
      animation: pulse 1s infinite;
    `;

    // Add pulse animation
    const style = document.createElement("style");
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 0.6; }
      }
    `;
    document.head.appendChild(style);

    (postElement as HTMLElement).style.position = "relative";
    postElement.appendChild(highlight);
  }
}

// Function to find and click download buttons
async function findAndClickDownloadButtons(): Promise<number> {
  const posts = document.querySelectorAll("shreddit-post");
  let clickedCount = 0;

  // Process posts in batches for better performance
  const batchSize = 5;
  const postArray = Array.from(posts);

  for (let i = 0; i < postArray.length; i += batchSize) {
    const batch = postArray.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (post) => {
        const postId = getPostId(post);

        // Skip if already downloaded
        if (scrapingState.downloadedPosts.has(postId)) {
          return;
        }

        // Check if post has media
        const hasMedia =
          post.querySelector(Selectors.VIDEO_PLAYER) ||
          post.querySelector(Selectors.SINGLE_IMAGE) ||
          post.querySelector(Selectors.GALLERY_CAROUSEL);

        if (!hasMedia) {
          return;
        }

        // Find download button in shadow root
        const shadowRoot = post.querySelector(
          "media-downloader-button"
        )?.shadowRoot;
        if (!shadowRoot) {
          return;
        }

        const downloadButton = shadowRoot.querySelector(
          "button[data-media-content-type]"
        );
        if (!downloadButton) {
          return;
        }

        // Highlight current post
        scrapingState.currentPostId = postId;
        highlightPost(post, true);

        // Click the download button
        try {
          (downloadButton as HTMLElement).click();
          clickedCount++;

          // Mark as downloaded
          scrapingState.downloadedPosts.add(postId);
          scrapingState.downloadedCount++;

          // Remove highlight after a short delay
          setTimeout(() => highlightPost(post, false), 500);

          logger.log(
            `Downloaded post ${postId} (${scrapingState.downloadedCount}/${scrapingState.totalPosts})`
          );
        } catch (error) {
          logger.error(`Failed to download post ${postId}:`, error);
          highlightPost(post, false);
        }
      })
    );

    // Small delay between batches
    if (i + batchSize < postArray.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return clickedCount;
}

// Function to scroll down slowly
async function scrollDown(): Promise<boolean> {
  const currentHeight = window.scrollY;
  const windowHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;

  // If we're at the bottom, try to load more content
  if (currentHeight + windowHeight >= documentHeight - 100) {
    // Try to trigger infinite scroll
    window.scrollTo(0, documentHeight);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check if new content loaded
    const newHeight = document.documentElement.scrollHeight;
    if (newHeight <= documentHeight) {
      logger.log("No more content to load");
      return false; // No more content
    }
  } else {
    // Scroll down by 80% of window height
    window.scrollBy(0, windowHeight * 0.8);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return true; // More content available
}

// Main mass scraping function
export async function startMassScraping() {
  if (scrapingState.isScraping) {
    logger.log("Mass scraping already in progress");
    return;
  }

  scrapingState.isScraping = true;
  scrapingState.downloadedPosts.clear();
  scrapingState.currentPostId = null;
  scrapingState.downloadedCount = 0;

  // Count total posts with media
  const posts = document.querySelectorAll("shreddit-post");
  scrapingState.totalPosts = Array.from(posts).filter((post) => {
    return (
      post.querySelector(Selectors.VIDEO_PLAYER) ||
      post.querySelector(Selectors.SINGLE_IMAGE) ||
      post.querySelector(Selectors.GALLERY_CAROUSEL)
    );
  }).length;

  logger.log(
    `Starting mass scraping. Found ${scrapingState.totalPosts} posts with media`
  );

  try {
    while (scrapingState.isScraping) {
      // Find and click download buttons
      const clickedCount = await findAndClickDownloadButtons();

      if (clickedCount === 0) {
        // No new posts to download, try scrolling
        const hasMoreContent = await scrollDown();
        if (!hasMoreContent) {
          logger.log("No more content to scrape");
          break;
        }
      }

      // Small delay between iterations
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch (error) {
    logger.error("Mass scraping error:", error);
  } finally {
    scrapingState.isScraping = false;
    logger.log(
      `Mass scraping completed. Downloaded ${scrapingState.downloadedCount} posts`
    );
  }
}

// Function to stop mass scraping
function stopMassScraping() {
  scrapingState.isScraping = false;
  logger.log("Mass scraping stopped by user");
}

export default defineContentScript({
  matches: ["*://*.reddit.com/*"],
  async main(ctx) {
    logger.log("Mass scrape content script loaded");

    // Set up message listener with proper cleanup
    const messageListener = (
      message: ScrapingMessage,
      sender: any,
      sendResponse: (response: ScrapingResponse) => void
    ) => {
      if (message.type === "START_MASS_SCRAPE") {
        startMassScraping();
        sendResponse({ success: true, message: "Mass scraping started" });
      } else if (message.type === "STOP_MASS_SCRAPE") {
        stopMassScraping();
        sendResponse({ success: true, message: "Mass scraping stopped" });
      } else if (message.type === "GET_SCRAPING_STATUS") {
        sendResponse({
          success: true,
          data: {
            isScraping: scrapingState.isScraping,
            downloadedCount: scrapingState.downloadedCount,
            totalPosts: scrapingState.totalPosts,
            currentPostId: scrapingState.currentPostId,
          },
        });
      }
      return true; // Keep message channel open for async response
    };

    // Add message listener
    browser.runtime.onMessage.addListener(messageListener);

    // Clean up when content script is invalidated
    ctx.onInvalidated(() => {
      browser.runtime.onMessage.removeListener(messageListener);
      logger.log(
        "Mass scrape content script invalidated, cleaned up listeners"
      );
    });
  },
});
