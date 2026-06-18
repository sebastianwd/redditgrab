import { FFmpeg } from "@ffmpeg/ffmpeg";
import { logger } from "./logger";

import workerURL from "@ffmpeg/ffmpeg/worker?worker&url";

const FFMPEG_OPTIONS = {
  coreURL: browser.runtime.getURL("/ffmpeg/ffmpeg-core.js"),
  wasmURL: browser.runtime.getURL("/ffmpeg/ffmpeg-core.wasm"),
  workerURL: browser.runtime.getURL("/ffmpeg/ffmpeg-core.worker.js"),
  classWorkerURL: new URL(workerURL, import.meta.url).href,
};

// Reuse a single ffmpeg instance. Creating a new one per download reloads the
// ~30MB wasm core and allocates a fresh WASM heap each time; in a mass download
// that churn OOMs Chrome's offscreen renderer (the "extension crashed" toast).
let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading: Promise<FFmpeg> | null = null;

export const createFFmpeg = async (): Promise<FFmpeg> => {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoading) return ffmpegLoading;

  ffmpegLoading = (async () => {
    logger.log("Creating ffmpeg");
    const ffmpeg = new FFmpeg();
    ffmpeg.on("log", (message) => {
      logger.log("FFmpeg log:", message);
    });
    await ffmpeg.load(FFMPEG_OPTIONS);
    logger.log("Loaded ffmpeg");
    ffmpegInstance = ffmpeg;
    ffmpegLoading = null;
    return ffmpeg;
  })();

  return ffmpegLoading;
};
