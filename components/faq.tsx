import { Icon } from "@iconify/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function FAQ() {
  return (
    <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
        <Icon icon="lucide:help-circle" className="w-4 h-4 mr-2" />
        Frequently Asked Questions
      </h3>

      <Accordion type="multiple" className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger className="text-xs font-medium text-gray-800 dark:text-gray-200 hover:no-underline">
            <div className="flex items-center space-x-2">
              <Icon
                icon="lucide:download"
                className="w-4 h-4 text-orange-500 flex-shrink-0"
              />
              <span>Can I download individual post media?</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Yes! Look for the{" "}
                <span className="font-medium text-orange-600 dark:text-orange-400">
                  Download
                </span>{" "}
                button that appears on each post. Click it to download just that
                post's media.
              </p>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <div className="text-center">
                  <img
                    src="/example-post.png"
                    alt="Example Reddit post showing Download button"
                    className="w-full max-w-sm mx-auto rounded-lg shadow-sm border border-gray-300 dark:border-gray-600"
                  />
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-2">
          <AccordionTrigger className="text-xs font-medium text-gray-800 dark:text-gray-200 hover:no-underline">
            <div className="flex items-center space-x-2">
              <Icon
                icon="lucide:settings"
                className="w-4 h-4 text-blue-500 flex-shrink-0"
              />
              <span>How do I customize download settings?</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Use the settings above to change download folder, filename
              patterns, and other options. Changes are saved automatically.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-3">
          <AccordionTrigger className="text-xs font-medium text-gray-800 dark:text-gray-200 hover:no-underline">
            <div className="flex items-center space-x-2">
              <Icon
                icon="lucide:folder"
                className="w-4 h-4 text-green-500 flex-shrink-0"
              />
              <span>Where are files downloaded?</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Files are saved to your default Downloads folder, organized by the
                folder pattern you set above.
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  Tip:
                </span>{" "}
                Browsers usually keep saves under your default Downloads folder.
                For another drive or NAS, point Downloads at that location in your
                browser or OS, or put a symlink inside Downloads that targets the
                folder you want.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-4">
          <AccordionTrigger className="text-xs font-medium text-gray-800 dark:text-gray-200 hover:no-underline">
            <div className="flex items-center space-x-2">
              <Icon
                icon="lucide:badge-check"
                className="w-4 h-4 text-green-600 flex-shrink-0"
              />
              <span>What do the green check and blue border mean?</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                The{" "}
                <span className="font-medium text-green-600 dark:text-green-400">
                  green corner check
                </span>{" "}
                marks posts you've already downloaded, on both feeds and search
                results. It's off by default, turn on{" "}
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  Show downloaded markers
                </span>{" "}
                in the settings above to enable it.
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                During a mass download the{" "}
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  blue border
                </span>{" "}
                shows which post is being grabbed right now as the page
                auto-scrolls.
              </p>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                <div className="text-center">
                  <img
                    src="/search-feature.png"
                    alt="Green downloaded check and blue downloading border on Reddit search results"
                    className="w-full max-w-sm mx-auto rounded-lg shadow-sm border border-gray-300 dark:border-gray-600"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="item-5">
          <AccordionTrigger className="text-xs font-medium text-gray-800 dark:text-gray-200 hover:no-underline">
            <div className="flex items-center space-x-2">
              <Icon
                icon="lucide:search"
                className="w-4 h-4 text-orange-500 flex-shrink-0"
              />
              <span>Can I download from search results?</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Yes. Open a Reddit search on the{" "}
              <span className="font-medium text-gray-800 dark:text-gray-200">
                Posts
              </span>{" "}
              or{" "}
              <span className="font-medium text-gray-800 dark:text-gray-200">
                Media
              </span>{" "}
              tab and hit Start Mass Download. It grabs images, galleries,
              videos, and RedGifs from the results at full resolution.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
