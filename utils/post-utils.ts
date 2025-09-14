/**
 * Utility functions for extracting Reddit post information
 */

/**
 * Extract the post title from a Reddit post element
 * @param post - The Reddit post element (shreddit-post)
 * @returns The post title or empty string if not found
 */
export const getPostTitle = (post: Element): string => {
  const titleSelectors = [
    'a[slot="title"]', // Most common and reliable selector
    '[id^="post-title-"]', // Backup for posts with ID-based titles
    'h3[slot="title"]', // Alternative slot-based selector
  ];

  for (const selector of titleSelectors) {
    const titleElement = post.querySelector(selector);
    if (titleElement?.textContent?.trim()) {
      return titleElement.textContent.trim();
    }
  }

  return "";
};
