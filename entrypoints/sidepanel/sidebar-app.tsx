import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { arktypeResolver } from "@hookform/resolvers/arktype";
import { DatePicker } from "@/components/ui/date-picker";
import {
  folderDestination as folderDestinationStorage,
  filenamePattern as filenamePatternStorage,
  useGalleryFolders as useGalleryFoldersStorage,
  addTitleToImages as addTitleToImagesStorage,
  addTitleToVideos as addTitleToVideosStorage,
  markDownloadedAsVisited as markDownloadedAsVisitedStorage,
  useDateRange as useDateRangeStorage,
  dateRangeStart as dateRangeStartStorage,
  dateRangeEnd as dateRangeEndStorage,
  darkMode as darkModeStorage,
} from "@/utils/storage";
import { debounce } from "es-toolkit";
import { sendMessage } from "webext-bridge/popup";
import { useScrapingProgress } from "./use-scraping-progress";
import { processedPostIds } from "@/utils/storage";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Icon } from "@iconify/react";
import { logger } from "@/utils/logger";
import { SettingsSchema, type SettingsFormData } from "@/types/settings-schema";
import { FAQ } from "@/components/faq";
import { processFolderDestination } from "@/utils/post-utils";

const debouncedSaveFolder = debounce(async (value: string) => {
  await folderDestinationStorage.setValue(value);
}, 500);

const debouncedSaveFilename = debounce(async (value: string) => {
  await filenamePatternStorage.setValue(value);
}, 500);

const debouncedSaveGalleryFolders = debounce(async (value: boolean) => {
  await useGalleryFoldersStorage.setValue(value);
}, 500);

const debouncedSaveTitleToImages = debounce(async (value: boolean) => {
  await addTitleToImagesStorage.setValue(value);
}, 500);

const debouncedSaveTitleToVideos = debounce(async (value: boolean) => {
  await addTitleToVideosStorage.setValue(value);
}, 500);

const debouncedSaveMarkDownloadedAsVisited = debounce(
  async (value: boolean) => {
    await markDownloadedAsVisitedStorage.setValue(value);
  },
  500,
);

const debouncedSaveUseDateRange = debounce(async (value: boolean) => {
  await useDateRangeStorage.setValue(value);
}, 500);

const debouncedSaveDateRangeStart = debounce(
  async (value: number | undefined) => {
    await dateRangeStartStorage.setValue(value ? value.toString() : "");
  },
  500,
);

const debouncedSaveDateRangeEnd = debounce(
  async (value: number | undefined) => {
    await dateRangeEndStorage.setValue(value ? value.toString() : "");
  },
  500,
);

function SidebarApp() {
  const form = useForm<SettingsFormData>({
    resolver: arktypeResolver(SettingsSchema),
    mode: "onChange", // Validate on every change
    reValidateMode: "onChange", // Re-validate on every change
    defaultValues: {
      folderDestination: "Reddit Downloads/{subreddit}/{date}",
      filenamePattern: "{subreddit}_{timestamp}_{filename}",
      useGalleryFolders: false,
      addTitleToImages: false,
      addTitleToVideos: false,
      markDownloadedAsVisited: false,
      useDateRange: false,
      dateRangeStart: undefined,
      dateRangeEnd: undefined,
    },
  });

  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [isRedditPage, setIsRedditPage] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [massDownloadScrollUp, setMassDownloadScrollUp] = useState(false);

  // Load values from storage into form
  useEffect(() => {
    const loadSettings = async () => {
      const [
        folderDestination,
        filenamePattern,
        useGalleryFolders,
        addTitleToImages,
        addTitleToVideos,
        markDownloadedAsVisited,
        useDateRange,
        dateRangeStart,
        dateRangeEnd,
        darkMode,
      ] = await Promise.all([
        folderDestinationStorage.getValue(),
        filenamePatternStorage.getValue(),
        useGalleryFoldersStorage.getValue(),
        addTitleToImagesStorage.getValue(),
        addTitleToVideosStorage.getValue(),
        markDownloadedAsVisitedStorage.getValue(),
        useDateRangeStorage.getValue(),
        dateRangeStartStorage.getValue(),
        dateRangeEndStorage.getValue(),
        darkModeStorage.getValue(),
      ]);

      console.log("dateRangeStart", dateRangeStart);
      console.log("dateRangeEnd", dateRangeEnd);

      form.reset({
        folderDestination:
          folderDestination || "Reddit Downloads/{subreddit}/{date}",
        filenamePattern:
          filenamePattern || "{subreddit}_{timestamp}_{filename}",
        useGalleryFolders: useGalleryFolders || false,
        addTitleToImages: addTitleToImages || false,
        addTitleToVideos: addTitleToVideos || false,
        markDownloadedAsVisited: markDownloadedAsVisited || false,
        useDateRange: useDateRange || false,
        dateRangeStart: dateRangeStart ? parseInt(dateRangeStart) : undefined,
        dateRangeEnd: dateRangeEnd ? parseInt(dateRangeEnd) : undefined,
      });

      // Set dark mode
      setIsDarkMode(darkMode || false);
      document.documentElement.classList.toggle("dark", darkMode || false);
    };

    loadSettings();
  }, [form]);

  // Watch form changes and save to storage
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name) {
        switch (name) {
          case "folderDestination":
            debouncedSaveFolder(value.folderDestination || "");
            break;
          case "filenamePattern":
            debouncedSaveFilename(value.filenamePattern || "");
            break;
          case "useGalleryFolders":
            debouncedSaveGalleryFolders(value.useGalleryFolders || false);
            break;
          case "addTitleToImages":
            debouncedSaveTitleToImages(value.addTitleToImages || false);
            break;
          case "addTitleToVideos":
            debouncedSaveTitleToVideos(value.addTitleToVideos || false);
            break;
          case "markDownloadedAsVisited":
            debouncedSaveMarkDownloadedAsVisited(
              value.markDownloadedAsVisited || false,
            );
            break;
          case "useDateRange":
            debouncedSaveUseDateRange(value.useDateRange || false);
            break;
          case "dateRangeStart":
            debouncedSaveDateRangeStart(value.dateRangeStart);
            form.trigger(["dateRangeStart", "dateRangeEnd"]);
            break;
          case "dateRangeEnd":
            debouncedSaveDateRangeEnd(value.dateRangeEnd);
            form.trigger(["dateRangeStart", "dateRangeEnd"]);
            break;
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

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
      tab: Browser.tabs.Tab,
    ) => {
      if (changeInfo.url && tab.active) {
        setCurrentUrl(tab.url as string);
        const isReddit = tab.url?.includes("reddit.com");
        setIsRedditPage(isReddit ?? false);
      }
    };

    const handleTabActivated = async (
      activeInfo: Browser.tabs.OnActivatedInfo,
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

      logger.log("Starting mass scraping from sidebar");

      const processPage = async () => {
        let scanPayload: {
          scrollUp?: boolean;
          anchorPostId?: string;
        } = { scrollUp: massDownloadScrollUp };

        if (massDownloadScrollUp) {
          try {
            const anchorRes = await sendMessage(
              "GET_CURRENT_POST_ID",
              undefined,
              `content-script@${tab.id}`,
            );
            if (anchorRes?.success && anchorRes.postId) {
              scanPayload.anchorPostId = anchorRes.postId;
              logger.log("Scroll up: using anchor post", anchorRes.postId);
            }
          } catch (e) {
            logger.warn("Could not get current post id for scroll up", e);
          }
        }

        // Ask content script to scan for media using webext-bridge
        const response = await sendMessage(
          "SCAN_PAGE_MEDIA",
          scanPayload,
          `content-script@${tab.id}`,
        );

        logger.log(
          "Content script response:",
          JSON.stringify(response, null, 2),
        );

        if (!response.success || !response.data) {
          throw new Error("Failed to get media from page");
        }

        const { mediaUrls } = response.data;
        logger.log(`Starting downloads for ${mediaUrls.length} media items`);

        // Update progress tracking
        setCurrentBatchCount(mediaUrls.length);
        addToTotalPostsFound(mediaUrls.length);

        // Process downloads similar to download-button.tsx
        for (let i = 0; i < mediaUrls.length; i++) {
          const mediaItem = mediaUrls[i];

          if (!shouldContinueProcessingRef.current) {
            logger.log("Processing stopped by user");
            break;
          }

          try {
            // Calculate folder destination with variable substitution
            const currentFolderDestination =
              form.getValues("folderDestination");
            const finalFolderDestination = processFolderDestination(
              currentFolderDestination,
              null, // No post element available in sidebar
              mediaItem.subredditName,
              mediaItem.postDate,
              mediaItem.postAuthor,
            );

            logger.log(
              `Downloading ${i + 1}/${mediaUrls.length}: ${
                mediaItem.type
              } with ${mediaItem.urls.length} URLs`,
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
                `content-script@${tab.id}`,
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
                useGalleryFolders: form.getValues("useGalleryFolders"),
                addTitleToImages: form.getValues("addTitleToImages"),
                addTitleToVideos: form.getValues("addTitleToVideos"),
                postTitle: mediaItem.postTitle,
              },
              "background",
            );

            if (downloadResponse?.success) {
              logger.log(`Download ${i + 1} started successfully`);
              incrementDownloadCount();

              // Mark this post as processed in storage
              const currentProcessedIds = await processedPostIds.getValue();
              if (!currentProcessedIds.includes(mediaItem.mediaPostId)) {
                await processedPostIds.setValue([
                  ...currentProcessedIds,
                  mediaItem.mediaPostId,
                ]);
              }

              if (form.getValues("markDownloadedAsVisited")) {
                try {
                  await sendMessage(
                    "MARK_POST_VISITED",
                    { mediaPostId: mediaItem.mediaPostId },
                    `content-script@${tab.id}`,
                  );
                } catch (e) {
                  console.warn("Failed to mark post as visited:", e);
                }
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
        logger.log(`Batch complete! Downloaded ${mediaUrls.length} new posts.`);
        setCurrentPostInfo(null);

        // Continue processing if scraping is still active
        if (shouldContinueProcessingRef.current) {
          if (newPostsFound) {
            // Found new posts, check again soon for more
            logger.log(
              "Found new posts, scheduling next check in 2 seconds...",
            );
            setTimeout(() => {
              if (shouldContinueProcessingRef.current) {
                logger.log("Checking for more new posts...");
                processPage();
              }
            }, 2000);
          } else {
            if (massDownloadScrollUp) {
              logger.log(
                "No new posts found; reached the top. Mass download complete.",
              );
              stopScraping();
            } else {
              logger.log("No new posts found, scrolling to load more...");
              await sendMessage(
                "SCROLL_TO_LOAD_MORE",
                { scrollUp: massDownloadScrollUp },
                `content-script@${tab.id}`,
              );
              logger.log(
                "Scrolled to load more posts, checking again in 3 seconds...",
              );
              setTimeout(() => {
                if (shouldContinueProcessingRef.current) {
                  processPage();
                }
              }, 3000);
            }
          }
        } else {
          logger.log("Processing stopped by user");
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
      logger.log("Mass scraping stopped");
    } catch (error) {
      console.error("Failed to stop mass scraping:", error);
    }
  };

  const handleClearProcessedPosts = async () => {
    try {
      setIsClearingHistory(true);
      await processedPostIds.setValue([]);
      logger.log("Cleared processed posts history");
      // Small delay to show the loading state
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error("Failed to clear processed posts:", error);
    } finally {
      setIsClearingHistory(false);
    }
  };

  const handleToggleDarkMode = async () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    document.documentElement.classList.toggle("dark", newDarkMode);
    await darkModeStorage.setValue(newDarkMode);
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
              className="text-blue-600 w-5 h-5 mt-0.5 shrink-0"
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
      className="w-full h-full min-h-screen p-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800"
      style={{ minWidth: "300px" }}
    >
      <div className="text-center mb-6">
        <div className="flex justify-center items-center mb-2 relative">
          <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
            <Icon icon="lucide:download" className="text-white w-5 h-5" />
          </div>
          <Button
            onClick={handleToggleDarkMode}
            variant="ghost"
            size="sm"
            className="p-2 absolute right-0"
          >
            <Icon
              icon={isDarkMode ? "lucide:sun" : "lucide:moon"}
              className="w-4 h-4 text-gray-600 dark:text-gray-300"
            />
          </Button>
        </div>
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">
          RedditGrab
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Grab images and videos from Reddit posts
        </p>
      </div>

      <Form {...form}>
        <div className="space-y-4 mb-6">
          <FormField
            control={form.control}
            name="folderDestination"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Download Folder</FormLabel>
                <FormControl>
                  <input
                    type="text"
                    {...field}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Enter folder name"
                  />
                </FormControl>
                <FormDescription>
                  Available: {"{subreddit}"}, {"{date}"},
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-blue-600 cursor-help">
                          {" {user}"}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          May not work on all pages (works best on subreddit
                          pages)
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="filenamePattern"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Filename Pattern</FormLabel>
                <FormControl>
                  <input
                    type="text"
                    {...field}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="{subreddit}_{timestamp}_{filename}"
                  />
                </FormControl>
                <FormDescription>
                  Available: {"{subreddit}"}, {"{timestamp}"}, {"{filename}"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="useGalleryFolders"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Create folders for image galleries</FormLabel>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="addTitleToImages"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Add post title to images</FormLabel>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="addTitleToVideos"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>
                    Add post title to videos (slower processing)
                  </FormLabel>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="markDownloadedAsVisited"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none flex items-center gap-1.5">
                  <FormLabel>Mark downloaded posts as visited</FormLabel>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex text-gray-500 dark:text-gray-400 cursor-help">
                          <Icon icon="lucide:info" className="size-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Experimental</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="useDateRange"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Filter posts by date range</FormLabel>
                </div>
              </FormItem>
            )}
          />

          {form.watch("useDateRange") && (
            <div className="space-y-3 ml-6 border-l-2 border-gray-200 pl-4">
              <FormField
                control={form.control}
                name="dateRangeStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <DatePicker
                        {...field}
                        placeholder="Select start date"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateRangeEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <DatePicker
                        {...field}
                        placeholder="Select end date"
                        useEndOfDay={true}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </FormControl>
                    <FormDescription>
                      Only posts from this date range will be downloaded
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>
      </Form>

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
        {!scrapingStatus.isScraping && (
          <div className="flex flex-row items-center space-x-2 pl-1">
            <Checkbox
              id="mass-download-scroll-up"
              checked={massDownloadScrollUp}
              onCheckedChange={(checked) =>
                setMassDownloadScrollUp(checked === true)
              }
            />
            <label
              htmlFor="mass-download-scroll-up"
              className="text-xs text-gray-500 dark:text-gray-400 leading-none cursor-pointer select-none"
            >
              Scroll up from current post
            </label>
          </div>
        )}

        {/* Progress Display */}
        {scrapingStatus.isScraping && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Progress: {scrapingStatus.downloadedCount}/
                {scrapingStatus.totalPostsFound}
              </span>
              <span className="text-xs text-blue-600 dark:text-blue-300">
                {scrapingStatus.totalPostsFound > 0
                  ? Math.round(
                      (scrapingStatus.downloadedCount /
                        scrapingStatus.totalPostsFound) *
                        100,
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
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {scrapingStatus.isScraping
            ? "Auto-scrolling and downloading media posts..."
            : "This will scroll and download all media on the page"}
        </p>

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

      <FAQ />

      {/* Version number and links */}
      <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center space-y-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            RedditGrab v1.0.7
          </p>
          <div className="space-y-1 flex flex-col items-center">
            <a
              href="https://github.com/sebastianwd/redditgrab"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline text-blue-500 hover:text-blue-600 hover:underline transition-colors"
            >
              Source Code
            </a>
            {import.meta.env.BROWSER === "chrome" && (
              <a
                href="https://chromewebstore.google.com/detail/redditgrab/pkjhbflcnjikmfiiojcagjidbjeimkbj?hl=en"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline text-blue-500 hover:text-blue-600 hover:underline transition-colors"
              >
                Rate Extension
              </a>
            )}
            {import.meta.env.BROWSER === "firefox" && (
              <a
                href="https://addons.mozilla.org/en-US/firefox/addon/media-downloader-redditgrab"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline text-blue-500 hover:text-blue-600 hover:underline transition-colors"
              >
                Rate Extension
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SidebarApp;
