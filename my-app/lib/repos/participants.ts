import "server-only";

import { serviceClient } from "@/lib/db/server";

import { camelRow, unwrap, unwrapMaybe } from "./_shared";

/**
 * A participant is a uuid the BROWSER generated about itself
 * (`crypto.randomUUID()` in localStorage — PLAN §5.14). The server never
 * assigns one, which is what keeps the anonymity claim true: there is no
 * PII here and nothing to derive back to a person.
 */

export type ParticipantRow = {
  id: string;
  entryBatch: string | null;
  displayName: string | null;
  createdAt: string;
};

const COLUMNS = "id, entry_batch, display_name, created_at";

export async function getById(id: string): Promise<ParticipantRow | null> {
  const row = unwrapMaybe(
    await serviceClient()
      .from("participants")
      .select(COLUMNS)
      .eq("id", id)
      .maybeSingle(),
  );
  return row ? camelRow(row) : null;
}

/**
 * Idempotent register. Fields the caller does not supply are left OUT of the
 * payload, so a second visit with no display name cannot null out the one a
 * live session set.
 */
export async function upsert(input: {
  id: string;
  entryBatch?: string | null;
  displayName?: string | null;
}): Promise<ParticipantRow> {
  const payload: {
    id: string;
    entry_batch?: string | null;
    display_name?: string | null;
  } = { id: input.id };

  if (input.entryBatch !== undefined) payload.entry_batch = input.entryBatch;
  if (input.displayName !== undefined) payload.display_name = input.displayName;

  const row = unwrap(
    await serviceClient()
      .from("participants")
      .upsert(payload, { onConflict: "id" })
      .select(COLUMNS)
      .single(),
  );

  return camelRow(row);
}
