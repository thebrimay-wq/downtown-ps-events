// ---------------------------------------------------------------------------
// A small sliding-window rate limit, kept in memory. On Cloudflare each
// isolate keeps its own counts, so treat this as a speed bump against a
// runaway script or a stuck client, not as a hard quota.
// ---------------------------------------------------------------------------

const hits = new Map<string, number[]>();

export function rateLimited(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep the map from growing without bound.
  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }
  return false;
}
