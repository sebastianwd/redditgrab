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

/** Append a post id to the processed list (no-op if already present). */
export const addProcessedPostId = async (id: string) => {
  const current = await processedPostIds.getValue();
  if (current.includes(id)) return;
  await processedPostIds.setValue([...current, id]);
};

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

export const showDownloadedMarkers = storage.defineItem(
  "local:showDownloadedMarkers",
  { fallback: false },
);

export const markDownloadedAsVisited = storage.defineItem(
  "local:markDownloadedAsVisited",
  { fallback: false },
);

// When on, mass download ignores the processed-post history and re-grabs posts
// that were already downloaded. Lets the user redownload a page without clearing
// their entire history.
export const forceDownloadProcessed = storage.defineItem(
  "local:forceDownloadProcessed",
  { fallback: false },
);

// Post archive: embed media as data URIs so the saved HTML is one file that
// works offline. Off means media is linked instead, which keeps the file small
// but makes it useless without a connection.
export const archiveInlineMedia = storage.defineItem(
  "local:archiveInlineMedia",
  { fallback: true },
);

// Video is inlined separately: a single Reddit video routinely outweighs the
// entire rest of the archive.
export const archiveInlineVideo = storage.defineItem(
  "local:archiveInlineVideo",
  { fallback: false },
);
