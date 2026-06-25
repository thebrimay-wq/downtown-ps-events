import type { Scraper } from "../types";
import { genericExtract } from "../base";

// Pleasanton Weekly community calendar.
export const pleasantonWeekly: Scraper = {
  key: "pleasanton-weekly",
  defaultCategory: "community",
  extract: (ctx) =>
    genericExtract(ctx, {
      defaultCategory: "community",
      containerSelector: "[class*='event'], [class*='calendar'], article",
    }),
};
