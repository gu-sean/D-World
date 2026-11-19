// How long fetched data counts as fresh (TanStack Query `staleTime`).
// While fresh, opening the screen again shows the cached data without asking the server;
// every change still refetches because the mutations invalidate their queries.

/** Lists and details that other admins or members can change at any time. */
export const DEFAULT_STALE_MS = 30 * 1000;

/** Reference data that rarely changes (categories, difficulty levels, catalogs). */
export const REFERENCE_STALE_MS = 5 * 60 * 1000;
