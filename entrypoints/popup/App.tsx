import { useState, useEffect } from "react";
import {
  folderDestination as folderDestinationStorage,
  filenamePattern as filenamePatternStorage,
} from "@/utils/storage";
import { debounce } from "es-toolkit";
import { sendMessage } from "webext-bridge/popup";
import { useScrapingProgress } from "@/entrypoints/popup/use-scraping-progress";

const debouncedSaveFolder = debounce(async (value: string) => {
  console.log("saving folder destination to", value);
  await folderDestinationStorage.setValue(value);
}, 500);

const debouncedSaveFilename = debounce(async (value: string) => {
  console.log("saving filename pattern to", value);
  await filenamePatternStorage.setValue(value);
}, 500);

function App() {
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
    setCurrentPostInfo,
  } = useScrapingProgress();

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

      console.log("Starting mass scraping");

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

      // Process downloads similar to download-button.tsx
      for (let i = 0; i < mediaUrls.length; i++) {
        const mediaItem = mediaUrls[i];

        try {
          // Calculate folder destination with subreddit substitution
          const finalFolderDestination = folderDestination?.includes(
            "{subreddit}"
          )
            ? folderDestination.replace(/{subreddit}/g, mediaItem.subredditName)
            : folderDestination || "Reddit Downloads";

          console.log(
            `Downloading ${i + 1}/${mediaUrls.length}: ${mediaItem.type} with ${
              mediaItem.urls.length
            } URLs`
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
                postIndex: i,
                subredditName: mediaItem.subredditName,
                mediaType: mediaItem.type,
              },
              `content-script@${tab.id}`
            );
          } catch (error) {
            console.warn("Failed to highlight post:", error);
          }

          // Send download request to background script
          const downloadResponse = await browser.runtime.sendMessage({
            type: "DOWNLOAD_REQUEST",
            data: {
              timestamp: Date.now(),
              mediaContentType: mediaItem.type,
              urls: mediaItem.urls,
              folderDestination: finalFolderDestination,
              subredditName: mediaItem.subredditName,
            },
          });

          if (downloadResponse?.success) {
            console.log(`Download ${i + 1} started successfully`);
            incrementDownloadCount();
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

      console.log("All downloads initiated!");
      setCurrentPostInfo(null);
      stopScraping();
    } catch (error) {
      console.error("Failed to start mass scraping:", error);
      stopScraping();
    }
  };

  const handleStopScraping = async () => {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id) {
        await browser.tabs.sendMessage(tab.id, {
          type: "STOP_MASS_SCRAPE",
        });
      }
      stopScraping();
    } catch (error) {
      console.error("Failed to stop mass scraping:", error);
    }
  };

  return (
    <div className="w-96 p-6 bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg shadow-lg">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg
            width="24"
            height="24"
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
        <h1 className="text-2xl font-bold text-gray-800 mb-1">
          Reddit Downloader
        </h1>
      </div>

      {/* Settings Section */}
      <div className="space-y-6 mb-8">
        {/* Folder Destination */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Download Folder
          </label>
          <input
            type="text"
            value={folderDestination}
            onChange={(e) => handleFolderDestinationChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
            placeholder="Enter folder name (e.g., Reddit Downloads)"
          />
          <p className="text-xs text-gray-500 mt-1">
            Files will be saved to your Downloads folder with this subfolder
            name
            <br />
            Available variables: {"{subreddit}"}
          </p>
        </div>

        {/* Filename Pattern */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filename Pattern
          </label>
          <input
            type="text"
            value={filenamePattern}
            onChange={(e) => handleFilenamePatternChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
            placeholder="{subreddit}_{timestamp}_{filename}"
          />
          <p className="text-xs text-gray-500 mt-1">
            Available variables: {"{subreddit}"}, {"{timestamp}"},{" "}
            {"{filename}"}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {!scrapingStatus.isScraping ? (
          <button
            onClick={handleMassScrape}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-md hover:shadow-lg"
          >
            <svg
              width="20"
              height="20"
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
            className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-md hover:shadow-lg"
          >
            <svg
              width="20"
              height="20"
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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-blue-800">
                Progress: {scrapingStatus.downloadedCount}/
                {scrapingStatus.currentBatchCount}
              </span>
              <span className="text-xs text-blue-600">
                {scrapingStatus.currentBatchCount > 0
                  ? Math.round(
                      (scrapingStatus.downloadedCount /
                        scrapingStatus.currentBatchCount) *
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
                    scrapingStatus.currentBatchCount > 0
                      ? (scrapingStatus.downloadedCount /
                          scrapingStatus.currentBatchCount) *
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
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">
          {scrapingStatus.isScraping
            ? "Auto-scrolling and downloading media posts..."
            : "This will auto-scroll and download all media on the page"}
        </p>
      </div>
    </div>
  );
}

export default App;
