import { useState } from "react";
import { MediaContentType } from "@/types";
import {
  folderDestination as folderDestinationStorage,
  useGalleryFolders as useGalleryFoldersStorage,
  addTitleToImages as addTitleToImagesStorage,
  addTitleToVideos as addTitleToVideosStorage,
  markDownloadedAsVisited as markDownloadedAsVisitedStorage,
  addProcessedPostId,
} from "@/utils/storage";
import { getPostIdentifier } from "@/utils/post-identifier";
import { markPostAsVisited } from "@/utils/mark-visited";
import { sendMessage } from "webext-bridge/content-script";
import { Button } from "@/components/ui/button";
import DownloadIcon from "@/components/icons/download-icon";
import { cn } from "@/utils/cn";
import { getPostTitle, processFolderDestination } from "@/utils/post-utils";

const DownloadButton = ({
  mediaContainer,
  mediaContentType,
}: {
  mediaContainer: Element;
  mediaContentType: MediaContentType;
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isDownloading) return; // Prevent multiple clicks

    setIsDownloading(true);

    try {
      const urls = await getDownloadUrlsFromContainer(
        mediaContainer,
        mediaContentType,
      );

      // Get the latest settings from storage
      const latestFolderConfig = await folderDestinationStorage.getValue();
      const useGalleryFolders = await useGalleryFoldersStorage.getValue();
      const addTitleToImages = await addTitleToImagesStorage.getValue();
      const addTitleToVideos = await addTitleToVideosStorage.getValue();

      // Process folder destination with variable substitution
      const postElement = mediaContainer.closest("shreddit-post");
      const subredditName = getSubredditNameFromContainer(
        postElement || mediaContainer,
      );
      // Get post title if needed
      const postTitle = postElement ? getPostTitle(postElement) : undefined;

      const finalFolderDestination = processFolderDestination(
        latestFolderConfig,
        postElement,
        subredditName,
        undefined,
        undefined,
        postTitle,
      );

      // Send message to background script to handle the download
      const downloadResponse = await sendMessage(
        "DOWNLOAD_REQUEST",
        {
          timestamp: Date.now(),
          mediaContentType,
          urls,
          folderDestination: finalFolderDestination,
          subredditName,
          useGalleryFolders,
          addTitleToImages,
          addTitleToVideos,
          postTitle,
        },
        "background",
      );

      if (downloadResponse?.success) {
        if (postElement) {
          // Record the download so it gets the "downloaded" marker and the mass
          // downloader won't re-grab it.
          await addProcessedPostId(getPostIdentifier(postElement));
        }
        if (
          (await markDownloadedAsVisitedStorage.getValue()) &&
          postElement
        ) {
          markPostAsVisited(postElement);
        }
      } else if (downloadResponse?.success === false) {
        console.error("Download request failed:", downloadResponse);
      }
    } catch (error) {
      console.error("Failed to send download request:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button
      onClick={handleDownload}
      data-media-content-type={mediaContentType}
      size="sm"
      variant="secondary"
      disabled={isDownloading}
      // Icon-only, so the label has to live in aria-label and title or the
      // button is a mystery to both screen readers and hovering users.
      aria-label={isDownloading ? "Downloading media" : "Download media"}
      title={isDownloading ? "Downloading..." : "Download media"}
      aria-busy={isDownloading}
      className="float-right mt-1 rounded-4xl relative cursor-pointer px-2 text-xs"
    >
      <DownloadIcon
        className={cn("size-4", isDownloading && "animate-pulse")}
      />
    </Button>
  );
};

export default DownloadButton;
