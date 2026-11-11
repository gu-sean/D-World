export const toIso = (value) => (value ? value.toISOString() : undefined);

/** The version that is in force now: latest effectiveAt that is not in the future. */
export function pickCurrent(items, now = Date.now()) {
  return items
    .filter((item) => new Date(item.effectiveAt).getTime() <= now)
    .sort(
      (a, b) =>
        new Date(b.effectiveAt) - new Date(a.effectiveAt) ||
        (b.versionNo ?? 0) - (a.versionNo ?? 0),
    )[0];
}
