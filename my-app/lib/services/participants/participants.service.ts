import "server-only";

import * as batches from "@/lib/services/batches";
import * as repo from "@/lib/repos/participants";
import type { RegisterParticipantInput } from "@/lib/schemas/participants";

/**
 * Anonymous by construction. The browser generates its own uuid and tells
 * the server about it (PLAN §5.14); this service only records that it
 * exists, so `responses.participant_id` has a row to point at.
 *
 * No guard: the participant surface has no auth. Its safety comes from the
 * batch token and from `submitAsync` refusing a question outside the
 * participant's draw (§7.2).
 */

export type Participant = repo.ParticipantRow;

export async function registerParticipant(
  input: RegisterParticipantInput,
): Promise<Participant> {
  // `entry_batch` is attribution, not access control — resolving the token
  // to a batch is best-effort, and an unknown token still registers the
  // participant rather than failing the visit.
  let entryBatch: string | null | undefined;
  if (input.batchToken) {
    const batch = await batches.getByToken(input.batchToken);
    entryBatch = batch?.id ?? undefined;
  }

  return repo.upsert({
    id: input.participantId,
    ...(entryBatch !== undefined ? { entryBatch } : {}),
    ...(input.displayName !== undefined
      ? { displayName: input.displayName }
      : {}),
  });
}

export function getParticipant(id: string): Promise<Participant | null> {
  return repo.getById(id);
}

/**
 * Idempotent, used on the write path before inserting a response so a lost
 * or skipped registration cannot turn into a foreign-key failure the
 * participant can do nothing about.
 */
export function ensureParticipant(
  id: string,
  entryBatch?: string,
): Promise<Participant> {
  return repo.upsert({
    id,
    ...(entryBatch !== undefined ? { entryBatch } : {}),
  });
}
