"""Copy the raw crawled markdown into the chat's knowledge base.

    python3 scripts/crawl4ai/export_pages.py
    npm run knowledge -- --index-only

Every page the crawl fetched (pages/<key>.md, listed in manifest.json) is
written to knowledge/pages/<source-slug>/<key>.md with a small frontmatter
header (source, url, crawl date) so the knowledge index can attribute it.
Sources the extractor excludes for showing other cities' events are skipped
here too, so they cannot leak into answers.
"""
import datetime as dt
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
PAGES = os.path.join(HERE, "pages")
OUT = os.path.join(REPO, "knowledge", "pages")

EXCLUDED = {"DoTheBay — Pleasanton", "DoTheBay — Pleasanton venues"}


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")[:70]


def main():
    manifest_path = os.path.join(HERE, "manifest.json")
    if not os.path.exists(manifest_path):
        raise SystemExit("manifest.json not found: run run_crawl.py first")
    manifest = json.load(open(manifest_path))

    crawled = None
    events_path = os.path.join(HERE, "events.json")
    if os.path.exists(events_path):
        crawled = json.load(open(events_path)).get("generated_at")
    if not crawled:
        crawled = dt.datetime.fromtimestamp(os.path.getmtime(manifest_path)).isoformat(timespec="seconds")

    written = 0
    for page in manifest:
        if not page.get("ok") or page.get("status") != 200:
            continue
        if page["source"] in EXCLUDED:
            continue
        src = os.path.join(PAGES, page["key"] + ".md")
        if not os.path.exists(src):
            continue
        body = open(src, encoding="utf-8", errors="replace").read().strip()
        if len(body) < 200:
            continue
        folder = os.path.join(OUT, slugify(page["source"]))
        os.makedirs(folder, exist_ok=True)
        url = page.get("final_url") or page["url"]
        header = "\n".join([
            "---",
            "kind: page",
            f"source: {page['source']}",
            f"title: {page['source']} — {page['key']}",
            f"url: {url}",
            f"crawled: {crawled}",
            f"parser: {page.get('parser', '')}",
            "---",
            "",
        ])
        with open(os.path.join(folder, page["key"] + ".md"), "w", encoding="utf-8") as f:
            f.write(header + body + "\n")
        written += 1
    print(f"wrote {written} pages under {os.path.relpath(OUT, REPO)}")


if __name__ == "__main__":
    main()
