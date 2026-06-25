import type { Scraper } from "../types";
import { genericExtract } from "../base";

// Eventbrite Pleasanton listings. Eventbrite embeds rich schema.org Event
// JSON-LD on its discovery pages, so the generic JSON-LD path handles it well.
export const eventbrite: Scraper = {
  key: "eventbrite",
  defaultCategory: "other",
  extract: (ctx) => genericExtract(ctx, { defaultCategory: "other" }),
};
