import { Icon } from "@iconify/react";

export function SidebarFooter() {
  return (
    <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700">
      <div className="text-center space-y-3">
        <a
          href="https://buymeacoffee.com/sebastianlwdev"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors bg-[#FFDD00] text-gray-900 hover:bg-[#f5d000] dark:bg-[#FFDD00] dark:text-gray-900 dark:hover:bg-[#f5d000] shadow-sm"
        >
          <Icon
            icon="simple-icons:buymeacoffee"
            className="size-5 shrink-0"
          />
          <span>Buy Me a Coffee</span>
        </a>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          RedditGrab v1.0.12
        </p>
        <div className="space-y-1 flex flex-col items-center">
          <a
            href="https://github.com/sebastianwd/redditgrab"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline text-blue-500 hover:text-blue-600 hover:underline transition-colors"
          >
            Source Code
          </a>
          {import.meta.env.BROWSER === "chrome" && (
            <a
              href="https://chromewebstore.google.com/detail/redditgrab/pkjhbflcnjikmfiiojcagjidbjeimkbj?hl=en"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline text-blue-500 hover:text-blue-600 hover:underline transition-colors"
            >
              Rate Extension
            </a>
          )}
          {import.meta.env.BROWSER === "firefox" && (
            <a
              href="https://addons.mozilla.org/en-US/firefox/addon/media-downloader-redditgrab"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline text-blue-500 hover:text-blue-600 hover:underline transition-colors"
            >
              Rate Extension
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
