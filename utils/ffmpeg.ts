import { FFmpeg } from "@ffmpeg/ffmpeg";
import { logger } from "./logger";

import workerURL from "@ffmpeg/ffmpeg/worker?worker&url";
import { createOffscreenDocument } from "@/utils/offscreen-media-download";
import { onMessage, sendMessage } from "webext-bridge/background";

const FFMPEG_OPTIONS = {
  coreURL: browser.runtime.getURL("/ffmpeg/ffmpeg-core.js"),
  wasmURL: browser.runtime.getURL("/ffmpeg/ffmpeg-core.wasm"),
  workerURL: browser.runtime.getURL("/ffmpeg/ffmpeg-core.worker.js"),
  classWorkerURL: new URL(workerURL, import.meta.url).href,
};

export const createFFmpeg = async () => {
  logger.log("Creating ffmpeg");
  const ffmpeg = new FFmpeg();

  await ffmpeg.load(FFMPEG_OPTIONS);

  ffmpeg.on("log", (message) => {
    logger.log("FFmpeg log:", message);
  });

  logger.log("Loaded ffmpeg");

  return ffmpeg;
};
