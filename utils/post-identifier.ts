/**
 * Get a stable, unique identifier for a Reddit post
 * @param post - The Reddit post element (shreddit-post)
 * @returns A stable identifier string
 */
import { getPostTitle, getPostAuthor } from "./post-utils";

/**
 * Stable, filesystem-agnostic hash of a string. Uses a plain numeric hash
 * instead of btoa, which throws on non-Latin1 characters (emoji / community
 * icons that show up in post titles), the exact case that previously broke
 * identification for those posts.
 */
const hashString = (input: string): string => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0;
  }
  // Unsigned, base36 for a short, stable token.
  return (hash >>> 0).toString(36);
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

  const contentHash = hashString(`${postTitle}-${postAuthor}`);
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
