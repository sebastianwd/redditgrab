import { useState, useEffect, useRef } from "react";
import {
  folderDestination as folderDestinationStorage,
  filenamePattern as filenamePatternStorage,
} from "@/utils/storage";
import { debounce } from "es-toolkit";
import { sendMessage } from "webext-bridge/popup";
import { useScrapingProgress } from "./use-scraping-progress";
import { processedPostIds } from "@/utils/storage";

const debouncedSaveFolder = debounce(async (value: string) => {
  console.log("saving folder destination to", value);
  await folderDestinationStorage.setValue(value);
}, 500);

const debouncedSaveFilename = debounce(async (value: string) => {
  console.log("saving filename pattern to", value);
  await filenamePatternStorage.setValue(value);
}, 500);

function SidebarApp() {
  console.log("SidebarApp component rendering...");

  const [folderDestination, setFolderDestination] = useState(
    "Reddit Downloads/{subreddit}"
  );
  const [filenamePattern, setFilenamePattern] = useState(
    "{subreddit}_{timestamp}_{filename}"
  );

  useEffect(() => {
    filenamePatternStorage.getValue().then((value) => {
      if (value) {
        setFilenamePattern(value);
      }
    });
  }, []);

  useEffect(() => {
    folderDestinationStorage.getValue().then((value) => {
      if (value) {
        setFolderDestination(value);
      }
    });
  }, []);

  const {
    scrapingStatus,
    startScraping,
    stopScraping,
    setCurrentBatchCount,
    incrementDownloadCount,
    addToTotalPostsFound,
    setCurrentPostInfo,
  } = useScrapingProgress();

  // Ref to control continuous processing loop
  const shouldContinueProcessingRef = useRef(false);

  const handleFolderDestinationChange = (value: string) => {
    console.log("setting folder destination to", value);
    setFolderDestination(value);
    debouncedSaveFolder(value);
  };

  const handleFilenamePatternChange = (value: string) => {
    console.log("setting filename pattern to", value);
    setFilenamePattern(value);
    debouncedSaveFilename(value);
  };

  const handleMassScrape = async () => {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) {
        throw new Error("No active tab found");
      }

      startScraping();
      shouldContinueProcessingRef.current = true;

      console.log("Starting mass scraping from sidebar");

      const processPage = async () => {
        // Ask content script to scan for media using webext-bridge
        const response = await sendMessage(
          "SCAN_PAGE_MEDIA",
          undefined,
          `content-script@${tab.id}`
        );

        console.log(
          "Content script response:",
          JSON.stringify(response, null, 2)
        );

        if (!response.success || !response.data) {
          throw new Error("Failed to get media from page");
        }

        const { mediaUrls } = response.data;
        console.log(`Starting downloads for ${mediaUrls.length} media items`);

        // Update progress tracking
        setCurrentBatchCount(mediaUrls.length);
        addToTotalPostsFound(mediaUrls.length);

        // Process downloads similar to download-button.tsx
        for (let i = 0; i < mediaUrls.length; i++) {
          const mediaItem = mediaUrls[i];

          try {
            // Calculate folder destination with subreddit substitution
            const finalFolderDestination = folderDestination?.includes(
              "{subreddit}"
            )
              ? folderDestination.replace(
                  /{subreddit}/g,
                  mediaItem.subredditName
                )
              : folderDestination || "Reddit Downloads";

            console.log(
              `Downloading ${i + 1}/${mediaUrls.length}: ${
                mediaItem.type
              } with ${mediaItem.urls.length} URLs`
            );

            // Update current post info and highlight
            setCurrentPostInfo({
              index: i + 1,
              type: mediaItem.type,
              subreddit: mediaItem.subredditName,
            });

            try {
              await sendMessage(
                "HIGHLIGHT_CURRENT_POST",
                {
                  mediaPostId: mediaItem.mediaPostId,
                  subredditName: mediaItem.subredditName,
                  mediaType: mediaItem.type,
                },
                `content-script@${tab.id}`
              );
            } catch (error) {
              console.warn("Failed to highlight post:", error);
            }

            // Send download request to background script
            const downloadResponse = await sendMessage(
              "DOWNLOAD_REQUEST",
              {
                timestamp: Date.now(),
                mediaContentType: mediaItem.type,
                urls: mediaItem.urls,
                folderDestination: finalFolderDestination,
                subredditName: mediaItem.subredditName,
              },
              "background"
            );

            if (downloadResponse?.success) {
              console.log(`Download ${i + 1} started successfully`);
              incrementDownloadCount();

              // Mark this post as processed in storage
              const currentProcessedIds = await processedPostIds.getValue();
              if (!currentProcessedIds.includes(mediaItem.mediaPostId)) {
                await processedPostIds.setValue([
                  ...currentProcessedIds,
                  mediaItem.mediaPostId,
                ]);
              }
            } else {
              console.error(`Download ${i + 1} failed:`, downloadResponse);
            }

            // Small delay between downloads to avoid overwhelming the system
            if (i < mediaUrls.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          } catch (error) {
            console.error(`Failed to download item ${i + 1}:`, error);
          }
        }

        const newPostsFound = mediaUrls.length > 0;
        console.log(
          `Batch complete! Downloaded ${mediaUrls.length} new posts.`
        );
        console.log(
          "shouldContinueProcessingRef.current:",
          shouldContinueProcessingRef.current
        );
        setCurrentPostInfo(null);

        // Continue processing if scraping is still active
        if (shouldContinueProcessingRef.current) {
          if (newPostsFound) {
            // Found new posts, check again soon for more
            console.log(
              "Found new posts, scheduling next check in 2 seconds..."
            );
            setTimeout(() => {
              if (shouldContinueProcessingRef.current) {
                console.log("Checking for more new posts...");
                processPage();
              }
            }, 2000);
          } else {
            console.log("No new posts found, scrolling to load more...");
            await sendMessage(
              "SCROLL_TO_LOAD_MORE",
              undefined,
              `content-script@${tab.id}`
            );
            console.log(
              "Scrolled to load more posts, checking again in 3 seconds..."
            );
            setTimeout(() => {
              if (shouldContinueProcessingRef.current) {
                processPage();
              }
            }, 3000);
          }
        } else {
          console.log("Processing stopped by user");
          stopScraping();
        }
      };

      processPage();
    } catch (error) {
      console.error("Failed to start mass scraping:", error);
      shouldContinueProcessingRef.current = false;
      stopScraping();
    }
  };

  const handleStopScraping = async () => {
    try {
      shouldContinueProcessingRef.current = false;
      setCurrentPostInfo(null);
      stopScraping();
      console.log("Mass scraping stopped");
    } catch (error) {
      console.error("Failed to stop mass scraping:", error);
    }
  };

  const handleClearProcessedPosts = async () => {
    try {
      await processedPostIds.setValue([]);
      console.log("Cleared processed posts history");
    } catch (error) {
      console.error("Failed to clear processed posts:", error);
    }
  };

  return (
    <div
      className="w-full h-full min-h-screen p-4 bg-gradient-to-br from-gray-50 to-white"
      style={{ minWidth: "300px" }}
    >
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-2">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-white"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7,10 12,15 17,10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-gray-800 mb-1">
          Reddit Downloader
        </h1>
        <p className="text-xs text-gray-500">
          Mass download images and videos from Reddit
        </p>
      </div>

      {/* Settings Section */}
      <div className="space-y-4 mb-6">
        {/* Folder Destination */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Download Folder
          </label>
          <input
            type="text"
            value={folderDestination}
            onChange={(e) => handleFolderDestinationChange(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
            placeholder="Enter folder name"
          />
          <p className="text-xs text-gray-500 mt-1">
            Available variables: {"{subreddit}"}
          </p>
        </div>

        {/* Filename Pattern */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filename Pattern
          </label>
          <input
            type="text"
            value={filenamePattern}
            onChange={(e) => handleFilenamePatternChange(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
            placeholder="{subreddit}_{timestamp}_{filename}"
          />
          <p className="text-xs text-gray-500 mt-1">
            Available: {"{subreddit}"}, {"{timestamp}"}, {"{filename}"}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {!scrapingStatus.isScraping ? (
          <button
            onClick={handleMassScrape}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-2.5 px-4 rounded transition-all duration-200 flex items-center justify-center gap-2 text-sm shadow-md hover:shadow-lg"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7,10 12,15 17,10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Start Mass Download
          </button>
        ) : (
          <button
            onClick={handleStopScraping}
            className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-2.5 px-4 rounded transition-all duration-200 flex items-center justify-center gap-2 text-sm shadow-md hover:shadow-lg"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="6" y="6" width="12" height="12" />
            </svg>
            Stop Scraping
          </button>
        )}

        {/* Progress Display */}
        {scrapingStatus.isScraping && (
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-blue-800">
                Progress: {scrapingStatus.downloadedCount}/
                {scrapingStatus.totalPostsFound}
              </span>
              <span className="text-xs text-blue-600">
                {scrapingStatus.totalPostsFound > 0
                  ? Math.round(
                      (scrapingStatus.downloadedCount /
                        scrapingStatus.totalPostsFound) *
                        100
                    )
                  : 0}
                %
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    scrapingStatus.totalPostsFound > 0
                      ? (scrapingStatus.downloadedCount /
                          scrapingStatus.totalPostsFound) *
                        100
                      : 0
                  }%`,
                }}
              />
            </div>
            {scrapingStatus.currentPostInfo && (
              <p className="text-xs text-blue-600 mt-2">
                Currently downloading: Post{" "}
                {scrapingStatus.currentPostInfo.index} -{" "}
                {scrapingStatus.currentPostInfo.type} from r/
                {scrapingStatus.currentPostInfo.subreddit}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Status Info */}
      <div className="mt-6 text-center">
        <p className="text-xs text-gray-500 mb-2">
          {scrapingStatus.isScraping
            ? "Auto-scrolling and downloading media posts..."
            : "This will auto-scroll and download all media on the page"}
        </p>

        {/* Clear Processed Posts Button */}
        {!scrapingStatus.isScraping && (
          <button
            onClick={handleClearProcessedPosts}
            className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
          >
            Clear processed posts history
          </button>
        )}
      </div>
    </div>
  );
}

export default SidebarApp;
