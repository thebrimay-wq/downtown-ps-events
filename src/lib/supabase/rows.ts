// ---------------------------------------------------------------------------
// PostgREST caps a single response at 1,000 rows and gives no error when it
// truncates, so an unpaginated select silently loses everything past the
// thousandth row. The dataset is already past that: a read that forgets to
// page drops events from the calendar, submissions from the moderation
// queue, or (worst) existing rows from the scraper's dedupe set, so every
// scheduled run re-inserts them. Every whole-table read goes through here.
// ---------------------------------------------------------------------------

export const PAGE_SIZE = 1000;

export type Row = Record<string, unknown>;

// Typed by what pagination actually needs, rather than by supabase-js's
// generics, which are awkward to name at a call boundary like this.
export type RangeableQuery = PromiseLike<{ data: Row[] | null; error: unknown }> & {
  range: (from: number, to: number) => PromiseLike<{
    data: Row[] | null;
    error: unknown;
  }>;
};

// `build` must return a fresh query each time: a supabase-js builder is a
// one-shot thenable, so reusing one across pages would re-run the first.
// Pages until a short response says we have them all.
export async function fetchAllRows(build: () => RangeableQuery): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error) break;
    if (!data?.length) break;
    rows.push(...(data as Row[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}
