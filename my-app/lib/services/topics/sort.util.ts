/**
 * Pure, no client (PLAN §5.3).
 *
 * Sort orders are spaced by ten so a single insert between two neighbours
 * does not need the whole list renumbered.
 */

export function nextSortOrder(rows: Array<{ sortOrder: number }>): number {
  if (rows.length === 0) return 10;
  return Math.max(...rows.map((row) => row.sortOrder)) + 10;
}
