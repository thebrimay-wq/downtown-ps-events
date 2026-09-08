import asyncio, json, os, warnings
warnings.filterwarnings("ignore")
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
from crawl4ai.async_dispatcher import MemoryAdaptiveDispatcher, SemaphoreDispatcher
from worklist import build

HERE = os.path.dirname(os.path.abspath(__file__))
PAGES = os.path.join(HERE, "pages"); os.makedirs(PAGES, exist_ok=True)

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

async def main():
    work = build()
    bcfg = BrowserConfig(headless=True, verbose=False, user_agent=UA,
                         viewport_width=1440, viewport_height=1600)
    cfg = CrawlerRunConfig(cache_mode=CacheMode.BYPASS, page_timeout=60000,
                           wait_until="domcontentloaded", scan_full_page=True,
                           delay_before_return_html=2.5, remove_overlay_elements=True,
                           verbose=False, mean_delay=0.6, semaphore_count=5)
    dispatcher = SemaphoreDispatcher(semaphore_count=5)
    manifest = []
    async with AsyncWebCrawler(config=bcfg) as c:
        results = await c.arun_many(urls=[w["url"] for w in work], config=cfg,
                                    dispatcher=dispatcher)
        by = {}
        for r in results:
            by.setdefault(r.url.rstrip('/'), r)
        for w in work:
            u = w["url"].rstrip('/')
            r = by.get(u)
            if r is None:
                r = next((v for k, v in by.items() if k.split('#')[0] == u.split('#')[0]), None)
            rec = dict(w)
            if r is None or not r.success:
                rec.update(ok=False, error=(r.error_message.splitlines()[1][:120] if r and r.error_message and len(r.error_message.splitlines())>1 else "no-result"))
            else:
                md = r.markdown.raw_markdown if hasattr(r.markdown, "raw_markdown") else str(r.markdown or "")
                open(os.path.join(PAGES, w["key"] + ".md"), "w").write(md)
                open(os.path.join(PAGES, w["key"] + ".html"), "w").write(r.html or "")
                rec.update(ok=True, status=r.status_code, md_len=len(md), final_url=r.url)
            manifest.append(rec)
    json.dump(manifest, open(os.path.join(HERE, "manifest.json"), "w"), indent=2)
    ok = sum(1 for m in manifest if m.get("ok"))
    print(f"DONE crawled {ok}/{len(manifest)}")
    for m in manifest:
        if not m.get("ok"):
            print("  FAIL", m["key"], m.get("error"))

asyncio.run(main())
