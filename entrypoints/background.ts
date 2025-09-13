import type { MediaContentType } from "~/types";
import { onMessage, sendMessage } from "webext-bridge/background";

export default defineBackground(() => {
  onMessage("START_MASS_SCRAPE", async (message) => {
    console.log("Starting mass scraping:", message);
  });

  console.log("Hello background!", { id: browser.runtime.id });

  // Listen for messages from content scripts
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log(
      "Background script received message:",
      message,
      "from:",
      sender
    );

    if (message.type === "DOWNLOAD_REQUEST") {
      // Handle download request asynchronously
      handleDownloadRequest(message.data)
        .then(() => {
          // Send success response back to content script
          sendResponse({
            success: true,
            message: "Download request processed",
          });
        })
        .catch((error) => {
          console.error("Error handling download request:", error);
          sendResponse({
            success: false,
            error: (error as Error).message,
          });
        });

      // Return true to indicate we will send a response asynchronously
      return true;
    } else {
      // Unknown message type - send immediate response
      sendResponse({ success: false, error: "Unknown message type" });
      return false; // No async response needed
    }
  });
});

// Function to handle download requests
async function handleDownloadRequest(data: {
  timestamp: number;
  mediaContentType: MediaContentType;
  urls: string[];
  folderDestination?: string;
  subredditName?: string;
}) {
  console.log("Processing download request:", data);

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

  console.log("data.mediaContentType", data.mediaContentType);

  const folderDestination = data.folderDestination || "Reddit Downloads";
  const subredditName = data.subredditName || "unknown";

  if (
    data.mediaContentType === "multiple-images" ||
    data.mediaContentType === "single-image"
  ) {
    await downloadGalleryImages(data.urls, folderDestination, subredditName);
  }

  if (data.mediaContentType === "video") {
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
