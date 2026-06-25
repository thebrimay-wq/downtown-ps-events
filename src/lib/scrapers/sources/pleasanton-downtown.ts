import type { Scraper } from "../types";
import { genericExtract } from "../base";

// Pleasanton Downtown Association — concerts, street parties, wine strolls.
export const pleasantonDowntown: Scraper = {
  key: "pleasanton-downtown",
  defaultCategory: "community",
  extract: (ctx) => genericExtract(ctx, { defaultCategory: "community" }),
};
