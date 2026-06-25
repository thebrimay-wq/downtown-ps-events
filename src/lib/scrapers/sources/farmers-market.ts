import type { Scraper } from "../types";
import { genericExtract } from "../base";

// PCFMA Pleasanton Farmers Market — recurring weekly market.
export const farmersMarket: Scraper = {
  key: "farmers-market",
  defaultCategory: "market",
  extract: (ctx) =>
    genericExtract(ctx, { defaultCategory: "market" }).map((e) => ({
      ...e,
      category: "market",
      is_family_friendly: true,
    })),
};
