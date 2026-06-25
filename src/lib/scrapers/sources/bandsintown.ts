import type { Scraper } from "../types";
import { genericExtract } from "../base";

// Bandsintown Pleasanton — concert / live music listings. Everything here is
// music by definition.
export const bandsintown: Scraper = {
  key: "bandsintown",
  defaultCategory: "music",
  extract: (ctx) =>
    genericExtract(ctx, { defaultCategory: "music" }).map((e) => ({
      ...e,
      category: "music",
    })),
};
