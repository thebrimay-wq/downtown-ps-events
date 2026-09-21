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
//
// Every caller must order by a unique column last (`.order("id")` after the
// real sort key): 261 events share the all-day noon placeholder timestamp,
// and Postgres does not promise a stable order among ties across separate
// OFFSET queries, so without the tiebreaker a row can land on both sides of
// a page boundary while another is skipped.
//
// On an error the read stops and returns what it has, with the error logged:
// a public page is better served short than not at all. Anything that
// writes on the strength of the result must use the strict variant.
export async function fetchAllRows(build: () => RangeableQuery): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("fetchAllRows: page failed, returning a partial set", error);
      break;
    }
    if (!data?.length) break;
    rows.push(...(data as Row[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

// Same paging, but a failed page throws. The scraper dedupes against this
// set; a partial one would make every unseen event look new and get it
// inserted again.
export async function fetchAllRowsStrict(build: () => RangeableQuery): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Paged read failed at row ${from}: ${JSON.stringify(error)}`);
    if (!data?.length) break;
    rows.push(...(data as Row[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}
