import { Icon } from "@iconify/react";

export function Changelog() {
  return (
    <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
        <Icon
          icon="lucide:sparkles"
          className="w-4 h-4 mr-2 text-orange-500"
        />
        What's new
      </h3>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Icon
            icon="lucide:search"
            className="w-4 h-4 text-orange-500 flex-shrink-0"
          />
          <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
            Download from search results
          </span>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-400">
          Mass Download now works on Reddit search, both the Posts and Media
          tabs. Run it on any search and it grabs images, galleries, videos, and
          RedGifs from the results at full resolution.
        </p>

        <p className="text-xs text-gray-600 dark:text-gray-400">
          Enable{" "}
          <span className="font-medium text-gray-800 dark:text-gray-200">
            Show downloaded markers
          </span>{" "}
          above to put a green check on posts you've already saved, on feeds and
          search alike. See the FAQ below for what the markers look like.
        </p>
      </div>
    </div>
  );
}
