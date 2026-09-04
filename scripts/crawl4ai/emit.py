"""Write the crawl results into the repo: dataset + human-readable report."""
import json, os, collections, datetime as dt

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = "/Users/brimay/Documents/Bri May/Github Bri/downtown-ps-events"
DATA = os.path.join(REPO, "data")
os.makedirs(DATA, exist_ok=True)

d = json.load(open(os.path.join(HERE, "events.json")))
events = d["events"]
manifest = json.load(open(os.path.join(HERE, "manifest.json")))

sources = collections.OrderedDict()
for m in manifest:
    s = sources.setdefault(m["source"], dict(name=m["source"], group=m["group"],
                                             urls=0, ok=0, events=0, sample_url=m["url"]))
    s["urls"] += 1
    s["ok"] += 1 if m.get("ok") else 0
for e in events:
    if e["source_name"] in sources:
        sources[e["source_name"]]["events"] += 1

payload = dict(
    generated_at=d["generated_at"],
    window=d["window"],
    totals=dict(
        events=len(events),
        pleasanton=sum(1 for e in events if e["region"] == "Pleasanton"),
        tri_valley=sum(1 for e in events if e["region"] == "Tri-Valley"),
        sources_crawled=len(sources),
        urls_fetched=sum(s["ok"] for s in sources.values()),
    ),
    sources=list(sources.values()),
    events=events,
)
out = os.path.join(DATA, "pleasanton-events.json")
json.dump(payload, open(out, "w"), indent=2, ensure_ascii=False)
print("wrote", out, len(events), "events")

# ---- report ----
by_month = collections.Counter(e["start_at"][:7] for e in events)
by_cat = collections.Counter(e["category"] for e in events)
by_region = collections.Counter(e["region"] for e in events)
lines = []
A = lines.append
A("# Pleasanton event crawl — results\n")
A(f"Crawled {payload['totals']['urls_fetched']} pages across "
  f"{payload['totals']['sources_crawled']} sources on {d['generated_at'][:10]}.")
A(f"Window: **{d['window']['start']} → {d['window']['end']}** "
  f"(the next 12 months). **{len(events)} distinct events** after dedupe "
  f"({payload['totals']['pleasanton']} in Pleasanton, {payload['totals']['tri_valley']} elsewhere in the Tri-Valley).\n")

A("## Events by month\n")
A("| Month | Events | Pleasanton |")
A("|---|---:|---:|")
for m in sorted(by_month):
    pl = sum(1 for e in events if e["start_at"][:7] == m and e["region"] == "Pleasanton")
    A(f"| {m} | {by_month[m]} | {pl} |")

A("\n## Events by category\n")
A("| Category | Events |")
A("|---|---:|")
for c, n in by_cat.most_common():
    A(f"| {c} | {n} |")

A("\n## Images\n")
img_src = collections.Counter(e.get("image_source", "none") for e in events)
A("Every event carries an `image_url`. Where it came from:\n")
A("| Origin | Events |")
A("|---|---:|")
for k, label in [("event-page", "Fetched from the event's own page (`og:image`)"),
                 ("listing", "Published on the listing page we crawled"),
                 ("category-stock", "Category photo (source published none)")]:
    A(f"| {label} | {img_src.get(k, 0)} |")

A("\n## Sources\n")
A("| Source | Type | Pages OK | Events |")
A("|---|---|---:|---:|")
for s in sorted(sources.values(), key=lambda x: -x["events"]):
    A(f"| {s['name']} | {s['group']} | {s['ok']}/{s['urls']} | {s['events']} |")

A("\n## Sample — next 25 Pleasanton events\n")
A("| Date | Event | Venue | Category |")
A("|---|---|---|---|")
for e in [x for x in events if x["region"] == "Pleasanton"][:25]:
    A(f"| {e['start_at'][:10]} | {e['title'][:70]} | {(e['venue'] or '—')[:34]} | {e['category']} |")

rep = os.path.join(DATA, "CRAWL-REPORT.md")
open(rep, "w").write("\n".join(lines) + "\n")
print("wrote", rep)

# ---------------------------------------------------------------------------
# App-ready artefacts. The full dataset above is the archive; these two files
# are what the Next.js app imports, trimmed to the EventRecord shape.
# ---------------------------------------------------------------------------
import re

SRC = os.path.join(REPO, "src", "lib")

def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")[:70]

app_events = []
for e in events:
    city = e["city"] or ("Pleasanton" if e["region"] == "Pleasanton" else None)
    address = e["address"]
    if address and city and city.lower() not in address.lower():
        address = f"{address}, {city}, CA"
    elif not address and city:
        address = f"{city}, CA"
    tags = list(dict.fromkeys((e["tags"] or []) + [e["region"].lower().replace(" ", "-")]))
    app_events.append(dict(
        id=e["id"],
        title=e["title"],
        slug=f"{slugify(e['title'])}-{e['id'][:6]}",
        description=e["description"],
        start_at=e["start_at"], end_at=e["end_at"], all_day=e["all_day"],
        venue=e["venue"], address=address,
        category=e["category"], tags=tags,
        price=e["price"], is_free=e["is_free"],
        is_family_friendly=e["is_family_friendly"],
        image_url=e["image_url"], ticket_url=e["ticket_url"],
        source_url=e["source_url"], source_name=e["source_name"],
    ))
json.dump(app_events, open(os.path.join(SRC, "events.generated.json"), "w"),
          ensure_ascii=False, separators=(",", ":"))
print("wrote src/lib/events.generated.json", len(app_events), "events")

JS_SOURCES = {"City of Pleasanton", "Pleasanton Public Library", "Pleasanton Recreation",
              "Visit Tri-Valley", "Bankhead Theater", "Pleasanton Weekly", "Ruby Hill Winery",
              "Museum on Main", "Eventbrite — Pleasanton", "AllEvents — Pleasanton"}
EXCLUDED = {"DoTheBay — Pleasanton", "DoTheBay — Pleasanton venues", "Main Street Brewery"}

# Only sources that are both reachable and productive make it into the app:
# a listing that 404s, or one that returned a page but no events, is not
# information anyone can act on. Each kept source points at the exact page
# that yielded its events, not merely the first URL we tried.
from extract import PARSERS, read as read_page

page_events = {}
for page in manifest:
    if not page.get("ok") or page.get("status") != 200:
        continue
    fn = PARSERS.get(page["parser"])
    if not fn:
        continue
    try:
        got = fn(read_page(page["key"], "md"), read_page(page["key"], "html"),
                 page.get("final_url") or page["url"], page["source"], page["group"])
    except Exception:
        got = []
    page_events[page["key"]] = len(got)

# The page a reader should be sent to is the listing itself, not the third
# page of it or one month of it. Among productive 200s prefer the shortest URL;
# where the base listing lives at a known address, use that.
CANONICAL = {
    "Pleasanton Weekly": "https://www.pleasantonweekly.com/calendar/",
    "Bankhead Theater": "https://livermorearts.org/event-calendar/",
    "Patch — Pleasanton": "https://patch.com/california/pleasanton/calendar",
    "AllEvents — Pleasanton": "https://allevents.in/pleasanton/all",
    "Eventbrite — Pleasanton": "https://www.eventbrite.com/d/ca--pleasanton/events/",
    "Pleasanton Downtown Association": "https://www.pleasantondowntown.net/events",
    "Livermore Valley Wine Country": "https://www.lvwine.org/events/",
    "Firehouse Arts Center": "https://www.firehousearts.org/events/",
    "Alameda County Fairgrounds": "https://alamedacountyfair.com/alameda-county-fairgrounds-events-calendar",
    "Visit Tri-Valley": "https://www.visittrivalley.com/events/",
}
best_page = {}
for page in manifest:
    n = page_events.get(page["key"], -1)
    if n < 1:
        continue
    url = page.get("final_url") or page["url"]
    cur = best_page.get(page["source"])
    if cur is None or len(url) < len(cur[1]):
        best_page[page["source"]] = (n, url)
for name, url in CANONICAL.items():
    if name in best_page:
        best_page[name] = (best_page[name][0], url)

app_sources = []
dropped_sources = []
for s in sources.values():
    if s["name"] in EXCLUDED:
        continue
    live = best_page.get(s["name"])
    if not s["events"] or not live:
        dropped_sources.append((s["name"], "no events" if live else "unreachable"))
        continue
    app_sources.append(dict(
        id=f"s-{slugify(s['name'])[:32]}",
        slug=slugify(s["name"]),
        name=s["name"],
        url=live[1],
        website="https://" + live[1].split("/")[2],
        scraper_key=s["group"],
        strategy="playwright" if s["name"] in JS_SOURCES else "cheerio",
        # Provenance, not a scheduled target: the TS scraper has no adapter for
        # these, so the bundle says the same thing the Supabase seed does.
        enabled=False,
        notes=f"{s['events']} events from the one-shot crawl. No scheduled adapter.",
        last_status="ok",
    ))
app_sources.sort(key=lambda x: x["name"])
json.dump(app_sources, open(os.path.join(SRC, "sources.generated.json"), "w"),
          ensure_ascii=False, indent=2)
print("dropped sources:", ", ".join(f"{n} ({why})" for n, why in dropped_sources))
print("wrote src/lib/sources.generated.json", len(app_sources), "sources")

meta = dict(
    generated_at=d["generated_at"],
    window=d["window"],
    events=len(app_events),
    pleasanton=sum(1 for e in events if e["region"] == "Pleasanton"),
    tri_valley=sum(1 for e in events if e["region"] == "Tri-Valley"),
    sources=len(app_sources),
)
json.dump(meta, open(os.path.join(SRC, "dataset-meta.generated.json"), "w"), indent=2)
print("wrote src/lib/dataset-meta.generated.json")
