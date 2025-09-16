import { onMessage } from "webext-bridge/background";
import { DownloadRequestMessage } from "@/types/shim";

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
    await downloadGalleryImages(
      data.urls,
      folderDestination,
      subredditName,
      data.useGalleryFolders,
      data.addTitleToImages,
      data.postTitle
    );
    return;
  }

  if (data.mediaContentType === "video") {
    logger.log("downloading video", data.urls[0]);

    if (browser.offscreen) {
      await offscreenDownloadVideo({
        url: data.urls[0],
        folderDestination,
        subredditName,
        addTitleToVideo: data.addTitleToVideos,
        postTitle: data.postTitle || "",
        filenamePattern: await filenamePattern.getValue(),
      });
      return;
    }

    await downloadVideo({
      url: data.urls[0],
      folderDestination,
      subredditName,
      addTitleToVideo: data.addTitleToVideos,
      postTitle: data.postTitle || "",
      filenamePattern: await filenamePattern.getValue(),
    });
  }
}
