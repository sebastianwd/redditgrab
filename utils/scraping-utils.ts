import { MediaContentType } from "@/types";

export const getDownloadUrlsFromContainer = async (
  mediaContainer: Element,
  mediaContentType: MediaContentType
) => {
  let urls: string[] = [];

  // Check for RedGIFs first
  const redGifsUrl = getRedGifsUrl(mediaContainer);
  if (redGifsUrl) {
    urls = [redGifsUrl];
    return urls;
  }

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

export function getSubredditNameFromContainer(container: Element): string {
  try {
    // First try to find the subreddit name anchor tag within the container
    const subredditAnchor = container.querySelector(
      'a[data-testid="subreddit-name"]'
    );

    logger.log("subredditAnchor", subredditAnchor);
    if (subredditAnchor) {
      const span = subredditAnchor.querySelector(":scope > span");
      if (span && span.textContent) {
        const subredditName = span.textContent.trim();
        return subredditName.replace(/^r\//, "");
      }
    }

    // Fallback: extract subreddit from URL when we're on a subreddit page
    const currentUrl = window.location.href;
    const subredditMatch = currentUrl.match(/\/r\/([^\/]+)/);
    if (subredditMatch) {
      logger.log("Extracted subreddit from URL:", subredditMatch[1]);
      return subredditMatch[1];
    }

    logger.warn(
      "Could not determine subreddit name, falling back to 'unknown'"
    );
    return "unknown";
  } catch (error) {
    console.error("Failed to get subreddit name from container:", error);
    return "unknown";
  }
}
