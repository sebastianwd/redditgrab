/**
 * Get a stable, unique identifier for a Reddit post
 * @param post - The Reddit post element (shreddit-post)
 * @returns A stable identifier string
 */
import { getPostTitle, getPostAuthor } from "./post-utils";

// btoa throws on non-Latin1 input (emoji); btoa(input) keeps ids stable for
// everything that already worked, the UTF-8 path only handles the throw.
const toBase64 = (input: string): string => {
  try {
    return btoa(input);
  } catch {
    return btoa(String.fromCharCode(...new TextEncoder().encode(input)));
  }
};

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
  const postTitle = getPostTitle(post);
  const postAuthor = getPostAuthor(post);

  if (!postTitle && !postAuthor) {
    // Last resort: use a timestamp-based ID
    console.warn("Could not extract post title or author, using fallback ID");
    return `reddit-post-fallback-${Date.now()}`;
  }

  const contentHash = toBase64(`${postTitle}-${postAuthor}`).slice(0, 12);
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
