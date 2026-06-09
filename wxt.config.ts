import { defineConfig, WxtViteConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  // Open a Reddit page on `wxt dev` so the content script loads immediately.
  // Points at a Posts search page for testing search-result downloads.
  webExt: {
    startUrls: ["https://www.reddit.com"],
  },
  manifest: ({ browser }) => ({
    name: "Downloader for Reddit - RedditGrab",
    description:
      "Download images and videos from Reddit posts (including Redgifs)",
    // version is auto-read from package.json by WXT
    permissions: [
      "downloads",
      "activeTab",
      "storage",
      "tabs",
      ...(browser === "chrome" ? ["offscreen"] : []),
    ],
    host_permissions: [
      "*://*.reddit.com/*",
      "*://*.redd.it/*",
      "*://*.redgifs.com/*",
      "*://api.redgifs.com/*",
    ],
    // Explicit Gecko ID avoids Firefox reporting a signed XPI as corrupt when
    // Guid from AMO API: https://addons.mozilla.org/api/v5/addons/addon/media-downloader-redditgrab/
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              id: "{d6ae963b-906b-4ebe-9d91-ef1cb6f770c9}",
            },
          },
        }
      : {}),
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
      sandbox:
        "sandbox allow-scripts allow-forms allow-popups allow-modals; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'; child-src 'self';",
    },
    web_accessible_resources: [
      {
        matches: ["<all_urls>"],
        resources: ["ffmpeg/*"],
      },
    ],
    // Enable extension icon click without popup (MV3)
    action: {},
    // Enable extension icon click for MV2
    browser_action: {},
  }),
  vite: () =>
    ({
      plugins: [tailwindcss(), wasm(), topLevelAwait()],
      optimizeDeps: {
        exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
      },
      server: {
        headers: {
          "Cross-Origin-Opener-Policy": "same-origin",
          "Cross-Origin-Embedder-Policy": "require-corp",
        },
      },
    }) as WxtViteConfig,
});
