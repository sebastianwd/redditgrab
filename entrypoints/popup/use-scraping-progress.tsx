import { useState } from "react";

export const useScrapingProgress = () => {
  const [scrapingStatus, setScrapingStatus] = useState({
    isScraping: false,
    downloadedCount: 0,
    currentBatchCount: 0,
    currentPostId: null as string | null,
    currentPostInfo: null as {
      index: number;
      type: string;
      subreddit: string;
    } | null,
  });

  const startScraping = () => {
    setScrapingStatus({ ...scrapingStatus, isScraping: true });
  };

  const stopScraping = () => {
    setScrapingStatus({ ...scrapingStatus, isScraping: false });
  };

  const setCurrentBatchCount = (currentBatchCount: number) => {
    setScrapingStatus((prev) => ({ ...prev, currentBatchCount }));
  };

  const incrementDownloadCount = () => {
    setScrapingStatus((prev) => ({
      ...prev,
      downloadedCount: prev.downloadedCount + 1,
    }));
  };

  const setCurrentPostInfo = (
    postInfo: { index: number; type: string; subreddit: string } | null
  ) => {
    setScrapingStatus((prev) => ({
      ...prev,
      currentPostInfo: postInfo,
    }));
  };

  return {
    scrapingStatus,
    startScraping,
    stopScraping,
    setCurrentBatchCount,
    incrementDownloadCount,
    setCurrentPostInfo,
  };
};
