/**
 * Get a stable, unique identifier for a Reddit post
 * @param post - The Reddit post element (shreddit-post)
 * @returns A stable identifier string
 */
export const getPostIdentifier = (post: Element): string => {
  // Check if post already has our custom ID
  const existingId = post.getAttribute("data-wxt-media-id");
  if (existingId) {
    return existingId;
  }

  // Try to get Reddit's native post ID (primary method)
  const redditPostId = post.getAttribute("id");
  if (redditPostId) {
    return redditPostId; // e.g., "t3_1n2o8dd"
  }

  // Fallback: create hash from post content (very rare case)
  const postTitle =
    post.querySelector('a[slot="title"]')?.textContent ||
    post.querySelector('[id^="post-title-"]')?.textContent ||
    "";
  const postAuthor = post.querySelector('a[href*="/user/"]')?.textContent || "";

  if (!postTitle && !postAuthor) {
    // Last resort: use a timestamp-based ID
    console.warn("Could not extract post title or author, using fallback ID");
    return `reddit-post-fallback-${Date.now()}`;
  }

  const contentHash = btoa(`${postTitle}-${postAuthor}`).slice(0, 12);
  return `reddit-post-${contentHash}`;
};

/**
 * Set a stable identifier on a Reddit post element
 * @param post - The Reddit post element
 * @returns The identifier that was set
 */
export const setPostIdentifier = (post: Element): string => {
  const identifier = getPostIdentifier(post);
  post.setAttribute("data-wxt-media-id", identifier);
  return identifier;
};
