import "server-only";

import * as repo from "@/lib/repos/principles";

import {
  idsByCode,
  indexByCode,
  type PrincipleIndex,
} from "./principles.util";

/**
 * READ-ONLY (D15). The rubric is fixed vocabulary seeded into the database;
 * there is no create, update or delete here and no action module anywhere.
 * S3/I3 ship inactive with empty names until Josh writes them (§3), and the
 * Principles screen renders that as "needs writing" rather than hiding it.
 */

export type Principle = repo.PrincipleRow;
export type PrincipleWithUsage = repo.PrincipleWithUsageRow;
export type { PrincipleIndex, PrincipleRef } from "./principles.util";

/** All six, including inactive, in rubric order. */
export function listPrinciples(): Promise<Principle[]> {
  return repo.list();
}

/** Same, with "how many questions touch this code" for the admin screen. */
export function listPrinciplesWithUsage(): Promise<PrincipleWithUsage[]> {
  return repo.listWithUsage();
}

/**
 * The map T1 hydration takes. Its own read rather than a parameter, because
 * every caller that needs it needs exactly this and nothing else — see
 * lib/services/questions/hydrate.util.ts.
 */
export async function principlesByCode(): Promise<PrincipleIndex> {
  return indexByCode(await repo.list());
}

/** code → id, for writing `question_principles` when a question is saved. */
export async function principleIdsByCode(): Promise<Record<string, string>> {
  return idsByCode(await repo.list());
}

/** Only codes an author may reference — S3/I3 are not authorable (§3). */
export async function listActivePrinciples(): Promise<Principle[]> {
  const rows = await repo.list();
  return rows.filter((row) => row.active && row.name.trim().length > 0);
}
