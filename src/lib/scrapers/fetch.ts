// Polite, resilient HTTP fetch for scraping. Sends a descriptive User-Agent,
// times out, and surfaces a clear error on non-OK responses.

const USER_AGENT =
  "PleasantonEventsHubBot/1.0 (+https://github.com/; community event aggregator)";

export async function fetchHtml(
  url: string,
  timeoutMs = 20000,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
      // Always fetch fresh content for scrapes.
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}
