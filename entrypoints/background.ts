import type { MediaContentType } from "~/types";
import { onMessage, sendMessage } from "webext-bridge/background";

export default defineBackground(() => {
  onMessage("DOWNLOAD_REQUEST", async ({ data }) => {
    try {
      await handleDownloadRequest(data);
      return { success: true };
    } catch (error) {
      console.error("Download request failed:", error);
      return { success: false, message: (error as Error).message };
    }
  });

  // Handle extension icon click to toggle sidebar
  const handleIconClick = async (tab: Browser.tabs.Tab) => {
    try {
      console.log(
        "Extension icon clicked, browser.sidePanel:",
        browser.sidePanel
      );
      // Chrome: Open side panel
      if (browser.sidePanel && browser.sidePanel.open) {
        await browser.sidePanel.open({
          tabId: tab.id,
          windowId: tab.windowId,
        });
        console.log("Opened Chrome side panel");
      }
      // Firefox: Toggle sidebar
      else if (
        (browser as any).sidebarAction &&
        (browser as any).sidebarAction.toggle
      ) {
        await (browser as any).sidebarAction.toggle();
        console.log("Toggled Firefox sidebar");
      } else {
        console.log("Sidebar API not available");
      }
    } catch (error) {
      console.error("Failed to open/toggle sidebar:", error);
    }
  };

  // Use browserAction for MV2, action for MV3
  if (import.meta.env.MANIFEST_VERSION === 2) {
    (browser as any).browserAction.onClicked.addListener(handleIconClick);
    console.log("Registered MV2 browserAction.onClicked listener");
  } else {
    browser.action.onClicked.addListener(handleIconClick);
    console.log("Registered MV3 action.onClicked listener");
  }

  console.log("Extension icon click opens sidepanel directly");
});

// Function to handle download requests
async function handleDownloadRequest(data: {
  timestamp: number;
  mediaContentType: MediaContentType;
  urls: string[];
  folderDestination?: string;
  subredditName?: string;
}) {
  console.log("Processing download request22:", data);

  // Get the current active tab to access the page content
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    throw new Error("No active tab found");
  }

  // You can add your download logic here
  // For example:
  // - Extract media URLs from the page
  // - Download files using browser.downloads.download()
  // - Store download history in storage

  const folderDestination = data.folderDestination || "Reddit Downloads";
  const subredditName = data.subredditName || "unknown";

  if (
    data.mediaContentType === "multiple-images" ||
    data.mediaContentType === "single-image"
  ) {
    await downloadGalleryImages(data.urls, folderDestination, subredditName);
  }

  if (data.mediaContentType === "video") {
    console.log("downloading video", data.urls[0]);
    await downloadVideo(data.urls[0], folderDestination, subredditName);
  }

  console.log("Download request processed for tab:", tab.id);
  console.log("Request data:", data);

  // Example: You could inject a content script to extract media URLs
  // const results = await browser.tabs.executeScript(tab.id, {
  //   code: `
  //     // Extract media URLs from the page
  //     const mediaElements = document.querySelectorAll('img, video, audio');
  //     Array.from(mediaElements).map(el => el.src).filter(Boolean);
  //   `
  // });

  // Example: You could trigger a download
  // await browser.downloads.download({
  //   url: mediaUrl,
  //   filename: 'reddit-media.jpg',
  //   saveAs: true
  // });
}
