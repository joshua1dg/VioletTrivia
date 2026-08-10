"use server";

import { redirect } from "next/navigation";

import { authClient } from "@/lib/db/server";

export type SignInResult = { ok: true } | { ok: false; message: string };

/**
 * The action passed to useActionState from login-form.tsx. The route map
 * in PLAN.md §7.1 documents this as `signIn(email, password)` — that's
 * shorthand for what it does, not the literal parameter list. The actual
 * Server Function signature has to be `(prevState, formData)` so
 * useActionState can drive it (same shape as the worked example in §6).
 *
 * Errors are RETURN VALUES, never throws, so useActionState can render
 * them without losing what the user typed. On success this redirects
 * instead of returning — redirect() inside a Server Action is the
 * idiomatic Next 16 way (see the Server Actions / authentication guides
 * under node_modules/next/dist/docs/01-app/02-guides/), so the
 * `{ ok: false, message }` shape only ever applies to the failure path.
 */
export async function signIn(
  _prevState: SignInResult | null,
  formData: FormData,
): Promise<SignInResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, message: "Enter your email and password." };
  }

  const supabase = await authClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Never render the raw Supabase/GoTrue message (PLAN §5.8) — it can
    // leak whether the email exists at all. One safe message for every
    // failure mode.
    return { ok: false, message: "Incorrect email or password." };
  }

  redirect("/admin");
}

/** No form, no pending UI needed here — called from a plain button. */
export async function signOut(): Promise<void> {
  const supabase = await authClient();
  await supabase.auth.signOut();
  redirect("/login");
}
