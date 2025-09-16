import { addTextToImage, addTextToVideo } from "./text-overlays";
import { logger } from "./logger";
import { createBlobUrl } from "./blob-utils";
import { DownloadImageOptions, DownloadVideoOptions } from "@/types";
import { compact } from "es-toolkit";

export const getRedGifsUrl = (mediaElement: Element): string | null => {
  let embed: Element | null = null;

  if (mediaElement.tagName.toLowerCase() === "shreddit-embed") {
    embed = mediaElement;
  } else {
    embed = mediaElement.querySelector("shreddit-embed");
  }

  if (!embed) return null;

  const providerName = embed.getAttribute("providername");
  if (providerName !== "RedGIFs") return null;

  const htmlContent = embed.getAttribute("html");
  if (!htmlContent) return null;

  const iframeMatch = htmlContent.match(
    /src="([^"]*redgifs\.com\/ifr\/([^"?]+))/
  );
  if (iframeMatch && iframeMatch[2]) {
    const redgifsId = iframeMatch[2];
    // Convert to direct m3u8 stream URL
    return `https://api.redgifs.com/v2/gifs/${redgifsId}/hd.m3u8`;
  }

  return null;
};

export function getSingleImageUrl(mediaElement: Element) {
  // Try hidden zoomable image (original full-res)
  const zoomable = mediaElement.querySelector<HTMLImageElement>(
    ".lightboxed-content img"
  );

  if (zoomable && zoomable.src.startsWith("https://i.redd.it/")) {
    return zoomable.src;
  }

  // Fallback to preview image (lower res)
  const preview = mediaElement.querySelector<HTMLImageElement>("img");
  return preview?.src;
}

export async function getGalleryImageUrls(mediaElement: Element) {
  logger.log("scraping gallery images for", mediaElement);

  if (!mediaElement) {
    throw new Error("Media element not found");
  }

  const liElements = mediaElement.querySelectorAll<HTMLLIElement>(
    "gallery-carousel ul li"
  );

  const urls: string[] = [];

  liElements.forEach((li) => {
    // pick the <figure> img (better quality than background one)
    const img = li.querySelector<HTMLImageElement>("figure img");
    if (img?.src) {
      urls.push(img.src);
    }
  });

  return urls;
}

async function getRemoteFile(url: string) {
  const response = await fetch(url, { mode: "no-cors" });
  const contentType = response.headers.get("content-type");

  let extension = "jpg";
  if (contentType) {
    if (contentType.includes("png")) extension = "png";
    if (contentType.includes("gif")) extension = "gif";
    if (contentType.includes("mp4")) extension = "mp4";
  }

  // fallback: try to parse extension from URL
  const urlPath = new URL(url).pathname;
  const match = urlPath.match(/\.([a-z0-9]+)(?:$|\?)/i);
  if (match) extension = match[1].toLowerCase();

  return {
    extension,
    blob: await response.blob(),
  };
}

export async function downloadGalleryImages(options: DownloadImageOptions) {
  const {
    urls,
    folderDestination = "Reddit Downloads",
    subredditName = "unknown",
    useGalleryFolders = false,
    addTitleToImages = false,
    filenamePattern = "{subreddit}_{timestamp}_{filename}",
    postTitle,
    offscreen = false,
  } = options;

  logger.log("Downloading gallery images:", urls);

  const pattern = filenamePattern;

  // Create gallery folder name if using gallery folders
  const galleryFolderSuffix =
    useGalleryFolders && urls.length > 1
      ? `_gallery_${getCurrentTimestamp()}`
      : "";

  const finalFolderDestination =
    useGalleryFolders && urls.length > 1
      ? `${folderDestination}/${subredditName}${galleryFolderSuffix}`
      : folderDestination;

  const results = await Promise.all(
    urls.map(async (url, index) => {
      let { extension, blob } = await getRemoteFile(url);

      // Apply text overlay if enabled and we have a title
      if (addTitleToImages && postTitle && extension !== "gif") {
        try {
          logger.log("Adding text overlay to image:", {
            postTitle,
            extension,
            blobSize: blob.size,
          });
          blob = await addTextToImage(blob, postTitle);
          // Change extension to PNG since we're converting the image
          extension = "png";
          logger.log(
            "Text overlay added successfully, new blob size:",
            blob.size
          );
        } catch (error) {
          logger.error("Failed to add text to image:", error);
          // Continue with original image if overlay fails
        }
      }

      // Generate filename using pattern
      const filename = generateFilename(pattern, {
        subreddit: subredditName,
        timestamp: getCurrentTimestamp(),
        filename: extractFilenameFromUrl(url),
        extension,
      });

      // For galleries with folders, add index to filename to avoid conflicts
      const finalFilename =
        useGalleryFolders && urls.length > 1
          ? `${index + 1}_${filename}`
          : filename;

      // Convert blob to data URL for Chrome Manifest V3 compatibility
      const dataUrl = await createBlobUrl(blob);

      if (offscreen) {
        return {
          url: dataUrl,
          filename: `${finalFolderDestination}/${finalFilename}`,
        };
      }
      await browser.downloads.download({
        url: dataUrl,
        filename: `${finalFolderDestination}/${finalFilename}`,
        saveAs: false,
      });
    })
  );

  if (offscreen) {
    return compact(results);
  }
}

export async function downloadVideo(options: DownloadVideoOptions) {
  const {
    url: initialUrl,
    folderDestination = "Reddit Downloads",
    subredditName = "unknown",
    addTitleToVideo = false,
    postTitle,
    filenamePattern,
    offscreen = false,
  } = options;

  try {
    const getSourceUrl = async () => {
      logger.log("Downloading video:", initialUrl);

      if (initialUrl.includes(".m3u8")) {
        if (initialUrl.includes("api.redgifs.com")) {
          const hlsUrl = await getRedGifsHLSVideoUrl(initialUrl);
          return hlsUrl;
        } else {
          const hlsUrl = await getHLSVideoUrl(initialUrl);
          return hlsUrl;
        }
      }
      return initialUrl;
    };

    const url = await getSourceUrl();

    const pattern = filenamePattern || "{subreddit}_{timestamp}_{filename}";

    const filename = generateFilename(pattern, {
      subreddit: subredditName,
      timestamp: getCurrentTimestamp(),
      filename: extractFilenameFromUrl(url),
      extension: "mp4",
    });

    // If text overlay is enabled and we have a title, process the video
    if (addTitleToVideo && postTitle) {
      try {
        logger.log("Adding text overlay to video:", postTitle);

        const response = await fetch(url);
        const videoBlob = await response.blob();

        const processedVideoBlob = await addTextToVideo(videoBlob, postTitle);

        const dataUrl = await createBlobUrl(processedVideoBlob);

        if (offscreen) {
          return {
            url: dataUrl,
            filename: `${folderDestination}/${filename}`,
          };
        }
        await browser.downloads.download({
          url: dataUrl,
          filename: `${folderDestination}/${filename}`,
          saveAs: false,
        });
      } catch (error) {
        logger.error(
          "Failed to add text to video, downloading original:",
          error
        );
        if (offscreen) {
          return {
            url,
            filename: `${folderDestination}/${filename}`,
          };
        }
        await browser.downloads.download({
          url,
          filename: `${folderDestination}/${filename}`,
          saveAs: false,
        });
      }
    } else {
      if (offscreen) {
        return {
          url,
          filename: `${folderDestination}/${filename}`,
        };
      }
      await browser.downloads.download({
        url,
        filename: `${folderDestination}/${filename}`,
        saveAs: false,
      });
    }
  } catch (err) {
    logger.error("Failed to parse packaged-media-json:", err);
  }
}

export async function getRedGifsHLSVideoUrl(m3u8Url: string): Promise<string> {
  try {
    logger.log("Processing RedGIFs HLS with manual segment download:", m3u8Url);

    const ffmpeg = await createFFmpeg();

    // Download and parse the m3u8 playlist
    const response = await fetch(m3u8Url);
    const playlistContent = await response.text();

    logger.log("playlistContent", playlistContent);

    // Parse segments and init segment manually since FFmpeg.wasm doesn't support HTTPS
    const { initSegment, segments } = parseRedGifsPlaylist(playlistContent);

    logger.log("Found segments:", segments.length);
    logger.log("Init segment:", initSegment);

    const segmentFiles = [];

    // Download initialization segment if present
    if (initSegment) {
      const initData = await downloadSegmentWithByteRange(
        initSegment.uri,
        initSegment.byteRange
      );
      await ffmpeg.writeFile("init.m4s", initData);
      segmentFiles.push("init.m4s");
    }

    // Download all video segments
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentData = await downloadSegmentWithByteRange(
        segment.uri,
        segment.byteRange
      );
      const filename = `segment_${i.toString().padStart(3, "0")}.m4s`;
      await ffmpeg.writeFile(filename, segmentData);
      segmentFiles.push(filename);
    }

    // For MP4 segments, we need to use binary concatenation, not the concat demuxer
    // Step 1: Concatenate all segments into one file
    let allSegments = new Uint8Array(0);

    for (const filename of segmentFiles) {
      const segmentData = await ffmpeg.readFile(filename);
      const newData = new Uint8Array(allSegments.length + segmentData.length);
      newData.set(allSegments);
      newData.set(segmentData as ArrayLike<number>, allSegments.length);
      allSegments = newData;
    }

    // Write the concatenated segments
    await ffmpeg.writeFile("concatenated.m4s", allSegments);

    // Step 1: Convert concatenated segments to MKV
    await ffmpeg.exec(["-i", "concatenated.m4s", "-c", "copy", "live.mkv"]);

    // Step 2: Convert MKV to MP4
    await ffmpeg.exec(["-i", "live.mkv", "-codec", "copy", "live.mp4"]);

    // Read the final video file
    const finalVideo = await ffmpeg.readFile("live.mp4");

    const filesToClean = [
      ...segmentFiles,
      "concatenated.m4s",
      "live.mkv",
      "live.mp4",
    ];
    for (const file of filesToClean) {
      try {
        await ffmpeg.deleteFile(file);
      } catch (e) {}
    }

    const blob = new Blob([finalVideo as BlobPart], { type: "video/mp4" });
    const blobUrl = await createBlobUrl(blob);

    logger.log("RedGIFs video processed successfully:", blobUrl);
    return blobUrl;
  } catch (error) {
    logger.error("Error processing RedGIFs HLS:", error);
    throw error;
  }
}

// Parse RedGIFs playlist to extract segments with byte ranges
function parseRedGifsPlaylist(playlistText: string) {
  const lines = playlistText.split("\n").map((line) => line.trim());
  const segments = [];
  let initSegment = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("#EXT-X-MAP:")) {
      // Extract initialization segment
      const uriMatch = line.match(/URI="([^"]+)"/);
      const byteRangeMatch = line.match(/BYTERANGE="([^"]+)"/);

      if (uriMatch && byteRangeMatch) {
        initSegment = {
          uri: uriMatch[1],
          byteRange: byteRangeMatch[1],
        };
      }
    } else if (line.startsWith("#EXT-X-BYTERANGE:")) {
      // Store byte range for next segment
      const byteRange = line.replace("#EXT-X-BYTERANGE:", "");
      if (i + 1 < lines.length && lines[i + 1].startsWith("https://")) {
        segments.push({
          uri: lines[i + 1],
          byteRange: byteRange,
        });
        i++; // Skip the next line since we processed it
      }
    }
  }

  return { initSegment, segments };
}

async function downloadSegmentWithByteRange(
  url: string,
  byteRange: string
): Promise<Uint8Array> {
  const [length, offset] = byteRange.split("@").map(Number);
  const endByte = offset + length - 1;

  const response = await fetch(url, {
    headers: {
      Range: `bytes=${offset}-${endByte}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download segment: ${response.status} ${response.statusText}`
    );
  }

  return new Uint8Array(await response.arrayBuffer());
}

export async function getHLSVideoUrl(m3u8Url: string) {
  const ffmpeg = await createFFmpeg();

  const [videoUrl, audioUrl] = m3u8Url.split(",");

  logger.log("videoUrl", videoUrl);
  logger.log("audioUrl", audioUrl);

  const videoResponse = await fetch(videoUrl.replace(".m3u8", ".ts"));
  const tsFile = new Uint8Array(await videoResponse.arrayBuffer());
  await ffmpeg.writeFile("video.ts", tsFile);

  const hasAudio = audioUrl && audioUrl.trim() !== "";

  if (hasAudio) {
    const audioResponse = await fetch(audioUrl.replace(".m3u8", ".aac"));
    const audioFile = new Uint8Array(await audioResponse.arrayBuffer());
    await ffmpeg.writeFile("audio.ts", audioFile);

    await ffmpeg.exec([
      "-i",
      "video.ts",
      "-i",
      "audio.ts",
      "-c",
      "copy",
      "output.mp4",
    ]);
  } else {
    logger.log("No audio URL provided, processing video only");
    await ffmpeg.exec(["-i", "video.ts", "-c", "copy", "output.mp4"]);
  }

  const videoData = await ffmpeg.readFile("output.mp4");
  const buffer = new Uint8Array(videoData as unknown as ArrayBuffer);
  const blob = new Blob([buffer], { type: "video/mp4" });
  const objectUrl = await createBlobUrl(blob);
  return objectUrl;
}

type RedditPackagedMedia = {
  playbackMp4s?: {
    duration: number;
    permutations: {
      source: {
        url: string;
        dimensions: {
          width: number;
          height: number;
        };
      };
    }[];
  };
};

const getHighestQualityHLS = async (m3u8Url: string) => {
  const playlist = await fetch(m3u8Url).then((r) => r.text());

  const lines = playlist.split("\n");
  let bestVideo: { resolution: number; url: string | null } = {
    resolution: 0,
    url: null,
  };
  let bestAudio: { bitrate: number; url: string | null } = {
    bitrate: 0,
    url: null,
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // --- VIDEO ---
    if (line.startsWith("#EXT-X-STREAM-INF")) {
      const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);
      if (resMatch) {
        const res = parseInt(resMatch[2]); // take height as quality indicator
        const nextLine = lines[i + 1]?.trim();

        if (res > bestVideo.resolution) {
          bestVideo = { resolution: res, url: new URL(nextLine, m3u8Url).href };
        }
      }
    }

    // --- AUDIO ---
    if (line.startsWith("#EXT-X-MEDIA") && line.includes("TYPE=AUDIO")) {
      const uriMatch = line.match(/URI="([^"]+)"/);
      if (uriMatch) {
        const nextUrl = new URL(uriMatch[1], m3u8Url).href;

        // crude way: pick the highest GROUP-ID (e.g. 5 vs 6)
        const groupMatch = line.match(/GROUP-ID="(\d+)"/);
        const bitrate = groupMatch ? parseInt(groupMatch[1]) : 0;

        if (bitrate > bestAudio.bitrate) {
          bestAudio = { bitrate, url: nextUrl };
        }
      }
    }
  }
  return [bestVideo.url, bestAudio.url].join(",");
};

export async function getVideoUrl(mediaElement: Element) {
  logger.log("getting video url for", mediaElement);

  const redGifsUrl = getRedGifsUrl(mediaElement);
  if (redGifsUrl) {
    return redGifsUrl;
  }

  // First check if there's a direct m3u8 URL (HLS stream)
  const sourceUrl = mediaElement.getAttribute("src");
  if (sourceUrl && sourceUrl.includes(".m3u8")) {
    if (sourceUrl.includes("api.redgifs.com")) {
      const url = await getRedGifsHLSVideoUrl(sourceUrl);
      return url;
    } else {
      // Reddit HLS
      const url = await getHighestQualityHLS(sourceUrl);
      return url;
    }
  }

  const packagedMedia = mediaElement.getAttribute("packaged-media-json");
  if (!packagedMedia) {
    console.error("No packaged-media-json found.");
    return;
  }

  const parsed = JSON.parse(packagedMedia) as RedditPackagedMedia;
  const mp4s = parsed.playbackMp4s?.permutations ?? [];
  if (!mp4s.length) {
    console.error("No MP4 sources found.");
    return;
  }

  // Pick the largest resolution (by width)
  const best = mp4s.reduce((a, b) =>
    b.source.dimensions.width > a.source.dimensions.width ? b : a
  );

  return best.source.url;
}
