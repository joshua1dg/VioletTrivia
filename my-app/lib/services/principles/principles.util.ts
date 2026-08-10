import type { PrincipleRow } from "@/lib/repos/principles";

/**
 * Pure, no client. Every `*.util.ts` in `lib/services` is like this — it is
 * what makes the business rules readable in isolation (PLAN §5.3).
 */

/** What hydration needs: the reference data T1's content only references. */
export type PrincipleRef = { code: string; name: string; descriptor: string };

/** Lookup by code — the map `hydrate.util.ts` takes. */
export type PrincipleIndex = Record<string, PrincipleRef>;

export function indexByCode(rows: PrincipleRow[]): PrincipleIndex {
  const index: PrincipleIndex = {};
  for (const row of rows) {
    index[row.code] = {
      code: row.code,
      name: row.name,
      // `short_descriptor` is nullable and S3/I3 have neither name nor
      // descriptor yet (§3). Hydration must still produce a valid shape, so
      // the gap renders as empty rather than breaking the parse.
      descriptor: row.shortDescriptor ?? "",
    };
  }
  return index;
}

/** code → id, for writing `question_principles` on save. */
export function idsByCode(rows: PrincipleRow[]): Record<string, string> {
  const index: Record<string, string> = {};
  for (const row of rows) index[row.code] = row.id;
  return index;
}
