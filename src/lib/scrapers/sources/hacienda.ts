import type { Scraper } from "../types";
import { genericExtract } from "../base";

// Hacienda business park community event calendar.
export const hacienda: Scraper = {
  key: "hacienda",
  defaultCategory: "community",
  extract: (ctx) => genericExtract(ctx, { defaultCategory: "community" }),
};
