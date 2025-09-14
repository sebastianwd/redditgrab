import { useState, useEffect, useRef } from "react";
import {
  folderDestination as folderDestinationStorage,
  filenamePattern as filenamePatternStorage,
  useGalleryFolders as useGalleryFoldersStorage,
  addTitleToImages as addTitleToImagesStorage,
  addTitleToVideos as addTitleToVideosStorage,
} from "@/utils/storage";
import { debounce } from "es-toolkit";
import { sendMessage } from "webext-bridge/popup";
import { useScrapingProgress } from "./use-scraping-progress";
import { processedPostIds } from "@/utils/storage";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Icon } from "@iconify/react";

const debouncedSaveFolder = debounce(async (value: string) => {
  console.log("saving folder destination to", value);
  await folderDestinationStorage.setValue(value);
}, 500);

const debouncedSaveFilename = debounce(async (value: string) => {
  console.log("saving filename pattern to", value);
  await filenamePatternStorage.setValue(value);
}, 500);

const debouncedSaveGalleryFolders = debounce(async (value: boolean) => {
  console.log("saving gallery folders setting to", value);
  await useGalleryFoldersStorage.setValue(value);
}, 500);

const debouncedSaveTitleToImages = debounce(async (value: boolean) => {
  console.log("saving title to images setting to", value);
  await addTitleToImagesStorage.setValue(value);
}, 500);

const debouncedSaveTitleToVideos = debounce(async (value: boolean) => {
  console.log("saving title to videos setting to", value);
  await addTitleToVideosStorage.setValue(value);
}, 500);

function SidebarApp() {
  console.log("SidebarApp component rendering...");

  const [folderDestination, setFolderDestination] = useState(
    "Reddit Downloads/{subreddit}"
  );
  const [filenamePattern, setFilenamePattern] = useState(
    "{subreddit}_{timestamp}_{filename}"
  );
  const [useGalleryFolders, setUseGalleryFolders] = useState(false);
  const [addTitleToImages, setAddTitleToImages] = useState(false);
  const [addTitleToVideos, setAddTitleToVideos] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [isRedditPage, setIsRedditPage] = useState(false);

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

  useEffect(() => {
    useGalleryFoldersStorage.getValue().then((value) => {
      setUseGalleryFolders(value);
    });
  }, []);

  useEffect(() => {
    addTitleToImagesStorage.getValue().then((value) => {
      setAddTitleToImages(value);
    });
  }, []);

  useEffect(() => {
    addTitleToVideosStorage.getValue().then((value) => {
      setAddTitleToVideos(value);
    });
  }, []);

  // Check if current tab is on Reddit
  useEffect(() => {
    const checkCurrentTab = async () => {
      try {
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (tab?.url) {
          setCurrentUrl(tab.url);
          const isReddit = tab.url.includes("reddit.com");
          setIsRedditPage(isReddit);
        }
      } catch (error) {
        console.error("Failed to get current tab:", error);
        setIsRedditPage(false);
      }
    };

    checkCurrentTab();

    const handleTabUpdate = (
      tabId: number,
      changeInfo: Browser.tabs.OnUpdatedInfo,
      tab: Browser.tabs.Tab
    ) => {
      if (changeInfo.url && tab.active) {
        setCurrentUrl(tab.url as string);
        const isReddit = tab.url?.includes("reddit.com");
        setIsRedditPage(isReddit ?? false);
      }
    };

    const handleTabActivated = async (
      activeInfo: Browser.tabs.OnActivatedInfo
    ) => {
      try {
        const tab = await browser.tabs.get(activeInfo.tabId);
        if (tab?.url) {
          setCurrentUrl(tab.url);
          const isReddit = tab.url.includes("reddit.com");
          setIsRedditPage(isReddit);
        }
      } catch (error) {
        console.error("Failed to get activated tab:", error);
      }
    };

    // Add listeners for tab updates and activation
    browser.tabs.onUpdated.addListener(handleTabUpdate);
    browser.tabs.onActivated.addListener(handleTabActivated);

    // Cleanup listeners on unmount
    return () => {
      browser.tabs.onUpdated.removeListener(handleTabUpdate);
      browser.tabs.onActivated.removeListener(handleTabActivated);
    };
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

  const handleGalleryFoldersChange = (checked: boolean) => {
    console.log("setting gallery folders to", checked);
    setUseGalleryFolders(checked);
    debouncedSaveGalleryFolders(checked);
  };

  const handleTitleToImagesChange = (checked: boolean) => {
    console.log("setting title to images to", checked);
    setAddTitleToImages(checked);
    debouncedSaveTitleToImages(checked);
  };

  const handleTitleToVideosChange = (checked: boolean) => {
    console.log("setting title to videos to", checked);
    setAddTitleToVideos(checked);
    debouncedSaveTitleToVideos(checked);
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

          if (!shouldContinueProcessingRef.current) {
            console.log("Processing stopped by user");
            break;
          }

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
                useGalleryFolders,
                addTitleToImages,
                addTitleToVideos,
                postTitle: mediaItem.postTitle,
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
      setIsClearingHistory(true);
      await processedPostIds.setValue([]);
      console.log("Cleared processed posts history");
      // Small delay to show the loading state
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error("Failed to clear processed posts:", error);
    } finally {
      setIsClearingHistory(false);
    }
  };

  // Show different content if not on Reddit
  if (!isRedditPage) {
    return (
      <div
        className="w-full h-full min-h-screen p-4 bg-gradient-to-br from-gray-50 to-white flex flex-col items-center justify-center"
        style={{ minWidth: "300px" }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon icon="lucide:alert-circle" className="text-white w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">RedditGrab</h1>
          <p className="text-sm text-gray-600 mb-4">
            This extension only works on Reddit.com
          </p>
        </div>

        {/* Current URL Display */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 w-full">
          <div className="flex items-start space-x-3">
            <Icon
              icon="lucide:info"
              className="text-yellow-600 w-5 h-5 mt-0.5 flex-shrink-0"
            />
            <div>
              <h3 className="text-sm font-medium text-yellow-800 mb-1">
                Current Page
              </h3>
              <p className="text-xs text-yellow-700 break-all">
                {currentUrl || "Unable to detect current page"}
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 w-full">
          <div className="flex items-start space-x-3">
            <Icon
              icon="lucide:lightbulb"
              className="text-blue-600 w-5 h-5 mt-0.5 flex-shrink-0"
            />
            <div>
              <h3 className="text-sm font-medium text-blue-800 mb-2">
                How to use:
              </h3>
              <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                <li>Navigate to any Reddit page (reddit.com)</li>
                <li>Open this sidebar panel</li>
                <li>Configure your download settings</li>
                <li>Click "Start Mass Download" to begin</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Reddit Link */}
        <div className="mt-6">
          <a
            href="https://reddit.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Icon icon="lucide:external-link" className="w-4 h-4" />
            <span className="text-sm font-medium">Go to Reddit</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full min-h-screen p-4 bg-gradient-to-br from-gray-50 to-white"
      style={{ minWidth: "300px" }}
    >
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-2">
          <Icon icon="lucide:download" className="text-white w-5 h-5" />
        </div>
        <h1 className="text-lg font-bold text-gray-800 mb-1">RedditGrab</h1>
        <p className="text-xs text-gray-500">
          Grab images and videos from Reddit posts
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

        {/* Gallery Folders */}
        <div className="flex items-center space-x-3">
          <Checkbox
            id="gallery-folders"
            checked={useGalleryFolders}
            onCheckedChange={handleGalleryFoldersChange}
          />
          <div className="grid gap-1.5 leading-none">
            <label
              htmlFor="gallery-folders"
              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Create folders for image galleries
            </label>
          </div>
        </div>

        {/* Add Title to Images */}
        <div className="flex items-center space-x-3">
          <Checkbox
            id="title-to-images"
            checked={addTitleToImages}
            onCheckedChange={handleTitleToImagesChange}
          />
          <div className="grid gap-1.5 leading-none">
            <label
              htmlFor="title-to-images"
              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Add post title to images
            </label>
          </div>
        </div>

        {/* Add Title to Videos */}
        <div className="flex items-center space-x-3">
          <Checkbox
            id="title-to-videos"
            checked={addTitleToVideos}
            onCheckedChange={handleTitleToVideosChange}
          />
          <div className="grid gap-1.5 leading-none">
            <label
              htmlFor="title-to-videos"
              className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Add post title to videos (slower processing)
            </label>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {!scrapingStatus.isScraping ? (
          <Button onClick={handleMassScrape} className="w-full">
            <Icon icon="lucide:download" className="w-4 h-4" />
            Start Mass Download
          </Button>
        ) : (
          <Button
            onClick={handleStopScraping}
            variant="destructive"
            className="w-full"
          >
            <Icon icon="lucide:square" className="w-4 h-4" />
            Stop Scraping
          </Button>
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
              <div className="flex items-center justify-center mt-2">
                <Icon
                  icon="lucide:loader-2"
                  className="animate-spin mr-2 size-3 text-blue-600"
                />
                <p className="text-xs text-blue-600">
                  Downloading post {scrapingStatus.currentPostInfo.index} -{" "}
                  {scrapingStatus.currentPostInfo.type} from r/
                  {scrapingStatus.currentPostInfo.subreddit}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Info */}
      <div className="mt-6 text-center">
        <p className="text-xs text-gray-500 mb-2">
          {scrapingStatus.isScraping
            ? "Auto-scrolling and downloading media posts..."
            : "This will scroll and download all media on the page"}
        </p>

        {/* Clear Processed Posts Button */}
        {!scrapingStatus.isScraping && (
          <Button
            onClick={handleClearProcessedPosts}
            variant="link"
            size="sm"
            disabled={isClearingHistory}
            className="text-xs"
          >
            {isClearingHistory ? (
              <>
                <Icon
                  icon="lucide:loader-2"
                  className="animate-spin -ml-1 mr-1 size-4"
                />
                Clearing...
              </>
            ) : (
              "Clear processed posts history"
            )}
          </Button>
        )}
      </div>

      {/* FAQ Section */}
      <div className="mt-8 border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
          <Icon icon="lucide:help-circle" className="w-4 h-4 mr-2" />
          Frequently Asked Questions
        </h3>

        <Accordion type="multiple" className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger className="text-xs font-medium text-gray-800 hover:no-underline">
              <div className="flex items-center space-x-2">
                <Icon
                  icon="lucide:download"
                  className="w-4 h-4 text-orange-500 flex-shrink-0"
                />
                <span>Can I download individual post media?</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                <p className="text-xs text-gray-600">
                  Yes! Look for the{" "}
                  <span className="font-medium text-orange-600">Download</span>{" "}
                  button that appears on each post. Click it to download just
                  that post's media.
                </p>

                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="text-center">
                    <img
                      src="/example-post.png"
                      alt="Example Reddit post showing Download button"
                      className="w-full max-w-sm mx-auto rounded-lg shadow-sm border border-gray-300"
                    />
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2">
            <AccordionTrigger className="text-xs font-medium text-gray-800 hover:no-underline">
              <div className="flex items-center space-x-2">
                <Icon
                  icon="lucide:settings"
                  className="w-4 h-4 text-blue-500 flex-shrink-0"
                />
                <span>How do I customize download settings?</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-xs text-gray-600">
                Use the settings above to change download folder, filename
                patterns, and other options. Changes are saved automatically.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3">
            <AccordionTrigger className="text-xs font-medium text-gray-800 hover:no-underline">
              <div className="flex items-center space-x-2">
                <Icon
                  icon="lucide:folder"
                  className="w-4 h-4 text-green-500 flex-shrink-0"
                />
                <span>Where are files downloaded?</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-xs text-gray-600">
                Files are saved to your default Downloads folder, organized by
                the folder pattern you set above.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}

export default SidebarApp;
