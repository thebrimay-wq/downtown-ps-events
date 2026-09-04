"""Round 2: gap-filling crawl for sources that needed different URLs / JS."""
import datetime as dt
from worklist import TODAY, END, MONTH_NAMES, months_ahead

def build():
    w = []
    def add(key, group, name, url, parser, js=False):
        w.append(dict(key=key, group=group, source=name, url=url, parser=parser, js=js))

    # Pleasanton Weekly community calendar — real pagination is #!/show?start=YYYY-MM-DD
    for i in range(0, 366, 4):
        d = TODAY + dt.timedelta(days=i)
        add(f"pw2-{d}", "aggregator", "Pleasanton Weekly",
            f"https://www.pleasantonweekly.com/calendar/#!/show?start={d}", "pweekly", js=True)

    # Bankhead Theater / Livermore Valley Arts — month-by-month
    for y, m in months_ahead(13):
        add(f"bankhead-{y}-{m:02d}", "arts", "Bankhead Theater",
            f"https://livermorearts.org/event-calendar/?month={MONTH_NAMES[m-1]}+{y}", "bankhead", js=True)

    # Vibe Tri-Valley (all events, paginated)
    add("vibe2-1", "aggregator", "Visit Tri-Valley", "https://vibetrivalley.com/", "vibe", js=True)
    for p in range(2, 10):
        add(f"vibe2-{p}", "aggregator", "Visit Tri-Valley",
            f"https://vibetrivalley.com/?tribe_paged={p}", "vibe", js=True)
    for p in range(2, 7):
        add(f"vtv-{p}", "aggregator", "Visit Tri-Valley",
            f"https://www.visittrivalley.com/events/page/{p}/", "vibe", js=True)

    # City of Pleasanton calendar + recreation + library (JS calendars)
    add("city-cal2", "city", "City of Pleasanton", "https://www.cityofpleasantonca.gov/calendar/", "generic", js=True)
    for y, m in months_ahead(6):
        add(f"city-cal-{y}-{m:02d}", "city", "City of Pleasanton",
            f"https://www.cityofpleasantonca.gov/calendar/?month={m}&yr={y}", "generic", js=True)
    add("plfun2", "city", "Pleasanton Recreation", "https://www.pleasantonfun.com/events", "generic", js=True)
    add("library2", "library", "Pleasanton Public Library",
        "https://www.cityofpleasantonca.gov/residents/library/library-programs-events/", "generic", js=True)

    # Museum on Main — real events page
    add("museum2", "arts", "Museum on Main", "https://www.museumonmain.org/events.html", "generic", js=True)

    # Ruby Hill Winery (Pleasanton) — JS-rendered events
    add("rubyhill2", "winery", "Ruby Hill Winery", "https://rubyhillwinery.net/events/", "generic", js=True)

    # Bandsintown concerts in Pleasanton
    add("bandsintown2", "aggregator", "Bandsintown — Pleasanton",
        "https://www.bandsintown.com/c/pleasanton-ca", "jsonld", js=True)

    # Hacienda business park — find the live events path
    add("hacienda3", "shopping", "Hacienda Business Park", "https://www.hacienda.org/", "generic", js=True)

    # Chamber of commerce calendar
    add("chamber2", "downtown", "Pleasanton Chamber of Commerce",
        "https://business.pleasanton.org/events/calendar", "generic", js=True)

    # Farmers markets (PCFMA) — Pleasanton weekly market
    add("pcfma2", "downtown", "Pleasanton Farmers Market",
        "https://www.pcfma.org/market/pleasanton-farmers-market", "generic", js=True)

    # DoTheBay — Pleasanton venue + city listings
    for p in range(1, 4):
        add(f"dtb-{p}", "aggregator", "DoTheBay — Pleasanton",
            f"https://dothebay.com/events?page={p}&utf8=%E2%9C%93&q=pleasanton", "dothebay", js=True)
    for v in ["main-street-brewery", "alameda-county-fairgrounds", "firehouse-arts-center",
              "sabio-on-main", "the-hop-yard", "inklings-coffee-tea"]:
        add(f"dtbv-{v}", "restaurant", "DoTheBay — Pleasanton venues",
            f"https://dothebay.com/venues/{v}", "dothebay", js=True)

    # Eventbrite deeper pages for Pleasanton
    for p in range(1, 9):
        add(f"eb2-{p}", "aggregator", "Eventbrite — Pleasanton",
            f"https://www.eventbrite.com/d/ca--pleasanton/all-events/?page={p}", "jsonld", js=True)

    # AllEvents categories
    for cat in ["music", "food-drink", "arts", "workshops", "sports", "festivals", "family"]:
        add(f"ae-{cat}", "aggregator", "AllEvents — Pleasanton",
            f"https://allevents.in/pleasanton/{cat}", "jsonld", js=True)

    return w

if __name__ == "__main__":
    print(len(build()), "urls")
