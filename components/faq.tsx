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
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Files are saved to your default Downloads folder, organized by the
              folder pattern you set above.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
