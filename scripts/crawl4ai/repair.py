"""Repair two defects in the shipped dataset that a re-crawl would fix but
that cannot wait for one (the crawl cache is not in the repository).

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

Edits data/pleasanton-events.json (the archive) and src/lib/events.generated.json
(the bundle) in place. Idempotent: a second run changes nothing. Run
`npm run knowledge` afterwards so the Ask index agrees.
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
ARCHIVE = os.path.join(REPO, "data", "pleasanton-events.json")
BUNDLE = os.path.join(REPO, "src", "lib", "events.generated.json")

VIBE_SLUG = re.compile(r"/event/([a-z0-9\-]+?)-\d{4}-\d{2}-\d{2}/?$")
SMALL = {"a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"}


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


def main():
    archive = json.load(open(ARCHIVE))
    events = archive["events"]
    bundle = json.load(open(BUNDLE))
    bundle_by_id = {e["id"]: e for e in bundle}

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
            # emit.py derives the slug from the title; keep the two in step.
            e["slug"] = f"{slugify(e['title'])[:70]}-{e['id'][:6]}"
        if e["id"] in stock:
            e["image_url"] = None

    json.dump(archive, open(ARCHIVE, "w"), indent=2, ensure_ascii=False)
    json.dump(bundle, open(BUNDLE, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"titles repaired: {len(titles)}")
    for i, t in titles.items():
        print(f"  {i}  {bundle_by_id[i]['title'][:60]}")
    print(f"stock photos cleared: {len(stock)}")


if __name__ == "__main__":
    main()
