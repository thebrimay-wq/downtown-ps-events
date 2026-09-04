"""Builds the full crawl work list: (key, group, source_name, url, parser)."""
import datetime as dt

TODAY = dt.date(2026, 9, 2)
END = dt.date(2027, 9, 2)

MONTH_NAMES = ["January","February","March","April","May","June","July",
               "August","September","October","November","December"]

def months_ahead(n=13):
    out, y, m = [], TODAY.year, TODAY.month
    for _ in range(n):
        out.append((y, m))
        m += 1
        if m > 12: m = 1; y += 1
    return out

def build():
    w = []
    def add(key, group, name, url, parser):
        w.append(dict(key=key, group=group, source=name, url=url, parser=parser))

    # --- Firehouse Arts Center: The Events Calendar REST API (full year) ---
    for page in range(1, 6):
        add(f"firehouse-api-{page}", "arts", "Firehouse Arts Center",
            "https://www.firehousearts.org/wp-json/tribe/events/v1/events"
            f"?per_page=50&page={page}&start_date={TODAY}&end_date={END}", "tribe_api")

    # --- Livermore Valley Wine Country: month archives (Pleasanton + Tri-Valley wineries) ---
    for y, m in months_ahead(13):
        add(f"lvwine-{y}-{m:02d}", "winery", "Livermore Valley Wine Country",
            f"https://www.lvwine.org/events/{y}/{m}/{MONTH_NAMES[m-1]}.html", "lvwine")

    # --- Vibe Tri-Valley (engine behind visittrivalley.com/events) ---
    for p in range(1, 13):
        add(f"vibe-{p}", "aggregator", "Visit Tri-Valley",
            f"https://vibetrivalley.com/events/list/?tribe_paged={p}&tribe_event_display=list", "vibe")
    add("visit-trivalley", "aggregator", "Visit Tri-Valley",
        "https://www.visittrivalley.com/events/", "vibe")

    # --- Alameda County Fairgrounds ---
    add("acfair-cal", "fairgrounds", "Alameda County Fairgrounds",
        "https://alamedacountyfair.com/alameda-county-fairgrounds-events-calendar", "acfair")
    add("acfair-home", "fairgrounds", "Alameda County Fairgrounds",
        "https://alamedacountyfair.com/", "jsonld")

    # --- Pleasanton Downtown Association: one page per signature event ---
    for slug in ["saint-patricks-day-brew-crawl", "bunny-hop", "summer-wine-stroll",
                 "hot-rod-row", "thelongesttable", "countryfest", "bubblesandboots",
                 "concert-in-the-park", "forkful", "pleasanton-palooza-2026",
                 "porsches-on-main-2026", "boobash", "halloween-brew-crawl",
                 "magical-holiday-evening", "pleasanton-sweater-and-spirit-stroll",
                 "farmers-market"]:
        add(f"pda-{slug}", "downtown", "Pleasanton Downtown Association",
            f"https://www.pleasantondowntown.net/{slug}", "pda")

    # --- Patch community calendar (next ~4 weeks, day-stepped) ---
    for i in range(0, 60, 7):
        d = TODAY + dt.timedelta(days=i)
        add(f"patch-{d}", "aggregator", "Patch — Pleasanton",
            f"https://patch.com/california/pleasanton/calendar?startDate={d}", "patch")

    # --- Pleasanton Weekly community calendar ---
    for i in range(0, 90, 10):
        d = TODAY + dt.timedelta(days=i)
        add(f"pw-{d}", "aggregator", "Pleasanton Weekly",
            f"https://www.pleasantonweekly.com/calendar/#!/?startDate={d}", "pweekly")

    # --- Eventbrite + AllEvents (schema.org JSON-LD) ---
    for p in range(1, 6):
        add(f"eventbrite-{p}", "aggregator", "Eventbrite — Pleasanton",
            f"https://www.eventbrite.com/d/ca--pleasanton/events/?page={p}", "jsonld")
    for p in range(1, 4):
        add(f"allevents-{p}", "aggregator", "AllEvents — Pleasanton",
            f"https://allevents.in/pleasanton/all?page={p}", "jsonld")

    # --- City of Pleasanton + library + recreation ---
    add("city-calendar", "city", "City of Pleasanton",
        "https://www.cityofpleasantonca.gov/calendar/", "generic")
    add("city-news-events", "city", "City of Pleasanton",
        "https://www.cityofpleasantonca.gov/news/events.php", "generic")
    add("library", "library", "Pleasanton Public Library",
        "https://www.cityofpleasantonca.gov/residents/library/", "generic")
    add("pleasanton-fun", "city", "Pleasanton Recreation",
        "https://www.pleasantonfun.com/", "generic")

    # --- Museums / arts / chamber ---
    add("museum-on-main", "arts", "Museum on Main", "https://www.museumonmain.org/events", "generic")
    add("chamber", "downtown", "Pleasanton Chamber of Commerce", "https://www.pleasanton.org/events/", "generic")
    add("pleasanton-arts", "arts", "Pleasanton Cultural Arts Council", "https://www.pleasantonarts.org/events", "generic")
    add("bankhead", "arts", "Bankhead Theater", "https://livermorearts.org/event-calendar/", "generic")

    # --- Wineries (individual) ---
    add("ruby-hill", "winery", "Ruby Hill Winery", "https://www.rubyhillwinery.net/events", "generic")
    add("mcgrail", "winery", "McGrail Vineyards", "https://www.mcgrailvineyards.com/events", "jsonld")
    add("wente", "winery", "Wente Vineyards", "https://www.wentevineyards.com/events", "generic")
    add("garre", "winery", "Garre Vineyard & Winery", "https://www.garrewinery.com/events/", "generic")
    add("concannon", "winery", "Concannon Vineyard", "https://concannon.wine/events/", "generic")

    # --- Restaurants / bars / breweries ---
    add("sabio", "restaurant", "Sabio on Main", "https://sabiopleasanton.com/", "generic")
    add("inklings", "restaurant", "Inklings Coffee & Tea", "https://inklingscoffee.com/", "generic")
    add("hopyard", "restaurant", "The Hop Yard Alehouse", "https://www.hopyard.com/", "generic")
    add("handles", "restaurant", "Handles Gastropub", "https://www.handlesgastropub.com/", "generic")
    add("mckays", "restaurant", "McKay's Taphouse", "https://www.mckaystaphouse.com/", "generic")
    add("barones", "restaurant", "Barone's Restaurant", "https://www.baronespleasanton.com/", "generic")
    add("blue-agave", "restaurant", "Blue Agave Club", "https://www.blueagaveclub.com/", "generic")
    add("dothebay-msb", "restaurant", "Main Street Brewery",
        "https://dothebay.com/venues/main-street-brewery", "dothebay")
    add("dothebay-pleasanton", "aggregator", "DoTheBay — Pleasanton",
        "https://dothebay.com/events?utf8=%E2%9C%93&q=pleasanton", "dothebay")

    # --- Markets / parks / business parks ---
    add("pcfma", "downtown", "Pleasanton Farmers Market",
        "https://www.pcfma.org/market/pleasanton-farmers-market", "generic")
    add("hacienda", "shopping", "Hacienda Business Park", "https://www.hacienda.org/events", "generic")
    add("stoneridge", "shopping", "Stoneridge Shopping Center",
        "https://www.simon.com/mall/stoneridge-shopping-center/events", "generic")
    add("ebparks-shadow", "community", "Shadow Cliffs Regional Park",
        "https://www.ebparks.org/parks/shadow-cliffs", "generic")
    add("bandsintown", "aggregator", "Bandsintown — Pleasanton",
        "https://www.bandsintown.com/c/pleasanton-ca", "jsonld")

    return w

if __name__ == "__main__":
    w = build()
    print(len(w), "urls")
