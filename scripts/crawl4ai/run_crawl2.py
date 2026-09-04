import asyncio, json, os, warnings
warnings.filterwarnings("ignore")
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
from crawl4ai.async_dispatcher import SemaphoreDispatcher
from worklist2 import build

HERE = os.path.dirname(os.path.abspath(__file__))
PAGES = os.path.join(HERE, "pages"); os.makedirs(PAGES, exist_ok=True)
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

async def main():
    work = build()
    bcfg = BrowserConfig(headless=True, verbose=False, user_agent=UA,
                         viewport_width=1440, viewport_height=2000)
    cfg = CrawlerRunConfig(cache_mode=CacheMode.BYPASS, page_timeout=70000,
                           wait_until="networkidle", scan_full_page=True,
                           scroll_delay=0.4, delay_before_return_html=4.0,
                           remove_overlay_elements=True, verbose=False,
                           mean_delay=0.5, semaphore_count=5)
    manifest = json.load(open(os.path.join(HERE, "manifest.json")))
    async with AsyncWebCrawler(config=bcfg) as c:
        results = await c.arun_many(urls=[w["url"] for w in work], config=cfg,
                                    dispatcher=SemaphoreDispatcher(semaphore_count=5))
        by = {}
        for r in results:
            by.setdefault(r.url, r)
        for w in work:
            r = by.get(w["url"]) or by.get(w["url"].rstrip("/")) \
                or next((v for k, v in by.items() if k.split("#")[0].rstrip("/") == w["url"].split("#")[0].rstrip("/")), None)
            rec = {k: v for k, v in w.items() if k != "js"}
            if r is None or not r.success:
                rec.update(ok=False, error="fetch-failed")
            else:
                md = r.markdown.raw_markdown if hasattr(r.markdown, "raw_markdown") else str(r.markdown or "")
                open(os.path.join(PAGES, w["key"] + ".md"), "w").write(md)
                open(os.path.join(PAGES, w["key"] + ".html"), "w").write(r.html or "")
                rec.update(ok=True, status=r.status_code, md_len=len(md), final_url=r.url)
            manifest.append(rec)
    json.dump(manifest, open(os.path.join(HERE, "manifest.json"), "w"), indent=2)
    new = [m for m in manifest[-len(work):]]
    print(f"DONE round2 {sum(1 for m in new if m.get('ok'))}/{len(work)}")

asyncio.run(main())
