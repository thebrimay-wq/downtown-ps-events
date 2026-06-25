import type { EventCategory, EventRecord, Source } from "./types";

// ----------------------------------------------------------------------------
// Bundled demo data. Used automatically whenever Supabase is not configured so
// the entire site is browsable with zero setup. Once Supabase env vars are set,
// the data layer reads from the database instead and ignores everything here.
// ----------------------------------------------------------------------------

export const MOCK_CATEGORIES: EventCategory[] = [
  { id: "c-music", slug: "music", name: "Live Music", icon: "🎵", color: "#d9791f", sort_order: 10 },
  { id: "c-arts", slug: "arts", name: "Arts & Culture", icon: "🎨", color: "#9d4a1a", sort_order: 20 },
  { id: "c-food", slug: "food-drink", name: "Food & Drink", icon: "🍷", color: "#c0611a", sort_order: 30 },
  { id: "c-family", slug: "family", name: "Family & Kids", icon: "🧸", color: "#e3923a", sort_order: 40 },
  { id: "c-market", slug: "market", name: "Markets", icon: "🧺", color: "#7f3c1c", sort_order: 50 },
  { id: "c-community", slug: "community", name: "Community", icon: "🤝", color: "#68331b", sort_order: 60 },
  { id: "c-sports", slug: "sports", name: "Sports & Fitness", icon: "🏃", color: "#d9791f", sort_order: 70 },
  { id: "c-festival", slug: "festival", name: "Festivals", icon: "🎪", color: "#c0611a", sort_order: 80 },
  { id: "c-education", slug: "education", name: "Education", icon: "📚", color: "#9d4a1a", sort_order: 90 },
  { id: "c-nightlife", slug: "nightlife", name: "Nightlife", icon: "🌙", color: "#7f3c1c", sort_order: 100 },
  { id: "c-other", slug: "other", name: "Other", icon: "📌", color: "#8e8e93", sort_order: 999 },
];

export const MOCK_SOURCES: Source[] = [
  { id: "s-pda", slug: "pleasanton-downtown", name: "Pleasanton Downtown Association", url: "https://www.pleasantondowntown.net/events", website: "https://www.pleasantondowntown.net", scraper_key: "pleasanton-downtown", strategy: "cheerio", enabled: true, last_status: "ok" },
  { id: "s-fm", slug: "farmers-market", name: "Pleasanton Farmers Market", url: "https://www.pcfma.org/markets/pleasanton", website: "https://www.pcfma.org", scraper_key: "farmers-market", strategy: "cheerio", enabled: true, last_status: "ok" },
  { id: "s-city", slug: "city-of-pleasanton", name: "City of Pleasanton", url: "https://www.cityofpleasantonca.gov/news/events.php", website: "https://www.cityofpleasantonca.gov", scraper_key: "city-of-pleasanton", strategy: "cheerio", enabled: true, last_status: "ok" },
  { id: "s-hac", slug: "hacienda", name: "Hacienda Business Park", url: "https://www.hacienda.org/events", website: "https://www.hacienda.org", scraper_key: "hacienda", strategy: "cheerio", enabled: true, last_status: "ok" },
  { id: "s-eb", slug: "eventbrite-pleasanton", name: "Eventbrite — Pleasanton", url: "https://www.eventbrite.com/d/ca--pleasanton/events/", website: "https://www.eventbrite.com", scraper_key: "eventbrite", strategy: "cheerio", enabled: true, last_status: "ok" },
  { id: "s-bit", slug: "bandsintown-pleasanton", name: "Bandsintown — Pleasanton", url: "https://www.bandsintown.com/c/pleasanton-ca", website: "https://www.bandsintown.com", scraper_key: "bandsintown", strategy: "cheerio", enabled: true, last_status: "ok" },
  { id: "s-pw", slug: "pleasanton-weekly", name: "Pleasanton Weekly Calendar", url: "https://www.pleasantonweekly.com/calendar/", website: "https://www.pleasantonweekly.com", scraper_key: "pleasanton-weekly", strategy: "cheerio", enabled: true, last_status: "ok" },
];

interface Seed {
  title: string;
  description: string;
  // day offset from "today" (local), and start hour (24h)
  dayOffset: number;
  startHour: number;
  durationHrs: number;
  venue: string;
  address: string;
  category: string;
  price: string;
  is_free: boolean;
  family: boolean;
  image_url: string;
  ticket_url?: string;
  source: Source;
  tags: string[];
}

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=70`;

const SEEDS: Seed[] = [
  {
    title: "First Wednesday Street Party",
    description:
      "Downtown Pleasanton's signature summer block party returns to Main Street with live bands on three stages, dozens of food and craft vendors, a beer & wine garden, and a buzzing kids' zone. Main Street closes to cars and fills with thousands of neighbors for the city's most beloved evening of the month.",
    dayOffset: 0, startHour: 18, durationHrs: 4,
    venue: "Main Street", address: "Main Street, Pleasanton, CA 94566",
    category: "festival", price: "Free", is_free: true, family: true,
    image_url: img("photo-1533174072545-7a4b6ad7a6c3"),
    source: MOCK_SOURCES[0], tags: ["downtown", "street party", "live music"],
  },
  {
    title: "Pleasanton Farmers Market",
    description:
      "Shop the freshest seasonal produce, artisan breads, local honey, flowers, and prepared foods from California growers and makers. A Saturday-morning tradition for the whole family on West Angela Street.",
    dayOffset: daysUntilWeekday(6), startHour: 9, durationHrs: 4,
    venue: "W Angela St & First St", address: "W Angela St, Pleasanton, CA 94566",
    category: "market", price: "Free", is_free: true, family: true,
    image_url: img("photo-1488459716781-31db52582fe9"),
    source: MOCK_SOURCES[1], tags: ["farmers market", "local", "produce"],
  },
  {
    title: "Concerts in the Park: The Sun Kings",
    description:
      "Bring a blanket and a picnic to Lions Wayside Park for a free outdoor tribute concert under the oaks. A laid-back summer evening of music for all ages.",
    dayOffset: daysUntilWeekday(5), startHour: 19, durationHrs: 2,
    venue: "Lions Wayside Park", address: "Neal St & First St, Pleasanton, CA 94566",
    category: "music", price: "Free", is_free: true, family: true,
    image_url: img("photo-1470229722913-7c0e2dbbafd3"),
    source: MOCK_SOURCES[0], tags: ["concert", "outdoor", "tribute"],
  },
  {
    title: "Firehouse Arts Center: An Evening of Jazz",
    description:
      "An intimate evening of standards and original compositions in the beautifully restored Firehouse Arts Center theater. Doors open 30 minutes before showtime.",
    dayOffset: daysUntilWeekday(6), startHour: 20, durationHrs: 2,
    venue: "Firehouse Arts Center", address: "4444 Railroad Ave, Pleasanton, CA 94566",
    category: "arts", price: "$25-$45", is_free: false, family: false,
    image_url: img("photo-1415201364774-f6f0bb35f28f"),
    ticket_url: "https://www.firehousearts.org",
    source: MOCK_SOURCES[6], tags: ["jazz", "theater", "live music"],
  },
  {
    title: "Wine Stroll on Main",
    description:
      "Sip your way through historic downtown with a souvenir glass and tasting passport. Local wineries pour at participating shops and galleries along Main Street. 21+.",
    dayOffset: daysUntilWeekday(5), startHour: 17, durationHrs: 4,
    venue: "Downtown Main Street", address: "Main Street, Pleasanton, CA 94566",
    category: "food-drink", price: "$45", is_free: false, family: false,
    image_url: img("photo-1510812431401-41d2bd2722f3"),
    ticket_url: "https://www.pleasantondowntown.net",
    source: MOCK_SOURCES[0], tags: ["wine", "21+", "downtown"],
  },
  {
    title: "Storytime at the Library",
    description:
      "Songs, rhymes, and picture books for toddlers and preschoolers at the Pleasanton Public Library. A gentle, free morning program that builds early literacy and lots of giggles.",
    dayOffset: 1, startHour: 10, durationHrs: 1,
    venue: "Pleasanton Public Library", address: "400 Old Bernal Ave, Pleasanton, CA 94566",
    category: "family", price: "Free", is_free: true, family: true,
    image_url: img("photo-1503676260728-1c00da094a0b"),
    source: MOCK_SOURCES[2], tags: ["kids", "library", "storytime"],
  },
  {
    title: "Hacienda Food Truck Friday",
    description:
      "A rotating lineup of the Bay Area's best food trucks rolls into the Hacienda business park for lunch. Grab tacos, banh mi, BBQ, and dessert with coworkers and neighbors.",
    dayOffset: daysUntilWeekday(5), startHour: 11, durationHrs: 3,
    venue: "Hacienda Business Park", address: "4305 Hacienda Dr, Pleasanton, CA 94588",
    category: "food-drink", price: "Free entry", is_free: true, family: true,
    image_url: img("photo-1565299624946-b28f40a041d3"),
    source: MOCK_SOURCES[3], tags: ["food trucks", "lunch", "hacienda"],
  },
  {
    title: "Pleasanton Half Marathon & 5K",
    description:
      "Run scenic routes through the Pleasanton ridgelands and downtown. Chip-timed half marathon, 10K, and a family-friendly 5K, with a finish-line festival, music, and local vendors.",
    dayOffset: daysUntilWeekday(0) + 7, startHour: 7, durationHrs: 4,
    venue: "Pleasanton Sports Park", address: "5800 Parkside Dr, Pleasanton, CA 94588",
    category: "sports", price: "$40-$95", is_free: false, family: true,
    image_url: img("photo-1452626038306-9aae5e071dd3"),
    ticket_url: "https://www.cityofpleasantonca.gov",
    source: MOCK_SOURCES[2], tags: ["running", "race", "fitness"],
  },
  {
    title: "Museum on Main: Pleasanton History Talk",
    description:
      "A guided evening lecture exploring the Tri-Valley's ranching and railroad past, featuring rare photographs from the Museum on Main archive.",
    dayOffset: 3, startHour: 19, durationHrs: 1,
    venue: "Museum on Main", address: "603 Main St, Pleasanton, CA 94566",
    category: "education", price: "$10", is_free: false, family: false,
    image_url: img("photo-1551818255-e6e10975bc17"),
    source: MOCK_SOURCES[6], tags: ["history", "lecture", "museum"],
  },
  {
    title: "Friday Night Live at McKay's Taphouse",
    description:
      "Local rock and blues acts take the stage at this downtown taphouse with 40+ beers on tap. Late-night vibes, no cover.",
    dayOffset: daysUntilWeekday(5), startHour: 21, durationHrs: 3,
    venue: "McKay's Taphouse & Beer Garden", address: "252 Main St, Pleasanton, CA 94566",
    category: "nightlife", price: "Free", is_free: true, family: false,
    image_url: img("photo-1514525253161-7a46d19cd819"),
    source: MOCK_SOURCES[5], tags: ["nightlife", "beer", "live music"],
  },
  {
    title: "Alameda County Fairgrounds Craft Fair",
    description:
      "A weekend of handmade goods, vintage finds, and artisan food at the historic Alameda County Fairgrounds. Hundreds of vendors across multiple halls.",
    dayOffset: daysUntilWeekday(6), startHour: 10, durationHrs: 6,
    venue: "Alameda County Fairgrounds", address: "4501 Pleasanton Ave, Pleasanton, CA 94566",
    category: "festival", price: "$8", is_free: false, family: true,
    image_url: img("photo-1492684223066-81342ee5ff30"),
    ticket_url: "https://www.eventbrite.com",
    source: MOCK_SOURCES[4], tags: ["craft fair", "shopping", "fairgrounds"],
  },
  {
    title: "Community Yoga in the Park",
    description:
      "Start your weekend with a free all-levels outdoor yoga flow on the lawn. Bring a mat and water; instructors provided by local studios.",
    dayOffset: daysUntilWeekday(6), startHour: 8, durationHrs: 1,
    venue: "Delucchi Park", address: "4501 First St, Pleasanton, CA 94566",
    category: "sports", price: "Free", is_free: true, family: true,
    image_url: img("photo-1506126613408-eca07ce68773"),
    source: MOCK_SOURCES[2], tags: ["yoga", "wellness", "outdoor"],
  },
  {
    title: "Teen Maker Lab: Robotics Night",
    description:
      "Hands-on robotics and coding for teens at the library makerspace. Build, program, and battle small bots. No experience required; all materials provided.",
    dayOffset: 2, startHour: 16, durationHrs: 2,
    venue: "Pleasanton Public Library", address: "400 Old Bernal Ave, Pleasanton, CA 94566",
    category: "education", price: "Free", is_free: true, family: true,
    image_url: img("photo-1485827404703-89b55fcc595e"),
    source: MOCK_SOURCES[2], tags: ["teens", "robotics", "stem"],
  },
  {
    title: "Downtown Art Walk",
    description:
      "Galleries and shops stay open late for a self-guided evening art walk featuring local painters, photographers, and live demonstrations.",
    dayOffset: 4, startHour: 18, durationHrs: 3,
    venue: "Downtown Pleasanton", address: "Main Street, Pleasanton, CA 94566",
    category: "arts", price: "Free", is_free: true, family: true,
    image_url: img("photo-1460661419201-fd4cecdf8a8b"),
    source: MOCK_SOURCES[0], tags: ["art walk", "galleries", "downtown"],
  },
  {
    title: "Tri-Valley Farmers & Makers Night Market",
    description:
      "An evening market with twinkle lights, live acoustic music, street food, and local makers. A relaxed way to shop and stroll after the sun goes down.",
    dayOffset: 6, startHour: 17, durationHrs: 4,
    venue: "Hacienda Business Park", address: "4305 Hacienda Dr, Pleasanton, CA 94588",
    category: "market", price: "Free", is_free: true, family: true,
    image_url: img("photo-1555396273891-d02c3c6f2dc8"),
    source: MOCK_SOURCES[3], tags: ["night market", "makers", "food"],
  },
];

// Returns the number of days from today (local) until the next given weekday
// (0=Sun ... 6=Sat). 0 if today already is that weekday.
function daysUntilWeekday(weekday: number): number {
  const today = new Date().getDay();
  return (weekday - today + 7) % 7;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Builds the mock events relative to the current date so "Today" and
// "This weekend" always have something to show.
export function getMockEvents(): EventRecord[] {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return SEEDS.map((seed, i) => {
    const start = new Date(base);
    start.setDate(start.getDate() + seed.dayOffset);
    start.setHours(seed.startHour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + seed.durationHrs);

    return {
      id: `mock-${i + 1}`,
      title: seed.title,
      slug: `${slugify(seed.title)}-${i + 1}`,
      description: seed.description,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      venue: seed.venue,
      address: seed.address,
      category: seed.category,
      tags: seed.tags,
      price: seed.price,
      is_free: seed.is_free,
      is_family_friendly: seed.family,
      image_url: seed.image_url,
      ticket_url: seed.ticket_url ?? null,
      source_id: seed.source.id,
      source_url: seed.source.website ?? seed.source.url,
      source_name: seed.source.name,
      status: "approved" as const,
      origin: "scraper" as const,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
  });
}
