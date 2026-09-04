import { onMessage } from "webext-bridge/background";
import { ArchiveRequestMessage, DownloadRequestMessage } from "@/types/shim";
import { buildArchiveDownload } from "@/utils/archive-download";
import { offscreenDownloadArchive } from "@/utils/offscreen-media-download";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(handleOffscreenMessages);

  onMessage("DOWNLOAD_REQUEST", async ({ data }) => {
    try {
      await handleDownloadRequest(data);
      return { success: true };
    } catch (error) {
      console.error("Download request failed:", error);
      return { success: false, message: (error as Error).message };
    }
  });

  onMessage("ARCHIVE_REQUEST", async ({ data }) => {
    try {
      await handleArchiveRequest(data);
      return { success: true };
    } catch (error) {
      console.error("[RedditGrab] Archive request failed:", error);
      // The message travels back to the button, which now displays it, so the
      // user is not left with a bare "Failed".
      return {
        success: false,
        message: (error as Error)?.message || String(error),
      };
    }
  });

  const handleIconClick = async (tab: Browser.tabs.Tab) => {
    try {
      logger.log(
        "Extension icon clicked, browser.sidePanel:",
        browser.sidePanel
      );
      if (browser.sidePanel && browser.sidePanel.open) {
        await browser.sidePanel.open({
          tabId: tab.id,
          windowId: tab.windowId,
        });
        logger.log("Opened Chrome side panel");
      } else if (
        (browser as any).sidebarAction &&
        (browser as any).sidebarAction.toggle
      ) {
        await (browser as any).sidebarAction.toggle();
        logger.log("Toggled Firefox sidebar");
      } else {
        logger.log("Sidebar API not available");
      }
    } catch (error) {
      console.error("Failed to open/toggle sidebar:", error);
    }
  };

  if (import.meta.env.MANIFEST_VERSION === 2) {
    (browser as any).browserAction.onClicked.addListener(handleIconClick);
    logger.log("Registered MV2 browserAction.onClicked listener");
  } else {
    browser.action.onClicked.addListener(handleIconClick);
    logger.log("Registered MV3 action.onClicked listener");
  }
});

/**
 * The archive HTML arrives already rendered (the content script has the DOM
 * APIs the sanitizer needs). All that is left is writing it to disk.
 *
 * It cannot be written from here directly on Chrome: an MV3 service worker has
 * no `URL.createObjectURL`, and `downloads.download` rejects `data:` URLs with
 * "Access denied for URL data:text/html...". So the blob URL is minted in the
 * offscreen document, the same detour the video and image paths take. Firefox
 * MV2 has a real background page, so it does the work inline.
 */
async function handleArchiveRequest(data: ArchiveRequestMessage) {
  const outputPath = sanitizeDownloadPath(
    `${data.folderDestination || "Reddit Downloads"}/${data.filename}`,
  );

  logger.log(
    `Saving archive: ${outputPath} (${data.servedComments} comments, ${data.moreStubs} capped threads)`,
  );

  const options = { html: data.html, outputPath } as const;

  if (browser.offscreen) {
    await offscreenDownloadArchive(options);
    return;
  }

  const { url, filename } = await buildArchiveDownload(options);
  await browser.downloads.download({ url, filename, saveAs: false });
}

async function handleDownloadRequest(data: DownloadRequestMessage) {
  logger.log("Processing download request22:", data);

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("No active tab found");
  }

  const folderDestination = data.folderDestination || "Reddit Downloads";
  const subredditName = data.subredditName || "unknown";

  if (
    data.mediaContentType === "multiple-images" ||
    data.mediaContentType === "single-image"
  ) {
    const downloadGalleryImagesOptions = {
      urls: data.urls,
      folderDestination,
      subredditName,
      useGalleryFolders: data.useGalleryFolders,
      addTitleToImages: data.addTitleToImages,
      postTitle: data.postTitle,
      filenamePattern: await filenamePattern.getValue(),
    } as const satisfies Parameters<typeof downloadGalleryImages>[0];

    if (browser.offscreen) {
      await offscreenDownloadGalleryImages(downloadGalleryImagesOptions);
      return;
    }
    await downloadGalleryImages(downloadGalleryImagesOptions);
  }

  if (data.mediaContentType === "video") {
    const downloadVideoOptions = {
      url: data.urls[0],
      folderDestination,
      subredditName,
      addTitleToVideo: data.addTitleToVideos,
      postTitle: data.postTitle || "",
      filenamePattern: await filenamePattern.getValue(),
    } as const satisfies Parameters<typeof downloadVideo>[0];

    if (browser.offscreen) {
      await offscreenDownloadVideo(downloadVideoOptions);
      return;
    }

    await downloadVideo(downloadVideoOptions);
  }
}
