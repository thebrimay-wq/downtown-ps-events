"""Repair defects in the shipped dataset that a re-crawl would fix but that
cannot wait for one (the crawl cache is not in the repository).

Each repair is a function whose docstring says what went wrong and why the
fix is the right one. They run in order, so a later repair sees the earlier
ones' output (the kids flag reads the cleaned description, for instance).

  1. Visit Tri-Valley titles. parse_vibe used to skip an entry's own heading
     when it came before the venue heading in its walk back, and then took
     the previous entry's title instead — 14 of 34 events shipped with a
     neighbour's name. The site's own URL slug says which title each event
     should have; where a sibling record carries that exact title it is
     reused (punctuation intact), otherwise the slug is title-cased.

  2. Stock photos. apply_images.py gave 355 events a category stock photo
     from Unsplash, and emit.py wrote it into image_url without the
     image_source that says it is not the event's own picture. The app then
     showed one photo as the artwork for 110 different events and used it as
     the share preview. Those rows get image_url=null so the category
     fallback the components already draw is what renders.

  3. Glued and doubled Pleasanton Weekly titles (repair_pweekly_titles).
  4. Description chrome: "Biography " and "…T1.0 mi" (repair_descriptions).
  5. Times the source published but the parser lost, and a midnight that was
     never a time (repair_times).
  6. Addresses: a street the blurb names, and a city appended twice
     (repair_street_addresses, repair_doubled_addresses).
  7. Free: blurbs that say so outright (repair_free).
  8. Price strings that are not prices, or are prices in the wrong shape
     (repair_prices).
  9. The kids badge, decided by what the organiser wrote (repair_kids_flag).

Edits data/pleasanton-events.json (the archive) and src/lib/events.generated.json
(the bundle) in place, matching rows by id. Idempotent: a second run changes
nothing. Run `npm run knowledge` afterwards so the Ask index agrees, and
regenerate supabase/seed-events.sql with seed_sql.py.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
ARCHIVE = os.path.join(REPO, "data", "pleasanton-events.json")
BUNDLE = os.path.join(REPO, "src", "lib", "events.generated.json")

# The same time parser and cost/audience rules the crawl uses, so a repaired
# row and a re-crawled row read the same text the same way.
sys.path.insert(0, HERE)
from extract import parse_time_range  # noqa: E402
from build_events import says_free, infer_family_friendly  # noqa: E402

VIBE_SLUG = re.compile(r"/event/([a-z0-9\-]+?)-\d{4}-\d{2}-\d{2}/?$")
SMALL = {"a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"}

TZ = "-07:00"


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")


def titleize(slug):
    words = slug.split("-")
    out = []
    for i, w in enumerate(words):
        if re.match(r"^\d+(st|nd|rd|th)$", w):
            out.append(w)  # 160th, not 160Th
        elif i and w in SMALL:
            out.append(w)
        else:
            out.append(w.capitalize())
    return " ".join(out)


def repair_titles(archive_events):
    vibe = [e for e in archive_events if e.get("extraction") == "vibe"]
    by_title_slug = {slugify(e["title"]): e["title"] for e in vibe}
    fixes = {}
    for e in vibe:
        m = VIBE_SLUG.search(e.get("source_url") or "")
        if not m:
            continue
        own = m.group(1)
        if slugify(e["title"]) == own:
            continue
        fixes[e["id"]] = by_title_slug.get(own) or titleize(own)
    return fixes


# ------------------------------------------------------------------ titles --
PW_DETAIL = re.compile(r"/details/(?P<slug>[^/]+)/\d+/\d{4}-\d{2}-\d{2}T\d{2}")
# A lowercase letter or punctuation immediately followed by a capital: the
# seam where the widget glued the venue onto the title.
GLUE = re.compile(r"[a-z!?.,:;)'\"](?=[A-Z])")


def repair_pweekly_titles(events):
    """Pleasanton Weekly's listing runs "TitleVenue" with no separator.
    parse_pweekly measures the title against the URL slug, but the site keeps
    a trailing hyphen on slugs of titles that end in punctuation ("Meet Up!"
    -> "meet-up-") while _slugify strips it, so the ruler never matched and
    the venue stayed glued on ("Meet Up!Danville Community Center & Library
    > Town Green"). The slug says where the title ends; the rest is the
    venue, reduced to its last " > " segment (the room, not the building).

    The doubled-title fallback ("SPRK Strength 55+ SPRK Strength 55+") was
    off by the separating space, so the halves never compared equal."""
    fixes = {}
    for e in events:
        title = e.get("title") or ""
        m = PW_DETAIL.search(e.get("source_url") or "")
        if m and GLUE.search(title):
            slug = m.group("slug").rstrip("-")
            for i in range(4, len(title) + 1):
                if slugify(title[:i]) == slug:
                    # The slug drops trailing punctuation; "Meet Up!" ends
                    # at the "!", not before it.
                    while i < len(title) and not title[i].isalnum() and not title[i].isspace():
                        i += 1
                    prefix, rest = title[:i].strip(), title[i:].strip()
                    if rest and prefix != title:
                        venue = e.get("venue") or rest.split(" > ")[-1].strip() or rest
                        fixes[e["id"]] = (prefix, venue)
                    break
            if e["id"] in fixes:
                continue
        half = len(title) // 2
        if len(title) % 2 == 1 and title[half] == " " and title[:half] == title[half + 1:]:
            fixes[e["id"]] = (title[:half], e.get("venue"))
    return fixes


# ------------------------------------------------------------ descriptions --
BIOGRAPHY = re.compile(r"^Biography\s+")
DISTANCE = re.compile(r"\s*[A-Z]?\d+(?:\.\d+)?\s*mi$")


def repair_descriptions(events):
    """Pleasanton Weekly's widget opens performer blurbs with its "Biography"
    label and closes untimed blurbs with the reader's distance glued to the
    avatar initial ("…Sun, Sep 6, 2026 T1.0 mi"). parse_pweekly stripped the
    distance only when a time preceded it. Neither fragment is description;
    what is left under 12 characters is nothing at all."""
    fixes = {}
    for e in events:
        d = e.get("description")
        if not d:
            continue
        new = DISTANCE.sub("", BIOGRAPHY.sub("", d)).strip()
        if len(new) < 12:
            new = None
        if new != d:
            fixes[e["id"]] = new
    return fixes


# ------------------------------------------------------------------- times --
def _stamp(date, t):
    return f"{date}T{t.strftime('%H:%M')}:00{TZ}"


def repair_times(events):
    """Two ways a time went wrong.

    Events flagged all_day whose title or blurb names a clock: parse_time
    returned the END of "8-9:30 a.m." ranges, noon for "6.00pm", nothing for
    "19:30" or "noon", and several parsers never handed their text to it at
    all (parse_pda, parse_generic, parse_acfair). The fixed parser reads the
    same text and sets start_at, and end_at when the text gives a range.

    Pleasanton Weekly events at exactly 00:00 with all_day false: the URL
    hour "00" is the widget's "no time set" anchor, not midnight. Where the
    text names no time, the event becomes all_day with the noon placeholder
    every other untimed row carries. Noon rows (12:00, all_day false) are
    real noon events and are left alone."""
    fixes = {}
    for e in events:
        date = e["start_at"][:10]
        clock = e["start_at"][11:16]
        found = None
        for field in ("title", "description"):
            start, end = parse_time_range(e.get(field) or "")
            if start:
                found = (start, end)
                break
        if e.get("all_day"):
            if found:
                start, end = found
                fixes[e["id"]] = dict(start_at=_stamp(date, start), all_day=False,
                                      end_at=_stamp(date, end) if end else e.get("end_at"))
        elif clock == "00:00" and e.get("source_name") == "Pleasanton Weekly":
            if found:
                start, end = found
                fixes[e["id"]] = dict(start_at=_stamp(date, start), all_day=False,
                                      end_at=_stamp(date, end) if end else e.get("end_at"))
            else:
                from datetime import time
                fixes[e["id"]] = dict(start_at=_stamp(date, time(12, 0)), all_day=True,
                                      end_at=e.get("end_at"))
    # An end at or before the start says nothing; keep whatever was there.
    for i, f in fixes.items():
        if f["end_at"] and f["end_at"] <= f["start_at"]:
            f["end_at"] = None
    return fixes


# --------------------------------------------------------------- addresses --
CITY_ONLY = re.compile(r"^[A-Za-z .'-]+, CA$")
STREET = re.compile(
    r"\b(\d{1,5}\s+(?:[A-Z][A-Za-z.']*\s+){0,4}"
    r"(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Way|Ln|Lane|Ct|Court|Pl|Place|"
    r"Pkwy|Parkway|Cir|Circle|Hwy|Highway|Loop|Ter|Terrace)\b\.?)")


def repair_street_addresses(events):
    """"Livermore, CA" is not somewhere a reader can navigate to. Where the
    address is a bare city and the blurb names a street address ("4444 East
    Ave", "206 South J St"), the street goes in front of the city."""
    fixes = {}
    for e in events:
        addr = e.get("address") or ""
        if not CITY_ONLY.match(addr):
            continue
        m = STREET.search(e.get("description") or "")
        if not m:
            continue
        street = m.group(1).rstrip(".")
        fixes[e["id"]] = f"{street}, {addr}"
    return fixes


DOUBLED = re.compile(r"California|United States", re.I)
DROP_TOKEN = re.compile(r"^(ca|california|united states|tba|to be announced|private villa)$", re.I)
STATE_ZIP = re.compile(r"^CA\s+(\d{5}(?:-\d{4})?)$", re.I)


def repair_doubled_addresses(events):
    """emit.py appends ", <City>, CA" when the city is not already in the
    address, but AllEvents writes "Pleasanton,CA,United States" and
    "Pleasanton, California" — the city is there, just not in the form the
    check looked for. Only rows with ", CA" twice or a "California" /
    "United States" token are touched: split on commas, drop state, country
    and placeholder tokens, keep a zip that rode on the state, dedupe, and
    rebuild as "<parts>, <City>, CA[ <zip>]"."""
    fixes = {}
    for e in events:
        addr = e.get("address") or ""
        if addr.count(", CA") < 2 and not DOUBLED.search(addr):
            continue
        tokens = [t.strip() for t in addr.split(",") if t.strip()]
        city = tokens[-2] if len(tokens) >= 2 and tokens[-1].upper() == "CA" else None
        zip_code, kept, seen = None, [], set()
        for t in tokens:
            zm = STATE_ZIP.match(t)
            if zm:
                zip_code = zip_code or zm.group(1)
                continue
            if DROP_TOKEN.match(t):
                continue
            if t.lower() in seen:
                continue
            seen.add(t.lower())
            kept.append(t)
        if not city:
            city = kept[-1] if kept else None
        if not city:
            continue
        parts = [t for t in kept if t.lower() != city.lower()]
        new = ", ".join(parts + [city, "CA" + (f" {zip_code}" if zip_code else "")])
        if new != addr:
            fixes[e["id"]] = new
    return fixes


# -------------------------------------------------------------------- free --
def repair_free(events):
    """build_events only read "free" from the price string or the title, so a
    blurb that says "Admission is free" shipped as not free — and free is the
    most used filter. Only phrases that state the cost outright count (see
    says_free): a bare "free" ("free parking") does not, nor does a perk for
    club members, nor a blurb that also names a dollar price."""
    return {e["id"]: True for e in events
            if not e.get("price") and not e.get("is_free") and says_free(e.get("description"))}


# ------------------------------------------------------------------ prices --
NOT_A_PRICE = re.compile(r"^(none|null|n/a|tba|tbd|varies)$", re.I)


def normalize_price(p):
    if p is None:
        return None
    s = p.strip()
    if not s or NOT_A_PRICE.match(s):
        return None
    s = re.sub(r"^Cost:\s*", "", s, flags=re.I)
    m = re.match(r"^\$?(\d+)(?:\.(\d{1,2}))?\.?$", s)
    if m:
        cents = (m.group(2) or "").rstrip("0")
        return f"${m.group(1)}" + (f".{m.group(2)}" if cents else "")
    return s or None


def repair_prices(events):
    """price is a display string, and some sources gave it "None", "Cost: $10",
    "10", "$5.0" or "$34." — one event literally showed "None" as its price.
    Non-prices become null; a bare number gets its dollar sign; ".0", ".00"
    and a trailing "." go."""
    fixes = {}
    for e in events:
        new = normalize_price(e.get("price"))
        if new != e.get("price"):
            fixes[e["id"]] = new
    return fixes


# -------------------------------------------------------------------- kids --
def repair_kids_flag(events):
    """The Kids badge was "category in (family, market, festival)", which put
    it on "Free Social Adults-Only (19+) Chess Club". What the organiser wrote
    decides (infer_family_friendly): an age restriction means no;
    "family-friendly" / "all ages" / "storytime" means yes; otherwise only the
    family category earns it."""
    fixes = {}
    for e in events:
        new = infer_family_friendly(e.get("title"), e.get("description"), e.get("category"))
        if new != bool(e.get("is_family_friendly")):
            fixes[e["id"]] = new
    return fixes


# -------------------------------------------------------------------- main --
def apply(rows, fixes, field):
    for e in rows:
        if e["id"] in fixes:
            e[field] = fixes[e["id"]]


def main():
    archive = json.load(open(ARCHIVE))
    events = archive["events"]
    bundle = json.load(open(BUNDLE))
    bundle_by_id = {e["id"]: e for e in bundle}
    report = []

    titles = repair_titles(events)
    stock = {e["id"] for e in events if e.get("image_source") == "category-stock" and e.get("image_url")}
    for e in events:
        if e["id"] in titles:
            e["title"] = titles[e["id"]]
        if e["id"] in stock:
            e["image_url"] = None
    for e in bundle:
        if e["id"] in titles:
            e["title"] = titles[e["id"]]
        if e["id"] in stock:
            e["image_url"] = None
    report.append(("titles repaired", titles, lambda v: v))
    report.append(("stock photos cleared", {i: None for i in stock}, lambda v: ""))

    # The bundle is what the app shows, so each repair reads the bundle row
    # and writes the same value to both files.
    pw_titles = repair_pweekly_titles(bundle)
    for rows in (events, bundle):
        for e in rows:
            if e["id"] in pw_titles:
                e["title"], e["venue"] = pw_titles[e["id"]]
    report.append(("pweekly titles unglued", pw_titles, lambda v: f"{v[0]!r} venue={v[1]!r}"))

    descs = repair_descriptions(bundle)
    apply(events, descs, "description"); apply(bundle, descs, "description")
    report.append(("descriptions trimmed", descs, lambda v: (v or "")[:60]))

    times = repair_times(bundle)
    for rows in (events, bundle):
        for e in rows:
            if e["id"] in times:
                e.update(times[e["id"]])
    report.append(("times repaired", times,
                   lambda v: f"{v['start_at'][11:16]}–{(v['end_at'] or '')[11:16] or '?'} all_day={v['all_day']}"))

    streets = repair_street_addresses(bundle)
    apply(events, streets, "address"); apply(bundle, streets, "address")
    report.append(("street addresses added", streets, lambda v: v))

    doubled = repair_doubled_addresses(bundle)
    apply(events, doubled, "address"); apply(bundle, doubled, "address")
    report.append(("doubled addresses cleaned", doubled, lambda v: v))

    free = repair_free(bundle)
    apply(events, free, "is_free"); apply(bundle, free, "is_free")
    report.append(("marked free", free, lambda v: ""))

    prices = repair_prices(bundle)
    apply(events, prices, "price"); apply(bundle, prices, "price")
    report.append(("prices normalized", prices, lambda v: repr(v)))

    kids = repair_kids_flag(bundle)
    apply(events, kids, "is_family_friendly"); apply(bundle, kids, "is_family_friendly")
    report.append(("kids flag changed", kids, lambda v: str(v)))

    # emit.py derives the slug from the title and sorts by start; keep both
    # in step with the repaired values.
    for e in bundle:
        e["slug"] = f"{slugify(e['title'])[:70]}-{e['id'][:6]}"
    events.sort(key=lambda r: r["start_at"])
    bundle.sort(key=lambda r: r["start_at"])

    json.dump(archive, open(ARCHIVE, "w"), indent=2, ensure_ascii=False)
    json.dump(bundle, open(BUNDLE, "w"), ensure_ascii=False, separators=(",", ":"))

    for label, fixes, fmt in report:
        print(f"{label}: {len(fixes)}")
        for i, v in list(fixes.items())[:3]:
            print(f"  {i}  {bundle_by_id[i]['title'][:50]:50}  {fmt(v)}")


if __name__ == "__main__":
    main()
