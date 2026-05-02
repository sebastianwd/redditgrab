/**
 * Utility functions for extracting Reddit post information
 */

import { format, parseISO, isValid } from "date-fns";
import { getSubredditNameFromContainer } from "./scraping-utils";
import { sanitizeForFilename } from "./filename-utils";

/**
 * Extract the post title from a Reddit post element
 * @param post - The Reddit post element (shreddit-post)
 * @returns The post title or empty string if not found
 */
export const getPostTitle = (post: Element): string => {
  const titleSelectors = [
    'a[slot="title"]', // Most common and reliable selector
    '[id^="post-title-"]', // Backup for posts with ID-based titles
  ];

  for (const selector of titleSelectors) {
    const titleElement = post.querySelector(selector);
    if (titleElement?.textContent?.trim()) {
      return titleElement.textContent.trim();
    }
  }

  return "";
};

/**
 * Extract the post author/username from a Reddit post element
 * @param post - The Reddit post element (shreddit-post)
 * @returns The post author username or empty string if not found
 */
export const getPostAuthor = (post: Element): string => {
  // Use the same selector as post-identifier.ts for consistency
  const authorElement = post.querySelector('a[href*="/user/"]');
  const authorText = authorElement?.textContent?.trim() || "u/unknown-user";

  // Remove "u/" prefix if present
  return authorText.startsWith("u/") ? authorText.slice(2) : authorText;
};

/**
 * Extract the post date from a Reddit post element
 * @param post - The Reddit post element (shreddit-post)
 * @returns The post date in YYYY-MM-DD format or empty string if not found
 */
export const getPostDate = (post: Element): string => {
  const datetime = getPostDatetime(post);
  if (!datetime) {
    return "";
  }

  // Parse the ISO date using date-fns
  const date = parseISO(datetime);
  if (!isValid(date)) {
    return "";
  }
  return format(date, "yyyy-MM-dd");
};

/**
 * Extract the raw datetime attribute from a Reddit post element
 * @param post - The Reddit post element (shreddit-post)
 * @returns The raw datetime string or empty string if not found
 */
export const getPostDatetime = (post: Element): string => {
  const timeElement = post.querySelector("time[datetime]");
  if (!timeElement) {
    return "";
  }

  const datetime = timeElement.getAttribute("datetime");
  return datetime || "";
};

/**
 * Process folder destination with variable substitution
 * @param folderDestination - The folder destination pattern
 * @param postElement - The Reddit post element
 * @param subredditName - The subreddit name (if not available from post)
 * @param postDate - The post date (if not available from post element)
 * @param postAuthor - The post author (if not available from post element)
 * @returns The processed folder destination with variables replaced
 */
export const processFolderDestination = (
  folderDestination: string,
  postElement: Element | null,
  subredditName?: string,
  postDate?: string,
  postAuthor?: string,
  postTitle?: string
): string => {
  let finalDestination = folderDestination || "Reddit Downloads";

  // Replace {subreddit} variable
  if (finalDestination.includes("{subreddit}")) {
    const subreddit =
      subredditName ||
      (postElement
        ? getSubredditNameFromContainer(postElement)
        : "unknown-subreddit");
    finalDestination = finalDestination.replace(/{subreddit}/g, subreddit);
  }

  // Replace {date} variable
  if (finalDestination.includes("{date}")) {
    const date =
      postDate || (postElement ? getPostDate(postElement) : "unknown-date");
    finalDestination = finalDestination.replace(/{date}/g, date);
  }

  // Replace {user} variable
  if (finalDestination.includes("{user}")) {
    const author =
      postAuthor || (postElement ? getPostAuthor(postElement) : "unknown-user");
    finalDestination = finalDestination.replace(/{user}/g, author);
  }

  // Replace {title} variable
  if (finalDestination.includes("{title}")) {
    const rawTitle =
      postTitle || (postElement ? getPostTitle(postElement) : "");
    const safeTitle = sanitizeForFilename(rawTitle) || "untitled";
    finalDestination = finalDestination.replace(/{title}/g, safeTitle);
  }

  return finalDestination;
};
