import "server-only";

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

export type StaffRole = "admin" | "host";

export type Staff = {
  userId: string;
  email: string;
  role: StaffRole;
};

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
 */
async function resolveStaff(): Promise<Staff> {
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
}

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

/** Accepts either role — admin ⊃ host. Throws AppError("unauthorized") when
 * not signed in, AppError("forbidden") when signed in but not staff. */
export async function requireStaff(): Promise<Staff> {
  return resolveStaff();
}

/** Admin only. Throws AppError("forbidden") for a signed-in host, same as
 * for a signed-in non-staff user — the message differs. */
export async function requireAdmin(): Promise<Staff> {
  const staff = await resolveStaff();
  if (staff.role !== "admin") {
    throw new AppError("forbidden", "This action requires an admin account.");
  }
  return staff;
}
