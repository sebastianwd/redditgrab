import { type } from "arktype";
import { endOfDay, parseISO } from "date-fns";

// Define date constraints using ArkType's date features
const redditFoundingDate = parseISO("2005-06-23").valueOf();
const endOfToday = endOfDay(new Date()).valueOf();

export const SettingsSchema = type({
  folderDestination: "string",
  filenamePattern: "string",
  useGalleryFolders: "boolean",
  addTitleToImages: "boolean",
  addTitleToVideos: "boolean",
  markDownloadedAsVisited: "boolean",
  useDateRange: "boolean",
  // Accept number or undefined for timestamps, validate in pipe
  "dateRangeStart?": "number | undefined",
  "dateRangeEnd?": "number | undefined",
}).narrow((data, ctx) => {
  // Additional validation when useDateRange is true
  if (data.useDateRange) {
    // Validate start date range
    if (data.dateRangeStart !== undefined) {
      if (data.dateRangeStart < redditFoundingDate) {
        return ctx.reject({
          expected: "date after 2005",
          actual: "date too early",
          path: ["dateRangeStart"],
        });
      }
      if (data.dateRangeStart > endOfToday) {
        return ctx.reject({
          expected: "date before today",
          actual: "future date",
          path: ["dateRangeStart"],
        });
      }
    }

    // Validate end date range
    if (data.dateRangeEnd !== undefined) {
      if (data.dateRangeEnd < redditFoundingDate) {
        return ctx.reject({
          expected: "date after 2005",
          actual: "date too early",
          path: ["dateRangeEnd"],
        });
      }
      if (data.dateRangeEnd > endOfToday) {
        return ctx.reject({
          expected: "date before today",
          actual: "future date",
          path: ["dateRangeEnd"],
        });
      }
    }

    // Check if start date is before end date
    if (data.dateRangeStart !== undefined && data.dateRangeEnd !== undefined) {
      if (data.dateRangeStart > data.dateRangeEnd) {
        return ctx.reject({
          message: "Start date must be before end date",
          path: ["dateRangeStart"],
        });
      }
    }
  }

  return true;
});

export type SettingsFormData = typeof SettingsSchema.infer;
