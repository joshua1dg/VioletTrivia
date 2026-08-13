import "server-only";

import { cache } from "react";

import { authClient, serviceClient } from "@/lib/db/server";
import { AppError } from "@/lib/errors";

/**
 * Bootstrap flow (D2 — Supabase Auth, no public signup):
 *
 *   1. Copy .env.example to .env.local, fill ADMIN_EMAIL / ADMIN_PASSWORD.
 *   2. `pnpm --dir my-app bootstrap:admin` — creates the auth user (or
 *      reuses it if it already exists) and upserts a `staff` row with
 *      role = 'admin'. See scripts/bootstrap-admin.ts.
 *   3. Sign in at /login with that email/password.
 *
 * `supabase db reset` wipes `auth.users`, so re-run bootstrap:admin after
 * every reset. Locally, `admin@violet.local` is already bootstrapped.
 *
 * There is no signup route anywhere in the app — staff are provisioned
 * only via this script (or, later, by another admin inserting a row).
 */

/** `pod_lead | dol | admin` (settled 2026-08-11; the middle tier was
 * born "project_lead" and renamed to DOL — the org's real term —
 * 2026-08-13). One project — the app is it — so DOL is a role, not a
 * role plus a grouping table. Derived from the DB enum so a migration
 * can't drift from this type silently. */
export type StaffRole =
  import("@/lib/db/database.types").Database["public"]["Enums"]["staff_role"];

export type Staff = {
  userId: string;
  email: string;
  role: StaffRole;
};

/**
 * THE scope question, asked the same way everywhere (PODS.md decision 4):
 * read access is full for every tier; roles gate what you can CHANGE and
 * which analytics slice is yours.
 *
 * - `canCurateMaster` — mutate master batches, and later (Wave 2) review
 *   proposed questions: DOLs and admins.
 * - `canManageBatch` — mutate a given batch: its owner, or anyone who can
 *   curate masters. A batch with no owner is a master batch (the seeds,
 *   and anything created before ownership existed).
 * - `podScopeId` — whose slice this person's analytics filter to; null
 *   means "no personal slice — you see every pod" (DOLs, admins).
 */
export function canCurateMaster(staff: Staff): boolean {
  return staff.role === "admin" || staff.role === "dol";
}

export function canManageBatch(
  staff: Staff,
  batch: { ownerId: string | null },
): boolean {
  if (canCurateMaster(staff)) return true;
  return batch.ownerId !== null && batch.ownerId === staff.userId;
}

export function podScopeId(staff: Staff): string | null {
  return staff.role === "pod_lead" ? staff.userId : null;
}

/**
 * Resolves the signed-in auth user (via getUser() — NEVER getSession(),
 * which does not verify the JWT, PLAN.md §1) and looks up their `staff`
 * row. Throws AppError("unauthorized") when there is no signed-in user at
 * all, or AppError("forbidden") when there is a signed-in user with no
 * matching `staff` row (or an inactive/unreadable one) — a signed-in auth
 * user is not staff on their own.
 *
 * The staff lookup goes through serviceClient() rather than a
 * lib/repos/staff.ts module. B1 owns lib/repos and hasn't been asked for
 * a staff repo for this single-table, auth-only read — this direct,
 * contained query inside lib/auth is the orchestrator-approved exception
 * (PLAN §9 B2). It stays this narrow: one table, one column list, no
 * business logic.
 *
 * Wrapped in React's `cache()` — the per-REQUEST memoizer, and the exact
 * shape this Next version's own auth guide recommends for a session
 * verifier. Every requireStaff()/requireAdmin() in a request still runs
 * and still enforces; only the underlying getUser() round-trip and staff
 * query happen once instead of once per guard. The memo dies with the
 * request, so one user's identity can never bleed into another's request
 * — which is also why the CROSS-request caches (`use cache`,
 * unstable_cache) must never wrap this function.
 */
const resolveStaff = cache(async (): Promise<Staff> => {
  const supabase = await authClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new AppError("unauthorized", "Sign in to continue.");
  }

  const db = serviceClient();
  const { data: staffRow } = await db
    .from("staff")
    .select("user_id, email, role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!staffRow) {
    throw new AppError(
      "forbidden",
      "This account isn't set up for admin access.",
    );
  }

  return {
    userId: staffRow.user_id,
    email: staffRow.email ?? data.user.email ?? "",
    role: staffRow.role,
  };
});

/** `{ userId, email, role } | null` — null covers both "not signed in" and
 * "signed in but no staff row." Use requireStaff()/requireAdmin() when the
 * caller needs to distinguish those (redirect vs. "no access" screen). */
export async function getStaff(): Promise<Staff | null> {
  try {
    return await resolveStaff();
  } catch {
    return null;
  }
}

/** Accepts every role — admin ⊃ DOL ⊃ pod lead. Throws
 * AppError("unauthorized") when not signed in, AppError("forbidden") when
 * signed in but not staff. */
export async function requireStaff(): Promise<Staff> {
  return resolveStaff();
}

/** DOLs and admins — the master-content tier (curating master batches;
 * Wave 2 question review). */
export async function requireDol(): Promise<Staff> {
  const staff = await resolveStaff();
  if (!canCurateMaster(staff)) {
    throw new AppError(
      "forbidden",
      "This action requires a DOL or admin account.",
    );
  }
  return staff;
}

/** Admin only — the system tier: staff, rubric, topics, deletion. Throws
 * AppError("forbidden") for any lead, same as for a signed-in non-staff
 * user — the message differs. */
export async function requireAdmin(): Promise<Staff> {
  const staff = await resolveStaff();
  if (staff.role !== "admin") {
    throw new AppError("forbidden", "This action requires an admin account.");
  }
  return staff;
}
