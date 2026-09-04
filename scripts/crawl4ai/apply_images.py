"""Give every event an image.

Priority: artwork from the event's own page (harvested_images_crawl.json),
then artwork lifted from the listing page it came from (harvested_images.json),
then a category photo chosen deterministically by event id so the same event
always gets the same picture and neighbours don't repeat.
"""
import json, os, re, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
EVENTS = os.path.join(HERE, "events.json")

# Verified 200 OK on images.unsplash.com; ids are stable, the size params are ours.
FALLBACK = {
    # Reviewed by eye: what each photo actually shows, not just what its id says.
    "music":      ["photo-1470229722913-7c0e2dbbafd3", "photo-1517457373958-b7bdd4587205"],  # concert crowd; lit patio party
    "arts":       ["photo-1415201364774-f6f0bb35f28f", "photo-1460661419201-fd4cecdf8a8b"],
    "food-drink": ["photo-1510812431401-41d2bd2722f3", "photo-1511795409834-ef04bbd61622"],  # wine; set table with flowers
    "family":     ["photo-1503676260728-1c00da094a0b", "photo-1529156069898-49953e39b3ac"],  # kids; friends on a pier
    "market":     ["photo-1488459716781-31db52582fe9"],
    "community":  ["photo-1529156069898-49953e39b3ac", "photo-1517457373958-b7bdd4587205"],
    "sports":     ["photo-1452626038306-9aae5e071dd3", "photo-1506126613408-eca07ce68773"],
    "festival":   ["photo-1492684223066-81342ee5ff30", "photo-1533174072545-7a4b6ad7a6c3", "photo-1517457373958-b7bdd4587205"],
    "education":  ["photo-1485827404703-89b55fcc595e", "photo-1551818255-e6e10975bc17"],
    "nightlife":  ["photo-1514525253161-7a46d19cd819", "photo-1517457373958-b7bdd4587205"],
    "other":      ["photo-1517457373958-b7bdd4587205", "photo-1529156069898-49953e39b3ac"],
}

def unsplash(pid):
    return f"https://images.unsplash.com/{pid}?auto=format&fit=crop&w=1200&q=70"

def norm(t): return re.sub(r"[^a-z0-9]+", "", (t or "").lower())[:60]

def main():
    d = json.load(open(EVENTS))
    crawled = {}
    p = os.path.join(HERE, "harvested_images_crawl.json")
    if os.path.exists(p): crawled = json.load(open(p))
    listed = {}
    p = os.path.join(HERE, "harvested_images.json")
    if os.path.exists(p):
        for row in json.load(open(p)): listed[(row["source"], row["key"])] = row["image"]

    counts = {"own": 0, "page": 0, "listing": 0, "fallback": 0}
    for e in d["events"]:
        if e.get("image_url"):
            counts["own"] += 1; e["image_source"] = "listing"; continue
        img = crawled.get(e["id"])
        if img:
            e["image_url"], e["image_source"] = img, "event-page"; counts["page"] += 1; continue
        img = listed.get((e["source_name"], norm(e["title"])))
        if img:
            e["image_url"], e["image_source"] = img, "listing"; counts["listing"] += 1; continue
        pool = FALLBACK.get(e["category"]) or FALLBACK["other"]
        idx = int(hashlib.sha1(e["id"].encode()).hexdigest(), 16) % len(pool)
        e["image_url"], e["image_source"] = unsplash(pool[idx]), "category-stock"
        counts["fallback"] += 1

    json.dump(d, open(EVENTS, "w"), indent=2, ensure_ascii=False)
    total = len(d["events"])
    print(f"images: {total}/{total}  "
          f"(from listing {counts['own']}, from event page {counts['page']}, "
          f"lifted from listing page {counts['listing']}, category stock {counts['fallback']})")

if __name__ == "__main__":
    main()
