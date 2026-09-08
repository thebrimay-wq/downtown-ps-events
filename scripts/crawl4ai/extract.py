"""Parsers that turn crawled pages into raw event dicts."""
import json, os, re, html as htmllib
import datetime as dt
from dateutil import parser as dparser

HERE = os.path.dirname(os.path.abspath(__file__))
PAGES = os.path.join(HERE, "pages")

TODAY = dt.date(2026, 9, 2)
HORIZON = dt.date(2027, 9, 2)

MONTH = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?"

# ---------------------------------------------------------------- helpers ---
def txt(s):
    if not s: return None
    s = re.sub(r"<[^>]+>", " ", str(s))
    s = htmllib.unescape(s)
    s = re.sub(r"\s+", " ", s).strip()
    return s or None

def parse_date(s, default_year=None):
    """Return a date, or None. Tolerant of the messy strings these sites emit."""
    if not s: return None
    s = re.sub(r"\s+", " ", str(s)).strip().strip("*")
    try:
        base = dt.datetime(default_year or TODAY.year, TODAY.month, 1)
        d = dparser.parse(s, fuzzy=True, default=base)
        return d.date()
    except Exception:
        return None

def parse_time(s):
    if not s: return None
    m = re.search(r"(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?", s, re.I)
    if not m: return None
    h = int(m.group(1)) % 12
    if m.group(3).lower() == "p": h += 12
    return dt.time(h, int(m.group(2) or 0))

def read(key, ext="md"):
    p = os.path.join(PAGES, key + "." + ext)
    return open(p, encoding="utf-8", errors="ignore").read() if os.path.exists(p) else ""

def ev(**kw):
    kw.setdefault("tags", [])
    return kw

# ------------------------------------------------------------- json-ld ------
def _walk_events(node, acc):
    if isinstance(node, list):
        for n in node: _walk_events(n, acc)
    elif isinstance(node, dict):
        t = node.get("@type")
        ts = " ".join(t) if isinstance(t, list) else str(t or "")
        if "event" in ts.lower() and node.get("name"): acc.append(node)
        for k in ("@graph", "itemListElement", "item", "subEvent", "mainEntity"):
            if k in node: _walk_events(node[k], acc)

def parse_jsonld(html, url, source, group):
    out, nodes = [], []
    for m in re.finditer(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
                         html, re.S | re.I):
        raw = m.group(1).strip()
        try: _walk_events(json.loads(raw), nodes)
        except Exception:
            for chunk in re.findall(r"\{.*?\}(?=\s*[\{\[]|\s*$)", raw, re.S):
                try: _walk_events(json.loads(chunk), nodes)
                except Exception: pass
    for n in nodes:
        loc = n.get("location") or {}
        if isinstance(loc, list): loc = loc[0] if loc else {}
        venue = txt(loc.get("name")) if isinstance(loc, dict) else txt(loc)
        addr = ""
        if isinstance(loc, dict):
            a = loc.get("address")
            if isinstance(a, str): addr = a
            elif isinstance(a, dict):
                addr = ", ".join(filter(None, [txt(a.get("streetAddress")), txt(a.get("addressLocality")),
                                               txt(a.get("addressRegion")), txt(a.get("postalCode"))]))
        offers = n.get("offers") or {}
        if isinstance(offers, list): offers = offers[0] if offers else {}
        price = None
        if isinstance(offers, dict) and offers.get("price") is not None:
            p = str(offers["price"])
            price = "Free" if p in ("0", "0.0", "0.00") else f"${p}"
        img = n.get("image")
        if isinstance(img, list): img = img[0] if img else None
        if isinstance(img, dict): img = img.get("url")
        out.append(ev(title=txt(n.get("name")), start=txt(n.get("startDate")), end=txt(n.get("endDate")),
                      venue=venue, address=txt(addr), description=txt(n.get("description")),
                      image=txt(img), url=txt(n.get("url")) or url, price=price,
                      source=source, group=group, method="json-ld"))
    return out

# ------------------------------------------------------- The Events Calendar -
def parse_tribe_api(md, url, source, group):
    m = re.search(r"\{.*\}", md, re.S)
    if not m: return []
    try: data = json.loads(m.group(0))
    except Exception: return []
    out = []
    for e in data.get("events", []):
        v = e.get("venue") or {}
        addr = ", ".join(filter(None, [txt(v.get("address")), txt(v.get("city")),
                                       txt(v.get("state")), txt(v.get("zip"))]))
        cats = [txt(c.get("name")) for c in (e.get("categories") or []) if c.get("name")]
        out.append(ev(title=txt(e.get("title")), start=e.get("start_date"), end=e.get("end_date"),
                      venue=txt(v.get("venue")), address=addr or None,
                      description=txt(e.get("description")),
                      image=(e.get("image") or {}).get("url") if isinstance(e.get("image"), dict) else None,
                      url=e.get("url"), price=txt(e.get("cost")) or None, tags=cats,
                      source=source, group=group, method="tribe-api"))
    return out

# --------------------------------------------------------------- lvwine -----
LV_DETAIL = re.compile(
    r"^\*\*(?P<d1>[A-Z][a-z]+ \d{1,2}, \d{4})\s*(?:-\s*(?P<d2>[A-Z][a-z]+ \d{1,2}, \d{4}))?"
    r"\s*(?:\((?P<time>[^)]*)\))?\*\*\s*(?P<rest>.*)$")

def parse_lvwine(md, url, source, group):
    lines = md.splitlines()
    out = []
    for i, line in enumerate(lines):
        if not line.startswith("## "): continue
        title = txt(re.sub(r"^##\s*", "", line))
        if not title or len(title) > 180: continue
        detail = lines[i + 1] if i + 1 < len(lines) else ""
        m = LV_DETAIL.match(detail.strip())
        if not m: continue
        rest = m.group("rest")
        vm = re.match(r"(?P<venue>[^<]*)<(?P<vurl>[^>]*)>(?P<addr>[^\[]*?)\s*-\s*\[directions\]", rest)
        venue = txt(vm.group("venue")) if vm else None
        addr = txt(vm.group("addr")) if vm else None
        cost = re.search(r"\*\*Cost:\*\*\s*([^\[\n]{1,80})", rest)
        ticket = re.search(r"\[Buy Tickets\]\(([^)]+)\)", rest)
        desc = txt(lines[i + 2]) if i + 2 < len(lines) else None
        out.append(ev(title=title, start=m.group("d1"), end=m.group("d2"),
                      time_text=m.group("time"), venue=venue, address=addr,
                      description=desc, price=txt(cost.group(1)) if cost else None,
                      ticket=ticket.group(1) if ticket else None, url=url,
                      source=source, group=group, method="lvwine"))
    return out

# ---------------------------------------------------------------- vibe ------
VIBE_URL = re.compile(r"https://vibetrivalley\.com/event/([a-z0-9\-]+?)-(\d{4}-\d{2}-\d{2})/")

def parse_vibe(md, url, source, group):
    lines = md.splitlines()
    out, seen = [], set()
    for i, line in enumerate(lines):
        m = VIBE_URL.search(line)
        if not m: continue
        link, date = m.group(0), m.group(2)
        if link in seen: continue
        seen.add(link)
        # Walk back for: "## - end", "## start", "Day, Mon D", "## [Venue](...)", "## Title"
        title = venue = start_t = end_t = None
        for j in range(i - 1, max(i - 12, -1), -1):
            l = lines[j].strip()
            if not l: continue
            vm = re.match(r"^##\s*\[(.+?)\]\(https://vibetrivalley\.com/venue/", l)
            if vm and not venue: venue = txt(vm.group(1)); continue
            tm = re.match(r"^##\s*-?\s*(\d{1,2}(?::\d{2})?\s*[ap]m)\s*$", l, re.I)
            if tm:
                if end_t is None and l.lstrip("# ").startswith("-"): end_t = tm.group(1)
                elif start_t is None: start_t = tm.group(1)
                continue
            if re.match(r"^[A-Z][a-z]{2},\s+[A-Z][a-z]{2}\s+\d{1,2}$", l): continue
            hm = re.match(r"^##\s+(.{3,180})$", l)
            if hm and venue is not None:
                cand = txt(hm.group(1))
                if cand and cand.lower() not in ("featured", "featured events"):
                    title = cand; break
        if not title:
            title = txt(m.group(1).replace("-", " ")).title()
        out.append(ev(title=title, start=date, venue=venue, time_text=start_t,
                      end_time_text=end_t, url=link, source=source, group=group,
                      method="vibe"))
    return out

# -------------------------------------------------------------- acfair ------
def parse_acfair(md, url, source, group):
    lines = [l.strip() for l in md.splitlines()]
    out = []
    daterx = re.compile(rf"^##\s*((?:{MONTH})\s*\d{{1,2}}(?:\s*[-–]\s*(?:{MONTH})?\s*\d{{1,2}})?,?\s*\d{{4}})\s*$", re.I)
    for i, l in enumerate(lines):
        if not l.startswith("## "): continue
        title = txt(l[3:])
        if not title or len(title) > 150: continue
        for j in (i + 1, i + 2):
            if j >= len(lines): break
            dm = daterx.match(lines[j])
            if dm:
                span = dm.group(1)
                parts = re.split(r"\s*[-–]\s*", span)
                start = parts[0]
                yr = re.search(r"\d{4}", span)
                if yr and not re.search(r"\d{4}", start): start = f"{start}, {yr.group(0)}"
                end = None
                if len(parts) > 1:
                    end = parts[1]
                    if not re.search(rf"{MONTH}", end, re.I):
                        end = re.match(rf"({MONTH})", start, re.I).group(1) + " " + end
                    if yr and not re.search(r"\d{4}", end): end = f"{end}, {yr.group(0)}"
                # grab following prose as description
                desc = next((txt(x) for x in lines[j+1:j+8] if x and not x.startswith(("!", "#", "["))), None)
                out.append(ev(title=title, start=start, end=end, description=desc,
                              venue="Alameda County Fairgrounds",
                              address="4501 Pleasanton Ave, Pleasanton, CA 94566",
                              url=url, source=source, group=group, method="acfair"))
                break
    return out

# ----------------------------------------------------------------- pda ------
PDA_DATE = re.compile(
    rf"((?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),?\s*)?"
    rf"({MONTH})\s+(\d{{1,2}})(?:\s*[-–&]\s*\d{{1,2}})?,?\s*(20\d{{2}})?", re.I)

def parse_pda(md, url, source, group):
    lines = [l for l in md.splitlines()]
    # Title: first H1/H2 after the nav block.
    body = md.split("Use tab to navigate through the menu items.")[-1]
    title = None
    for l in body.splitlines():
        m = re.match(r"^#{1,2}\s+(.{3,120})$", l.strip())
        if m and not re.search(r"contact us|volunteer", m.group(1), re.I):
            title = txt(m.group(1)); break
    if not title:
        title = txt(url.rstrip("/").split("/")[-1].replace("-", " ")).title()
    out = []
    for m in PDA_DATE.finditer(body):
        mon, day, yr = m.group(2), m.group(3), m.group(4)
        yr = yr or ("2026" if dt.date(2026, 1, 1) else None)
        start = f"{mon} {day}, {yr}"
        d = parse_date(start)
        if not d or not (TODAY <= d <= HORIZON): continue
        ctx = txt(body[max(0, m.start() - 200): m.end() + 300])
        out.append(ev(title=title, start=start, description=ctx,
                      venue="Downtown Pleasanton", address="Main Street, Pleasanton, CA 94566",
                      url=url, source=source, group=group, method="pda"))
        break  # one page = one signature event
    return out

# ---------------------------------------------------------------- patch -----
PATCH_LINK = re.compile(
    r"\[(?P<text>.{5,900}?)\]\((?P<href>https://patch\.com/california/pleasanton/calendar/event/(?P<ymd>\d{8})/[^)]+)\)")

def parse_patch(md, url, source, group):
    out = []
    for m in PATCH_LINK.finditer(md):
        t = m.group("text")
        t = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", t)
        tm = re.match(rf"(?P<title>.+?)(?:{MONTH})\s*\d{{1,2}}\s*(?P<time>\d{{1,2}}:\d{{2}}\s*[AP]M)?(?P<rest>.*)$", t, re.I | re.S)
        if not tm: continue
        title = txt(re.sub(r"^[#*\s>]+", "", tm.group("title")))
        rest = txt(tm.group("rest") or "")
        addr = None
        am = re.match(r"^(.{5,120}?,\s*(?:CA|California))\b", rest or "")
        if am: addr = am.group(1); rest = (rest or "")[am.end():].strip()
        ymd = m.group("ymd")
        if not title or len(title) < 4: continue
        out.append(ev(title=title, start=f"{ymd[:4]}-{ymd[4:6]}-{ymd[6:]}",
                      time_text=tm.group("time"), address=addr, description=txt(rest) or None,
                      url=m.group("href"), source=source, group=group, method="patch"))
    return out

# ------------------------------------------------------------- pweekly -----
def _slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")

PW_LINK = re.compile(
    r"\[(?P<text>[^\]]{5,900})\]\((?P<href>https://www\.pleasantonweekly\.com/calendar/#!/details/(?P<slug>[^/]+)/(?P<id>\d+)/(?P<iso>\d{4}-\d{2}-\d{2})T(?P<hh>\d{2}))\)")

def parse_pweekly(md, url, source, group):
    out = []
    for m in PW_LINK.finditer(md):
        t = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", m.group("text"))
        parts = t.split("|", 1)
        head = parts[0].strip()
        # The link text runs "TitleVenue | City, CA…" with no separator. The
        # detail URL carries a slug of the title alone, so use it as the ruler.
        slug = m.group("slug")
        title = venue = None
        for i in range(4, len(head) + 1):
            if _slugify(head[:i]) == slug:
                title, venue = head[:i].strip(), head[i:].strip()
                break
        if title is None:
            half = len(head) // 2
            title = head[:half] if head[:half] and head[:half] == head[half:half * 2] else head
        title = txt(title)
        venue = txt(venue)
        city = desc = None
        if len(parts) > 1:
            cm = re.match(r"\s*([A-Za-z .'-]+,\s*CA)(.*)$", parts[1], re.S)
            if cm: city, desc = cm.group(1).strip(), txt(cm.group(2))
            else: desc = txt(parts[1])
            # The widget appends "10:00 am5.3 mi" (start time + distance from
            # the reader) to every blurb; that is chrome, not description.
            if desc:
                desc = txt(re.sub(r"\s*\d{1,2}:\d{2}\s*[ap]m\s*[\d.]+\s*mi\s*$", "", desc))
        if not title or len(title) < 4: continue
        out.append(ev(title=title, start=m.group("iso"), time_text=f"{m.group('hh')}:00",
                      venue=venue, address=city, description=desc, url=m.group("href"),
                      source=source, group=group, method="pweekly"))
    return out

# ------------------------------------------------------------- dothebay ----
DTB = re.compile(r"\[(?P<text>[^\]]{4,200})\]\((?P<href>https://dothebay\.com/events/(?P<y>\d{4})/(?P<m>\d{1,2})/(?P<d>\d{1,2})/[^)]+)\)")

def parse_dothebay(md, url, source, group):
    out, seen = [], set()
    for mm in DTB.finditer(md):
        href = mm.group("href")
        if href in seen: continue
        seen.add(href)
        title = txt(re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", mm.group("text")))
        if not title or len(title) < 4: continue
        out.append(ev(title=title, start=f"{mm.group('y')}-{int(mm.group('m')):02d}-{int(mm.group('d')):02d}",
                      url=href, source=source, group=group, method="dothebay"))
    return out

# ------------------------------------------------------------- generic -----
HEAD = re.compile(r"^#{1,4}\s+(.{4,140}?)\s*$")
DATE_ANY = re.compile(rf"\b({MONTH}\.?\s+\d{{1,2}}(?:\s*[-–]\s*\d{{1,2}})?(?:,?\s*20\d{{2}})?|\d{{4}}-\d{{2}}-\d{{2}}|\d{{1,2}}/\d{{1,2}}/\d{{2,4}})\b", re.I)
NAV_NOISE = re.compile(r"^(home|about|menu|contact|events?|calendar|search|more|login|sign in|hours|directions|privacy|newsletter)$", re.I)

def parse_generic(md, html, url, source, group):
    out = parse_jsonld(html, url, source, group)
    if out: return out
    lines = [l.strip() for l in md.splitlines()]
    for i, l in enumerate(lines):
        hm = HEAD.match(l)
        if not hm: continue
        title = txt(re.sub(r"\[(.+?)\]\([^)]*\)", r"\1", hm.group(1)))
        if not title or NAV_NOISE.match(title): continue
        window = " ".join(x for x in lines[i:i + 4] if x)
        dm = DATE_ANY.search(window)
        if not dm: continue
        if DATE_ANY.match(title): continue
        link = re.search(r"\((https?://[^)]+)\)", " ".join(lines[i:i + 3]))
        desc = next((txt(x) for x in lines[i+1:i+6] if x and not x.startswith(("!", "#", "*", "|"))), None)
        out.append(ev(title=title, start=dm.group(1), description=desc,
                      url=(link.group(1) if link else url), source=source, group=group,
                      method="generic"))
    return out


# ------------------------------------------------------------- bankhead ----
BH_DAY = re.compile(r"^(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)(?P<mon>[A-Z][a-z]{2})(?P<day>\d{1,2})\s*$")
BH_EVENT = re.compile(r"^\*\s*\[(?:!\[[^\]]*\]\([^)]*\))?(?P<title>[^\]]{3,200})\]\((?P<href>https?://[^)]+)\)\s*$")
BH_TIME = re.compile(r"^\*\s*(?:\[)?(?P<time>\d{1,2}(?::\d{2})?\s*[ap]m)")

def parse_bankhead(md, url, source, group):
    yr = re.search(r"month=[A-Za-z]+\+?(\d{4})", url)
    year = int(yr.group(1)) if yr else TODAY.year
    out, cur = [], None
    lines = md.splitlines()
    for i, raw in enumerate(lines):
        l = raw.strip()
        dm = BH_DAY.match(l)
        if dm:
            cur = (dm.group("mon"), int(dm.group("day")))
            continue
        if cur is None: continue
        em = BH_EVENT.match(l)
        if not em: continue
        title = txt(em.group("title"))
        if not title or "livermorearts.org/events/" not in em.group("href"): continue
        tm = BH_TIME.match(lines[i + 1].strip()) if i + 1 < len(lines) else None
        note = txt(re.sub(r"\[[^\]]*\]\([^)]*\)", " ", lines[i + 1])) if i + 1 < len(lines) else None
        # A January page reached from a September URL still belongs to the next year.
        y = year
        out.append(ev(title=title, start=f"{cur[0]} {cur[1]}, {y}",
                      time_text=tm.group("time") if tm else None,
                      venue="Bankhead Theater", address="2400 First St, Livermore, CA 94550",
                      description=note or None, url=em.group("href"),
                      source=source, group=group, method="bankhead"))
    return out

PARSERS = {
    "tribe_api": lambda md, html, u, s, g: parse_tribe_api(md, u, s, g),
    "lvwine":    lambda md, html, u, s, g: parse_lvwine(md, u, s, g),
    "vibe":      lambda md, html, u, s, g: parse_vibe(md, u, s, g),
    "acfair":    lambda md, html, u, s, g: parse_acfair(md, u, s, g),
    "pda":       lambda md, html, u, s, g: parse_pda(md, u, s, g),
    "patch":     lambda md, html, u, s, g: parse_patch(md, u, s, g),
    "pweekly":   lambda md, html, u, s, g: parse_pweekly(md, u, s, g),
    "dothebay":  lambda md, html, u, s, g: parse_dothebay(md, u, s, g),
    "jsonld":    lambda md, html, u, s, g: parse_jsonld(html, u, s, g),
    "bankhead":  lambda md, html, u, s_, g: parse_bankhead(md, u, s_, g),
    "generic":   parse_generic,
}
