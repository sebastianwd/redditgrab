import { storage } from "#imports";

export const folderDestination = storage.defineItem("local:folderDestination", {
  fallback: "Reddit Downloads/{subreddit}",
});

export const filenamePattern = storage.defineItem("local:filenamePattern", {
  fallback: "{subreddit}_{timestamp}_{filename}",
});

export const processedPostIds = storage.defineItem("local:processedPostIds", {
  fallback: [] as string[],
});
