/**
 * The deterministic async draw (PLAN §5.15).
 *
 * Pure, synchronous, and stores nothing: there is deliberately no assignment
 * table. A refresh, a new tab, or a return visit next week deals the
 * identical set, because the set is a function of (participant, batch,
 * question) and nothing else.
 *
 * CAVEAT, carried over from the migration: the draw depends on the batch's
 * QUESTION LIST. Adding or removing questions from an active async batch
 * reshuffles everyone's draw — a participant mid-way through can come back
 * to a different set. Compose the batch, then open it.
 */

/**
 * FNV-1a, 32-bit, plus murmur3's avalanche finalizer. Synchronous and
 * dependency-free — `crypto.subtle.digest` is async and would make the whole
 * draw async for no gain. The quality bar here is "spreads evenly and never
 * changes", not cryptographic.
 *
 * The finalizer is NOT decoration. Plain FNV-1a over strings that differ
 * only in their tail — which is exactly what
 * `${participantId}:${batchId}:${id}` is — leaves the difference as a near
 * linear offset, and the resulting order is visibly biased: measured over
 * 2000 participants drawing 4 of 12, the last few questions came up almost
 * twice as often as the first few. With the finalizer, every question lands
 * within a couple of percent of even.
 */
export function hash32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // hash *= 16777619, in 32-bit arithmetic that JS can actually do.
    hash = Math.imul(hash, 0x01000193);
  }

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;

  return hash >>> 0;
}

/**
 * `sampleSize` of null means no sampling: everyone answers all of them, in
 * `batch_questions.position` order — which is the order `questionIds`
 * already arrives in.
 */
export function drawQuestions(
  participantId: string,
  batchId: string,
  questionIds: string[],
  sampleSize: number | null,
): string[] {
  if (sampleSize === null || sampleSize >= questionIds.length) {
    return [...questionIds];
  }
  if (sampleSize <= 0) return [];

  return [...questionIds]
    .map((id) => ({
      id,
      rank: hash32(`${participantId}:${batchId}:${id}`),
    }))
    // Ties broken by id so the result is total, not merely mostly ordered.
    .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))
    .slice(0, sampleSize)
    .map((entry) => entry.id);
}
