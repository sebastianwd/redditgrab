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

export const useGalleryFolders = storage.defineItem("local:useGalleryFolders", {
  fallback: false,
});

export const addTitleToImages = storage.defineItem("local:addTitleToImages", {
  fallback: false,
});

export const addTitleToVideos = storage.defineItem("local:addTitleToVideos", {
  fallback: false,
});

export const useDateRange = storage.defineItem("local:useDateRange", {
  fallback: false,
});

export const dateRangeStart = storage.defineItem("local:dateRangeStart", {
  fallback: "",
});

export const dateRangeEnd = storage.defineItem("local:dateRangeEnd", {
  fallback: "",
});

export const darkMode = storage.defineItem("local:darkMode", {
  fallback: false,
});
