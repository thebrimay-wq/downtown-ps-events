"""Parse every crawled page, normalize, filter to the next 12 months, dedupe."""
import json, os, re, sys, hashlib
import datetime as dt
from extract import PARSERS, parse_date, parse_time, txt, TODAY, HORIZON, read

HERE = os.path.dirname(os.path.abspath(__file__))

CATEGORY_RULES = [
    ("music",      r"\b(concert|live music|band|dj|acoustic|jazz|symphony|orchestra|tribute|open mic|karaoke|singer|blues|rock|tunes|sings?)\b"),
    ("festival",   r"\b(festival|fest\b|parade|fair\b|palooza|carnival|gathering|games\b)\b"),
    ("market",     r"\b(farmers.? market|market\b|craft fair|flea|thrift|vendor|bazaar|swap meet)\b"),
    ("food-drink", r"\b(wine|winery|tasting|brew|beer|cocktail|dinner|brunch|food truck|culinary|stroll|pairing|vineyard|sips?|cork|taproom|happy hour)\b"),
    ("family",     r"\b(kids?|children|family|storytime|story time|toddler|teen|youth|bunny|santa|halloween|trick.or.treat|corgi|petting)\b"),
    ("arts",       r"\b(art|gallery|exhibit|theat(er|re)|museum|play\b|comedy|dance|ballet|film|screening|craft|paint|photograph|author|book)\b"),
    ("sports",     r"\b(run\b|5k|10k|race|yoga|fitness|hike|hiking|walk\b|swim|golf|tournament|mma|bike|cycling|pickleball|soccer|baseball)\b"),
    ("education",  r"\b(class|workshop|lecture|seminar|training|tutor|lesson|talk\b|learn|genealogy|citizenship|library)\b"),
    ("nightlife",  r"\b(nightlife|bar crawl|late night|after dark|pub crawl|21\+)\b"),
    ("community",  r"\b(council|meeting|volunteer|blood drive|clean.?up|town hall|support group|senior|nonprofit|fundraiser|commission)\b"),
]

def infer_category(*parts):
    blob = " ".join(p for p in parts if p).lower()
    for slug, rx in CATEGORY_RULES:
        if re.search(rx, blob): return slug
    return "other"

# --------------------------------------------------------------------------
# Geography. The regional aggregators (Pleasanton Weekly, DoTheBay, Eventbrite)
# happily return events from all over the East Bay, so every event has to earn
# its place: Pleasanton, then the rest of the Tri-Valley, then dropped.
# --------------------------------------------------------------------------
PLEASANTON_RX = re.compile(r"\bpleasanton\b", re.I)
PLEASANTON_VENUES = re.compile(
    r"\b(alameda county fair|firehouse arts|museum on main|stoneridge|hacienda business|"
    r"ruby hill|shadow cliffs|alviso adobe|main street brewery|sabio on main|inklings|"
    r"barone|handles gastropub|mckay|hop yard|blue agave|amador valley|callippe|"
    r"century house|veterans memorial building|amaral|val vista|ken mercer)\b", re.I)
TRIVALLEY_CITIES = ["livermore", "dublin", "san ramon", "danville", "sunol"]
OTHER_CITIES = ["hayward", "newark", "union city", "fremont", "castro valley", "san leandro",
                "oakland", "san francisco", "berkeley", "alameda", "milpitas", "san jose",
                "walnut creek", "concord", "antioch", "brentwood", "tracy", "modesto",
                "stockton", "emeryville", "richmond", "san mateo", "daly city", "santa clara",
                "sunnyvale", "mountain view", "palo alto", "redwood city", "santa cruz",
                "sacramento", "napa", "sonoma", "monterey", "los angeles", "new york"]
CITY_RX = re.compile(r"\b(" + "|".join(TRIVALLEY_CITIES + OTHER_CITIES) + r")\b", re.I)

def infer_city(address, venue, url, title, desc):
    """Strongest signal first: a street address beats a venue name beats prose."""
    for field in (address, venue, url, title):
        if not field: continue
        if PLEASANTON_RX.search(field) or PLEASANTON_VENUES.search(field): return "Pleasanton"
        m = CITY_RX.search(field)
        if m: return m.group(1).title()
    if desc:
        if PLEASANTON_VENUES.search(desc): return "Pleasanton"
    return None

# DoTheBay's venue pages render the site-wide "popular in the Bay Area" list
# rather than that venue's own calendar, so its rows are San Francisco shows
# wearing a Pleasanton venue heading. Excluded until a reliable route exists.
EXCLUDED_SOURCES = {"DoTheBay — Pleasanton", "DoTheBay — Pleasanton venues",
                    "Main Street Brewery"}

# Fallback location for sources whose venue is fixed and unambiguous.
SOURCE_CITY = {
    "Firehouse Arts Center": "Pleasanton", "Alameda County Fairgrounds": "Pleasanton",
    "Pleasanton Downtown Association": "Pleasanton", "Museum on Main": "Pleasanton",
    "Pleasanton Public Library": "Pleasanton", "City of Pleasanton": "Pleasanton",
    "Pleasanton Recreation": "Pleasanton", "Pleasanton Farmers Market": "Pleasanton",
    "Pleasanton Chamber of Commerce": "Pleasanton", "Pleasanton Cultural Arts Council": "Pleasanton",
    "Stoneridge Shopping Center": "Pleasanton", "Hacienda Business Park": "Pleasanton",
    "Shadow Cliffs Regional Park": "Pleasanton", "Ruby Hill Winery": "Pleasanton",
    "Main Street Brewery": "Pleasanton", "Sabio on Main": "Pleasanton",
    "McKay's Taphouse": "Pleasanton", "The Hop Yard Alehouse": "Pleasanton",
    "Handles Gastropub": "Pleasanton", "Barone's Restaurant": "Pleasanton",
    "Blue Agave Club": "Pleasanton", "Inklings Coffee & Tea": "Pleasanton",
    "DoTheBay — Pleasanton venues": "Pleasanton",
    "Bankhead Theater": "Livermore", "Concannon Vineyard": "Livermore",
    "Wente Vineyards": "Livermore", "McGrail Vineyards": "Livermore",
    "Garre Vineyard & Winery": "Livermore",
}

# Sources whose entire catalog is Tri-Valley, used when no city can be parsed.
SOURCE_REGION = {
    "Visit Tri-Valley": "Tri-Valley", "Livermore Valley Wine Country": "Tri-Valley",
    "Bankhead Theater": "Tri-Valley",
}

JUNK_DESC = re.compile(
    r"^(\W+|event details|read more|details|more info|[\d\s:.apm]+mi)$", re.I)

FREE_RX = re.compile(r"\bfree\b|\bno charge\b|\bcomplimentary\b", re.I)

def to_iso(datestr, timestr=None, timetext=None):
    """Resolve a date (+ optional time) into a Pacific-local ISO timestamp.

    Returns (iso, date, had_time). had_time is False when the source only gave
    a day — noon is then a placeholder, not a claim about when it starts.
    """
    if not datestr: return None, None, False
    s = str(datestr)
    iso = re.match(r"(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})", s)
    if iso:
        return f"{iso.group(1)}T{iso.group(2)}:00-07:00", parse_date(iso.group(1)), True
    d = parse_date(s)
    if not d: return None, None, False
    t = parse_time(timestr or "") or parse_time(timetext or "")
    had_time = t is not None
    if t is None:
        m = re.search(r"(\d{1,2}):(\d{2})\s*$", str(timetext or ""))
        if m:
            t, had_time = dt.time(int(m.group(1)), int(m.group(2))), True
        else:
            t = dt.time(12, 0)
    return f"{d.isoformat()}T{t.strftime('%H:%M')}:00-07:00", d, had_time

def norm_title(t):
    return re.sub(r"[^a-z0-9]+", "", (t or "").lower())[:60]

def main():
    manifest = json.load(open(os.path.join(HERE, "manifest.json")))
    raw, per_source = [], {}
    for page in manifest:
        if not page.get("ok"): continue
        fn = PARSERS.get(page["parser"])
        if not fn: continue
        md, html = read(page["key"], "md"), read(page["key"], "html")
        try:
            got = fn(md, html, page.get("final_url") or page["url"], page["source"], page["group"])
        except Exception as e:
            print(f"  parser error {page['key']}: {type(e).__name__}: {e}", file=sys.stderr)
            continue
        raw.extend(got)
        per_source[page["source"]] = per_source.get(page["source"], 0) + len(got)

    events, dropped = [], {"no-date": 0, "out-of-window": 0, "dupe": 0, "no-title": 0,
                           "out-of-area": 0, "no-location": 0,
                           "excluded-source": 0}
    seen = {}
    for e in raw:
        if e.get("source") in EXCLUDED_SOURCES:
            dropped["excluded-source"] = dropped.get("excluded-source", 0) + 1
            continue
        title = txt(e.get("title"))
        if title:
            # Some list pages leave markdown link syntax in the heading text.
            title = re.sub(r"\[(.+?)\]\([^)]*\)", r"\1", title)
            title = txt(re.sub(r"^[#*>\s]+", "", title))
        if not title or len(title) < 4:
            dropped["no-title"] += 1; continue
        start_iso, d, had_time = to_iso(e.get("start"), e.get("time"), e.get("time_text"))
        if not start_iso:
            dropped["no-date"] += 1; continue
        if not (TODAY <= d <= HORIZON):
            dropped["out-of-window"] += 1; continue
        end_iso = None
        if e.get("end"):
            end_iso, _, _ = to_iso(e.get("end"), None, e.get("end_time_text"))
        # An end that is not after the start tells us nothing; drop it rather
        # than render "12:00 PM – 12:00 PM".
        if end_iso and start_iso and end_iso <= start_iso:
            end_iso = None
        desc = txt(e.get("description"))
        # Heuristic parsers occasionally grab a bullet, a "read more" label, or
        # a stray time/distance fragment. None of that is worth showing.
        if desc and (len(desc) < 12 or JUNK_DESC.match(desc)): desc = None
        if desc and len(desc) > 900: desc = desc[:897].rsplit(" ", 1)[0] + "…"
        price = txt(e.get("price"))
        blob_cat = infer_category(title, desc, e.get("venue"), " ".join(e.get("tags") or []))
        city = (infer_city(e.get("address"), e.get("venue"), e.get("url"), title, desc)
                or SOURCE_CITY.get(e.get("source")))
        if city == "Pleasanton":
            region = "Pleasanton"
        elif city and city.lower() in TRIVALLEY_CITIES:
            region = "Tri-Valley"
        elif city:
            dropped["out-of-area"] = dropped.get("out-of-area", 0) + 1
            continue
        else:
            region = SOURCE_REGION.get(e.get("source"))
            if not region:
                dropped["no-location"] = dropped.get("no-location", 0) + 1
                continue
        key = (norm_title(title), d.isoformat())
        if key in seen:
            dropped["dupe"] += 1
            prev = seen[key]
            # Keep the richer record.
            if len(json.dumps(e, default=str)) > len(json.dumps(prev, default=str)):
                events[events.index(prev)] = prev  # keep ordering stable
            continue
        venue = txt(e.get("venue"))
        if venue and title and venue.strip().lower() == title.strip().lower():
            venue = None
        rec = dict(
            id=hashlib.sha1(f"{key[0]}|{key[1]}".encode()).hexdigest()[:12],
            title=title, description=desc, start_at=start_iso, end_at=end_iso,
            all_day=not had_time,
            venue=venue, address=txt(e.get("address")), city=city,
            category=blob_cat, tags=[t for t in (e.get("tags") or []) if t],
            price=price, is_free=bool(price and FREE_RX.search(price)) or bool(not price and FREE_RX.search(title)),
            is_family_friendly=blob_cat in ("family", "market", "festival"),
            image_url=txt(e.get("image")), ticket_url=txt(e.get("ticket")),
            region=region,
            source_name=e.get("source"), source_group=e.get("group"),
            source_url=txt(e.get("url")), extraction=e.get("method"),
        )
        seen[key] = rec
        events.append(rec)

    events.sort(key=lambda r: r["start_at"])
    out = dict(
        generated_at=dt.datetime.now().isoformat(timespec="seconds"),
        window=dict(start=TODAY.isoformat(), end=HORIZON.isoformat()),
        counts=dict(raw=len(raw), kept=len(events), dropped=dropped),
        events=events,
    )
    json.dump(out, open(os.path.join(HERE, "events.json"), "w"), indent=2, ensure_ascii=False)

    print(f"raw={len(raw)} kept={len(events)} dropped={dropped}")
    print("\n-- per source (raw) --")
    for k, v in sorted(per_source.items(), key=lambda x: -x[1]): print(f"  {v:5}  {k}")
    from collections import Counter
    print("\n-- kept by source --")
    for k, v in Counter(e["source_name"] for e in events).most_common(): print(f"  {v:5}  {k}")
    print("\n-- kept by city --")
    for k, v in Counter(e["city"] or "unknown" for e in events).most_common(): print(f"  {v:5}  {k}")
    print("\n-- kept by category --")
    for k, v in Counter(e["category"] for e in events).most_common(): print(f"  {v:5}  {k}")
    print("\n-- kept by month --")
    for k, v in sorted(Counter(e["start_at"][:7] for e in events).items()): print(f"  {v:5}  {k}")

if __name__ == "__main__":
    main()
