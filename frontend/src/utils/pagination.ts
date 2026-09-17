/**
 * Follow DRF's PageNumberPagination (`?page=N`, `next` links) and return
 * every page concatenated.
 *
 * The backend caps pages at 100 objects; callers that only read `results`
 * silently lose everything past the first page (audit #7). Plain-array
 * responses — unpaginated endpoints like /api/availability/ and MSW mocks —
 * pass through untouched.
 */

// Safety cap: 100/page * 50 = 5000 rows. Past that the endpoint is the
// wrong tool, and a capped loop beats an infinite one on a bad `next`.
const MAX_PAGES = 50;

interface Page<T> {
  results?: T[];
  next?: string | null;
  [key: string]: unknown;
}

function isPage<T>(data: unknown): data is Page<T> {
  return !!data && typeof data === "object" && "results" in data;
}

/** DRF `next` is absolute; authFetch only prefixes relative paths. */
function toRelative(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url; // already relative
  }
}

export async function fetchAllPages<T = unknown>(
  fetchFn: (url: string) => Promise<unknown>,
  path: string
): Promise<T[]> {
  const first = await fetchFn(path);
  if (!isPage<T>(first)) return (first as T[]) ?? [];

  const items: T[] = [...(first.results ?? [])];
  let next: string | null = first.next ?? null;
  let pages = 1;

  while (next && pages < MAX_PAGES) {
    const page: unknown = await fetchFn(toRelative(next));
    if (!isPage<T>(page)) break;
    items.push(...(page.results ?? []));
    next = page.next ?? null;
    pages += 1;
  }

  return items;
}
