import type { Scraper } from "../types";
import { genericExtract } from "../base";

// City of Pleasanton official calendar — civic + recreation events.
export const cityOfPleasanton: Scraper = {
  key: "city-of-pleasanton",
  defaultCategory: "community",
  extract: (ctx) =>
    genericExtract(ctx, {
      defaultCategory: "community",
      containerSelector: "[class*='event'], .calendar-item, li.calendar__item",
    }),
};
