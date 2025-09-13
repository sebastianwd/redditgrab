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

export async function downloadGalleryImages(
  urls: string[],
  folderDestination: string = "Reddit Downloads",
  subredditName: string = "unknown"
) {
  logger.log("Downloading gallery images:", urls);

  // Get filename pattern from storage
  const pattern =
    (await filenamePattern.getValue()) || "{subreddit}_{timestamp}_{filename}";

  await Promise.all(
    urls.map(async (url) => {
      const { extension, blob } = await getRemoteFile(url);
      const objectUrl = URL.createObjectURL(blob);

      // Generate filename using pattern
      const filename = generateFilename(pattern, {
        subreddit: subredditName,
        timestamp: getCurrentTimestamp(),
        filename: extractFilenameFromUrl(url),
        extension,
      });

      // Trigger browser download with configured folder
      await browser.downloads.download({
        url: objectUrl,
        filename: `${folderDestination}/${filename}`,
        saveAs: false,
      });
    })
  );
}

export async function downloadVideo(
  url: string,
  folderDestination: string = "Reddit Downloads",
  subredditName: string = "unknown"
) {
  try {
    logger.log("Downloading video:", url);

    if (url.includes(".m3u8")) {
      const hlsUrl = await getHLSVideoUrl(url);
      logger.log("hlsUrl", hlsUrl);
      url = hlsUrl;
    }

    // Get filename pattern from storage
    const pattern =
      (await filenamePattern.getValue()) ||
      "{subreddit}_{timestamp}_{filename}";

    // Generate filename using pattern
    const filename = generateFilename(pattern, {
      subreddit: subredditName,
      timestamp: getCurrentTimestamp(),
      filename: extractFilenameFromUrl(url),
      extension: "mp4",
    });

    browser.downloads.download({
      url,
      filename: `${folderDestination}/${filename}`,
      saveAs: false,
    });
  } catch (err) {
    logger.error("Failed to parse packaged-media-json:", err);
  }
}

export async function getHLSVideoUrl(m3u8Url: string) {
  const ffmpeg = await createFFmpeg();

  const [videoUrl, audioUrl] = m3u8Url.split(",");

  logger.log("videoUrl", videoUrl);
  logger.log("audioUrl", audioUrl);

  const videoResponse = await fetch(videoUrl.replace(".m3u8", ".ts"));
  const tsFile = new Uint8Array(await videoResponse.arrayBuffer());
  ffmpeg.writeFile("video.ts", tsFile);

  // change m3u8Url to .ts url
  // const tsUrl = m3u8Url.replace(".m3u8", ".ts");
  const audioResponse = await fetch(audioUrl.replace(".m3u8", ".aac"));
  const tsFile2 = new Uint8Array(await audioResponse.arrayBuffer());
  ffmpeg.writeFile("audio.ts", tsFile2);

  console.log("files", await ffmpeg.listDir("."));

  await ffmpeg.exec([
    "-i",
    "video.ts",
    "-i",
    "audio.ts",
    "-c",
    "copy",
    "output.mp4",
  ]);

  const videoData = await ffmpeg.readFile("output.mp4");
  const buffer = new Uint8Array(videoData as unknown as ArrayBuffer);
  const blob = new Blob([buffer], { type: "video/mp4" });
  const objectUrl = URL.createObjectURL(blob);
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
  console.log("getting video url for", mediaElement);

  // First check if there's a direct m3u8 URL (HLS stream)
  const sourceUrl = mediaElement.getAttribute("src");
  if (sourceUrl && sourceUrl.includes(".m3u8")) {
    const url = await getHighestQualityHLS(sourceUrl);
    console.log("found m3u8 url", url);
    return url;
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

export function getSubredditNameFromContainer(container: Element): string {
  try {
    // First try to find the subreddit name anchor tag within the container
    const subredditAnchor = container.querySelector(
      'a[data-testid="subreddit-name"]'
    );

    logger.log("subredditAnchor", subredditAnchor);
    if (subredditAnchor) {
      const span = subredditAnchor.querySelector(":scope > span");
      if (span && span.textContent) {
        const subredditName = span.textContent.trim();
        return subredditName.replace(/^r\//, "");
      }
    }

    // Fallback: extract subreddit from URL when we're on a subreddit page
    const currentUrl = window.location.href;
    const subredditMatch = currentUrl.match(/\/r\/([^\/]+)/);
    if (subredditMatch) {
      logger.log("Extracted subreddit from URL:", subredditMatch[1]);
      return subredditMatch[1];
    }

    logger.warn(
      "Could not determine subreddit name, falling back to 'unknown'"
    );
    return "unknown";
  } catch (error) {
    console.error("Failed to get subreddit name from container:", error);
    return "unknown";
  }
}
