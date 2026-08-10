import "server-only";

import { serviceClient } from "@/lib/db/server";

import { camelRow, unwrap } from "./_shared";

/**
 * The rubric. READ-ONLY (D15) — there is no insert, update or delete here
 * and there should never be one. S3/I3 arrive from `supabase/seed.sql` with
 * empty names; changing the vocabulary is a seed edit plus `supabase db
 * reset`, not a UI action.
 *
 * No jsonb on this table, so nothing to parse and nothing to soft-fail.
 */

export type PrincipleRow = {
  id: string;
  code: string;
  name: string;
  shortDescriptor: string | null;
  fullDescription: string | null;
  sortOrder: number;
  active: boolean;
};

export type PrincipleWithUsageRow = PrincipleRow & { questionCount: number };

const COLUMNS =
  "id, code, name, short_descriptor, full_description, sort_order, active";

/** Every principle, including inactive ones, in rubric order. */
export async function list(): Promise<PrincipleRow[]> {
  const rows = unwrap(
    await serviceClient()
      .from("principles")
      .select(COLUMNS)
      .order("sort_order", { ascending: true }),
  );

  return rows.map(camelRow);
}

/** Same, plus how many questions reference each code. */
export async function listWithUsage(): Promise<PrincipleWithUsageRow[]> {
  const rows = unwrap(
    await serviceClient()
      .from("principles")
      .select(`${COLUMNS}, question_principles(count)`)
      .order("sort_order", { ascending: true }),
  );

  return rows.map(({ question_principles, ...row }) => ({
    ...camelRow(row),
    // PostgREST returns an embedded aggregate as a one-element array.
    questionCount: question_principles?.[0]?.count ?? 0,
  }));
}
