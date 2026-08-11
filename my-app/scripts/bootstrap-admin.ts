/**
 * Creates the first staff login: an auth.users row via the Supabase admin
 * API, plus the matching `staff` row with role = 'admin'. Replaces the
 * migration's old "insert into staff (...) values ('<your-auth-uid>', ...)"
 * manual-SQL note (supabase/migrations/20260807032341_init.sql, Staff
 * section) — this script is the bootstrap path now.
 *
 * Idempotent: re-running with the same email finds the existing auth user
 * instead of failing on "already registered", updates its password/
 * email_confirm to match what you passed, and upserts the staff row. Every
 * later wave (B2's auth, and everything behind `requireStaff()`/
 * `requireAdmin()`) needs a real staff login to exist, and `supabase db
 * reset` wipes auth.users — re-run this after every reset.
 *
 * Deliberately does NOT import lib/db/server.ts: that module pulls in
 * `next/headers`, which assumes a Next.js request context this plain-node
 * script does not have. This script builds its own minimal service-role
 * client with the same two env vars.
 *
 * Wave 1 adds an in-app Staff screen (/admin/staff, lib/services/staff)
 * that does this same createUser + upsert for every account AFTER the
 * first — any admin can add pod leads, project leads or more admins from
 * the browser now. This script remains the only way to get the first
 * admin (nobody is signed in yet to use the screen), and the only way back
 * in after `supabase db reset` wipes auth.users.
 *
 * Usage (from my-app/):
 *   pnpm bootstrap:admin
 *   pnpm bootstrap:admin -- --email=me@example.com --password=... --display-name="Jane"
 *
 * Env vars (from .env.local), used when the matching flag is omitted:
 *   ADMIN_EMAIL, ADMIN_PASSWORD
 */

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../lib/db/database.types";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env.local and fill it in from \`supabase status\`, or run with --env-file=.env.local.`,
    );
  }
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const email = args.email ?? process.env.ADMIN_EMAIL;
  const password = args.password ?? process.env.ADMIN_PASSWORD;
  const displayName = args["display-name"] ?? args.displayName ?? null;

  if (!email || !password) {
    throw new Error(
      "Need an email and password. Pass --email=... --password=..., or set ADMIN_EMAIL / ADMIN_PASSWORD in .env.local.",
    );
  }

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId: string;

  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (created.data.user) {
    userId = created.data.user.id;
    console.log(`Created auth user ${email} (${userId}).`);
  } else {
    // Idempotency path: GoTrue rejects a second createUser for the same
    // email (code "email_exists" / a 422 with an "already been
    // registered" message). Find the existing user instead of failing.
    const alreadyExists =
      created.error?.code === "email_exists" ||
      /already.*registered/i.test(created.error?.message ?? "");

    if (!alreadyExists) {
      throw new Error(
        `auth.admin.createUser failed: ${created.error?.message ?? "unknown error"}`,
      );
    }

    const existing = await findUserByEmail(supabase, email);
    if (!existing) {
      throw new Error(
        `createUser reported "${email}" already registered, but no matching user was found via listUsers().`,
      );
    }
    userId = existing.id;
    console.log(`Auth user ${email} (${userId}) already exists — reusing it.`);

    // Keep the password and confirmation status in sync with what was
    // passed, so re-running with a new password actually rotates it.
    const updated = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updated.error) {
      throw new Error(`Failed to update existing user: ${updated.error.message}`);
    }
  }

  const { error: staffError } = await supabase
    .from("staff")
    .upsert(
      {
        user_id: userId,
        role: "admin",
        email,
        display_name: displayName,
      },
      { onConflict: "user_id" },
    );

  if (staffError) {
    throw new Error(`Failed to upsert staff row: ${staffError.message}`);
  }

  console.log(`staff row for ${email} is role=admin. Bootstrap complete.`);
}

async function findUserByEmail(
  supabase: ReturnType<typeof createClient<Database>>,
  email: string,
) {
  const target = email.toLowerCase();
  let page = 1;
  const perPage = 200;

  // Local/dev-scale pagination guard. If this project ever has more than a
  // few thousand auth users, switch to a targeted lookup instead.
  for (let i = 0; i < 50; i++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);

    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match;

    if (data.users.length < perPage) return null; // exhausted
    page += 1;
  }

  return null;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
