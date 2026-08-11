import "server-only";

import type { Database } from "@/lib/db/database.types";
import { serviceClient } from "@/lib/db/server";

import { mapPostgrestError, unwrap } from "./_shared";

/**
 * The staff table finally gets a repo (Wave 1). `lib/auth` keeps its own
 * narrow one-row read — that one is the auth boundary and deliberately
 * imports nothing from here — but everything else (the staff screen, the
 * reports' pod selector) goes through this.
 */

export type StaffRoleValue = Database["public"]["Enums"]["staff_role"];

export type StaffRow = {
  userId: string;
  role: StaffRoleValue;
  email: string | null;
  displayName: string | null;
  createdAt: string;
};

const COLUMNS = "user_id, role, email, display_name, created_at";

export async function list(): Promise<StaffRow[]> {
  const rows = unwrap(
    await serviceClient()
      .from("staff")
      .select(COLUMNS)
      .order("created_at", { ascending: true }),
  );
  return rows.map(mapRow);
}

export async function upsert(input: {
  userId: string;
  role: StaffRoleValue;
  email?: string | null;
  displayName?: string | null;
}): Promise<StaffRow> {
  const result = await serviceClient()
    .from("staff")
    .upsert(
      {
        user_id: input.userId,
        role: input.role,
        email: input.email ?? null,
        display_name: input.displayName ?? null,
      },
      { onConflict: "user_id" },
    )
    .select(COLUMNS)
    .single();

  if (result.error) throw mapPostgrestError(result.error);
  return mapRow(unwrap(result));
}

export async function updateRole(
  userId: string,
  role: StaffRoleValue,
): Promise<void> {
  const result = await serviceClient()
    .from("staff")
    .update({ role })
    .eq("user_id", userId);
  if (result.error) throw mapPostgrestError(result.error);
}

/** Removes ACCESS, not the person's history: batches they own keep their
 * owner_id (auth.users survives), their links cascade away with the staff
 * row, and answers that came through those links keep the batch but lose
 * the pod attribution (batch_link_id set null). */
export async function remove(userId: string): Promise<void> {
  const result = await serviceClient()
    .from("staff")
    .delete()
    .eq("user_id", userId);
  if (result.error) throw mapPostgrestError(result.error);
}

function mapRow(row: {
  user_id: string;
  role: StaffRoleValue;
  email: string | null;
  display_name: string | null;
  created_at: string;
}): StaffRow {
  return {
    userId: row.user_id,
    role: row.role,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}
