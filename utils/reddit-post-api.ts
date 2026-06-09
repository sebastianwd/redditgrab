import type { MediaContentType } from "@/types";
import { getHighestQualityHLS } from "./media-download";
import { logger } from "./logger";
import { format, fromUnixTime } from "date-fns";

/**
 * Search results expose only a thumbnail for videos, redgifs, and single images
 * (galleries are the exception, handled from the DOM carousel). To download full
 * media for those types we fetch the post's own data and read the media URLs.
 *
 * The bare `comments/<id>.json` path redirects to HTML; the trailing-slash form
 * with `raw_json=1` returns clean JSON with un-escaped URLs.
 */

type PostApiMedia = {
  type: MediaContentType;
  urls: string[];
  subredditName: string;
  postTitle: string;
  postAuthor: string;
  postDate: string;
};

/** Reddit's post JSON is loosely typed; we only read a handful of fields. */
type RedditPostData = {
  subreddit?: string;
  title?: string;
  author?: string;
  created_utc?: number;
  domain?: string;
  post_hint?: string;
  is_video?: boolean;
  is_gallery?: boolean;
  url?: string;
  media?: RedditMedia;
  secure_media?: RedditMedia;
  media_metadata?: Record<string, { s?: { u?: string; gif?: string } }>;
  gallery_data?: { items?: { media_id: string }[] };
};

type RedditMedia = {
  reddit_video?: { hls_url?: string };
  oembed?: { provider_name?: string; html?: string };
};

const extractRedgifsId = (
  oembedHtml?: string,
  url?: string,
): string | null => {
  const fromHtml = oembedHtml?.match(/redgifs\.com\/ifr\/([^"?&/]+)/);
  if (fromHtml) return fromHtml[1];
  const fromUrl = url?.match(/redgifs\.com\/(?:watch|ifr)\/([^/?#]+)/i);
  if (fromUrl) return fromUrl[1];
  return null;
};

const extractMediaUrls = async (
  post: RedditPostData,
): Promise<{ type: MediaContentType; urls: string[] } | null> => {
  const media = post.media ?? post.secure_media;
  const oembedHtml = media?.oembed?.html;
  const provider = media?.oembed?.provider_name;

  // RedGIFs: build the HD m3u8 from the embed id (matches the DOM path output).
  if (post.domain === "redgifs.com" || provider === "RedGIFs") {
    const id = extractRedgifsId(oembedHtml, post.url);
    if (id) {
      return {
        type: "video",
        urls: [`https://api.redgifs.com/v2/gifs/${id}/hd.m3u8`],
      };
    }
    logger.warn("RedGIFs post without resolvable id, skipping");
    return null;
  }

  // Reddit-hosted video: resolve the master HLS to the highest-quality
  // video+audio media playlists, exactly like the on-page video path does.
  const redditVideo = media?.reddit_video;
  if (post.is_video && redditVideo?.hls_url) {
    const processed = await getHighestQualityHLS(redditVideo.hls_url);
    return { type: "video", urls: [processed] };
  }

  // Single image: `url` is the full-resolution i.redd.it original.
  if (
    (post.post_hint === "image" || post.domain === "i.redd.it") &&
    typeof post.url === "string" &&
    post.url
  ) {
    return { type: "single-image", urls: [post.url] };
  }

  // Gallery fallback (the DOM carousel normally covers this).
  if (post.is_gallery && post.media_metadata && post.gallery_data?.items) {
    const urls = post.gallery_data.items
      .map((item) => {
        const meta = post.media_metadata?.[item.media_id]?.s;
        return meta?.u || meta?.gif;
      })
      .filter((u): u is string => Boolean(u))
      .map((u) => u.replace(/&amp;/g, "&"));
    if (urls.length > 0) return { type: "multiple-images", urls };
  }

  return null;
};

/**
 * Fetch full media for a post by its thing id. Returns null for unsupported
 * media (external hosts, text posts) or on any fetch/parse failure.
 */
export const fetchPostMedia = async (
  thingId: string,
): Promise<PostApiMedia | null> => {
  const id = thingId.replace(/^t3_/, "");

  let post: RedditPostData | undefined;
  try {
    const res = await fetch(
      `https://www.reddit.com/comments/${id}/.json?raw_json=1`,
      { credentials: "include" },
    );
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || !contentType.includes("json")) {
      logger.warn(
        `Post JSON unavailable for ${id} (status ${res.status}, ${contentType})`,
      );
      return null;
    }
    const json = await res.json();
    post = json?.[0]?.data?.children?.[0]?.data;
  } catch (error) {
    logger.warn(`Failed to fetch post JSON for ${id}`, error);
    return null;
  }

  if (!post) return null;

  let media: { type: MediaContentType; urls: string[] } | null;
  try {
    media = await extractMediaUrls(post);
  } catch (error) {
    logger.warn(`Failed to extract media for ${id}`, error);
    return null;
  }
  if (!media || media.urls.length === 0) return null;

  return {
    ...media,
    subredditName: post.subreddit || "unknown",
    postTitle: post.title || "",
    postAuthor: post.author || "unknown-user",
    postDate: post.created_utc
      ? format(fromUnixTime(post.created_utc), "yyyy-MM-dd")
      : "",
  };
};
