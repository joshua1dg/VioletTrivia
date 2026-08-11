import type { ReportResponseRow } from "@/lib/repos/reports";
import type { AuthoredQuestion } from "@/lib/services/questions";

import { dedupeToFirstAnswer } from "./dedupe.util";
import { gradeResponses, type GradedResponse } from "./grade.util";

/**
 * Pure — no client, no io (this folder's rule). THE pod-slice primitive
 * (PODS.md's attribution model), used by every report read that needs one.
 *
 * A response counts for a pod lead when ANY of three signals says so —
 * an OR, not an accumulation, since a lead's own batch run live must count
 * once, not twice:
 *   1. it arrived through that lead's link on a (master) batch;
 *   2. it belongs to a batch that lead owns (their own custom batch, run
 *      through its ordinary token — no link involved);
 *   3. it was answered live in a session that lead hosted.
 */
export type PodAttribution = {
  linkOwnerById: Map<string, string>;
  batchOwnerById: Map<string, string>;
  sessionHostById: Map<string, string>;
};

export function buildPodAttribution(
  links: { id: string; ownerId: string }[],
  batches: { id: string; ownerId: string | null }[],
  sessions: { id: string; hostId: string | null }[],
): PodAttribution {
  return {
    linkOwnerById: new Map(links.map((l) => [l.id, l.ownerId])),
    batchOwnerById: new Map(
      batches.flatMap((b) => (b.ownerId ? [[b.id, b.ownerId] as const] : [])),
    ),
    sessionHostById: new Map(
      sessions.flatMap((s) => (s.hostId ? [[s.id, s.hostId] as const] : [])),
    ),
  };
}

/** Every row attributable to this pod lead, by any one of the three
 * signals. Order-preserving — callers that dedupe-by-first-answer after
 * this still see the true chronological first. */
export function filterToPod(
  rows: ReportResponseRow[],
  podId: string,
  attribution: PodAttribution,
): ReportResponseRow[] {
  return rows.filter((row) => {
    if (
      row.batchLinkId &&
      attribution.linkOwnerById.get(row.batchLinkId) === podId
    )
      return true;
    if (row.batchId && attribution.batchOwnerById.get(row.batchId) === podId)
      return true;
    if (
      row.liveSessionId &&
      attribution.sessionHostById.get(row.liveSessionId) === podId
    )
      return true;
    return false;
  });
}

/** The pod's slice of an already-fetched response set, carried through the
 * SAME dedupe→grade pipeline the org/batch numbers use — so a pod's number
 * and the project's number are directly comparable, never computed by two
 * different paths. `firstAnswers` is exposed for callers that need the raw
 * deduped rows too (tallies, feedback text). */
export type PodSlice = {
  podId: string;
  responseCount: number;
  duplicateCount: number;
  correct: number;
  total: number;
  graded: GradedResponse[];
  firstAnswers: ReportResponseRow[];
};

export function buildPodSlice(
  rows: ReportResponseRow[],
  podId: string,
  attribution: PodAttribution,
  questionsById: Map<string, AuthoredQuestion>,
): PodSlice {
  const podRows = filterToPod(rows, podId, attribution);
  const firstAnswers = dedupeToFirstAnswer(podRows);
  const graded = gradeResponses(firstAnswers.rows, questionsById);
  const gradeable = graded.filter((g) => g.grade !== null);

  return {
    podId,
    responseCount: firstAnswers.rows.length,
    duplicateCount: firstAnswers.duplicateCount,
    correct: gradeable.filter((g) => g.grade === 1).length,
    total: gradeable.length,
    graded,
    firstAnswers: firstAnswers.rows,
  };
}
