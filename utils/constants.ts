export const Selectors = {
  VIDEO_PLAYER: "shreddit-player-2",
  SINGLE_IMAGE: "shreddit-media-lightbox-listener",
  GALLERY_CAROUSEL: "gallery-carousel",
  REDGIFS_EMBED: "shreddit-embed[providername='RedGIFs']",
};

export const OFFSCREEN_DOCUMENT_PATH = "/offscreen.html";

export const MESSAGE_TARGET = {
  OFFSCREEN: "offscreen",
  BACKGROUND: "background",
} as const;
export const OFFSCREEN_KEYS = {
  DOWNLOAD_VIDEO: "download_video",
  DOWNLOAD_IMAGE: "download_image",
} as const;
