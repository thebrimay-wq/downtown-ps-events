"""Fetch each event's own page and pull its artwork (og:image, else the first
content image). Only sources whose event URLs are per-event are worth this."""
import asyncio, json, os, re, warnings
warnings.filterwarnings("ignore")
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
from crawl4ai.async_dispatcher import SemaphoreDispatcher

HERE = os.path.dirname(os.path.abspath(__file__))
EVENTS = "/Users/brimay/Documents/Bri May/Github Bri/downtown-ps-events/src/lib/events.generated.json"
PER_EVENT_SOURCES = {"Pleasanton Weekly", "Bankhead Theater", "Patch — Pleasanton"}

OG = re.compile(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', re.I)
OG2 = re.compile(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', re.I)
IMG = re.compile(r'<img[^>]+src=["\'](https?://[^"\']+\.(?:jpe?g|png|webp)[^"\']*)', re.I)
NOISE = re.compile(r"logo|icon|avatar|sprite|pixel|badge|profile_pics|Vibe_Site|placeholder", re.I)

def pick(html, url):
    m = OG.search(html) or OG2.search(html)
    if m and not NOISE.search(m.group(1)):
        return m.group(1)
    for i in IMG.findall(html):
        if NOISE.search(i): continue
        if "livermorearts.org" in url and "wp-content/uploads" not in i: continue
        return i
    return None

async def main():
    ev = json.load(open(EVENTS))
    todo = {}
    for e in ev:
        if e["image_url"] or e["source_name"] not in PER_EVENT_SOURCES: continue
        todo.setdefault(e["source_url"], []).append(e["id"])
    urls = list(todo)
    print("fetching", len(urls), "pages")
    b = BrowserConfig(headless=True, verbose=False,
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
    cfg = CrawlerRunConfig(cache_mode=CacheMode.BYPASS, page_timeout=45000, wait_until="networkidle",
                           delay_before_return_html=1.5, verbose=False, semaphore_count=8)
    found = {}
    async with AsyncWebCrawler(config=b) as c:
        rs = await c.arun_many(urls=urls, config=cfg, dispatcher=SemaphoreDispatcher(semaphore_count=8))
        for r in rs:
            if not r.success: continue
            img = pick(r.html or "", r.url)
            if not img: continue
            key = r.url if r.url in todo else next((u for u in todo if u.split("#")[0] == r.url.split("#")[0] and u.endswith(r.url.split("#")[-1])), None)
            if key is None:
                # Hash routes come back without their fragment on some runs; match by fragment.
                frag = r.url.split("#")[-1]
                key = next((u for u in todo if u.endswith(frag)), None)
            if key is None: continue
            for eid in todo[key]: found[eid] = img
    json.dump(found, open(os.path.join(HERE, "harvested_images_crawl.json"), "w"), indent=1)
    print("DONE images for", len(found), "events")

asyncio.run(main())
