import "server-only";

import { serviceClient } from "@/lib/db/server";

import { mapPostgrestError, unwrap } from "./_shared";

/**
 * Pod links (PODS.md Wave 1): a second front door to an existing batch,
 * owned by a staff member so answers arriving through it attribute to
 * their pod. Pure data access — which door may be created or read is the
 * service layer's question (`lib/services/batches`).
 */

export type BatchLinkRow = {
  id: string;
  batchId: string;
  ownerId: string;
  token: string;
  createdAt: string;
};

const COLUMNS = "id, batch_id, owner_id, token, created_at";

export async function getByToken(token: string): Promise<BatchLinkRow | null> {
  const result = await serviceClient()
    .from("batch_links")
    .select(COLUMNS)
    .eq("token", token)
    .maybeSingle();

  if (result.error) throw mapPostgrestError(result.error);
  return result.data ? mapRow(result.data) : null;
}

/** The (batch, owner) pair is unique — "Get my pod link" is idempotent, so
 * insert races resolve by re-reading the winner. */
export async function getOrCreate(input: {
  batchId: string;
  ownerId: string;
  token: string;
}): Promise<BatchLinkRow> {
  const existing = await getForOwnerAndBatch(input.ownerId, input.batchId);
  if (existing) return existing;

  const result = await serviceClient()
    .from("batch_links")
    .insert({
      batch_id: input.batchId,
      owner_id: input.ownerId,
      token: input.token,
    })
    .select(COLUMNS)
    .single();

  if (result.error) {
    // Unique violation on (batch, owner): someone double-clicked. The row
    // they created is the answer.
    if (result.error.code === "23505") {
      const winner = await getForOwnerAndBatch(input.ownerId, input.batchId);
      if (winner) return winner;
    }
    throw mapPostgrestError(result.error);
  }

  return mapRow(unwrap(result));
}

async function getForOwnerAndBatch(
  ownerId: string,
  batchId: string,
): Promise<BatchLinkRow | null> {
  const result = await serviceClient()
    .from("batch_links")
    .select(COLUMNS)
    .eq("owner_id", ownerId)
    .eq("batch_id", batchId)
    .maybeSingle();

  if (result.error) throw mapPostgrestError(result.error);
  return result.data ? mapRow(result.data) : null;
}

/** Every link one owner holds — the lead-facing batch view. */
export async function listForOwner(ownerId: string): Promise<BatchLinkRow[]> {
  const rows = unwrap(
    await serviceClient()
      .from("batch_links")
      .select(COLUMNS)
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: true }),
  );
  return rows.map(mapRow);
}

/** Every link, for the report layer's link→owner attribution map. */
export async function listAll(): Promise<BatchLinkRow[]> {
  const rows = unwrap(
    await serviceClient()
      .from("batch_links")
      .select(COLUMNS)
      .order("created_at", { ascending: true }),
  );
  return rows.map(mapRow);
}

function mapRow(row: {
  id: string;
  batch_id: string;
  owner_id: string;
  token: string;
  created_at: string;
}): BatchLinkRow {
  return {
    id: row.id,
    batchId: row.batch_id,
    ownerId: row.owner_id,
    token: row.token,
    createdAt: row.created_at,
  };
}
