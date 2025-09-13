import { defineConfig, WxtViteConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: ({ browser }) => ({
    name: "Reddit Media Downloader",
    description: "Download media posts from Reddit subreddit feeds",
    version: "1.0.0",
    permissions: [
      "webRequest",
      "downloads",
      "activeTab",
      "storage",
      "scripting",
      "tabs", // Needed for querying active tab
    ],
    host_permissions: [
      "*://*.reddit.com/*",
      "*://*.redd.it/*",
      "*://*.redgifs.com/*",
      "*://api.redgifs.com/*",
    ],
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
    // WXT automatically handles sidepanel configuration from HTML meta tags
    // Extension icon click opens sidebar directly via background script
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
    } as WxtViteConfig),
});
