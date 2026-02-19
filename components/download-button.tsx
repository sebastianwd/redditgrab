import { useState } from "react";
import { MediaContentType } from "@/types";
import {
  folderDestination as folderDestinationStorage,
  useGalleryFolders as useGalleryFoldersStorage,
  addTitleToImages as addTitleToImagesStorage,
  addTitleToVideos as addTitleToVideosStorage,
} from "@/utils/storage";
import { sendMessage } from "webext-bridge/content-script";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";
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
      const finalFolderDestination = processFolderDestination(
        latestFolderConfig,
        postElement,
        subredditName,
      );

      // Get post title if needed
      const postTitle = postElement ? getPostTitle(postElement) : undefined;

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
      className="float-right mt-1 rounded-4xl relative cursor-pointer text-xs"
    >
      {isDownloading ? <>Downloading...</> : "Download"}
    </Button>
  );
};

export default DownloadButton;
