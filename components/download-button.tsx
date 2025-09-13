import { MediaContentType } from "@/types";
import { getVideoUrl } from "@/utils/dowload-utils";

import { folderDestination as folderDestinationStorage } from "@/utils/storage";

const DownloadButton = ({
  mediaContainer,
  mediaContentType,
}: {
  mediaContainer: Element;
  mediaContentType: MediaContentType;
}) => {
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();

    const urls = await getDownloadUrlsFromContainer(
      mediaContainer,
      mediaContentType
    );

    try {
      // Get the latest folder configuration from storage
      const latestFolderConfig = await folderDestinationStorage.getValue();

      // Only include subreddit if the variable is present
      const finalFolderDestination = latestFolderConfig?.includes("{subreddit}")
        ? latestFolderConfig.replace(
            /{subreddit}/g,
            getSubredditNameFromContainer(
              mediaContainer.closest("shreddit-post") || mediaContainer
            )
          )
        : latestFolderConfig || "Reddit Downloads";

      // Get subreddit name for filename pattern
      const subredditName = getSubredditNameFromContainer(
        mediaContainer.closest("shreddit-post") || mediaContainer
      );

      // Send message to background script to handle the download
      const response = await browser.runtime.sendMessage({
        type: "DOWNLOAD_REQUEST",
        data: {
          timestamp: Date.now(),
          mediaContentType,
          urls,
          folderDestination: finalFolderDestination,
          subredditName,
        },
      });

      if (response?.success) {
        console.log("Download request sent successfully:", response);
      } else if (response?.success === false) {
        console.error("Download request failed:", response);
      }
    } catch (error) {
      console.error("Failed to send download request:", error);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      data-media-content-type={mediaContentType}
      className="bg-blue-600 text-white h-6 rounded-full text-xs px-4 hover:bg-blue-400 cursor-pointer float-right mt-1 relative"
    >
      Download
    </button>
  );
};

export default DownloadButton;
