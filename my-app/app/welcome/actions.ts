"use server";

import { redirect } from "next/navigation";

import { authClient } from "@/lib/db/server";

export type SetPasswordResult = { ok: true } | { ok: false; message: string };

/**
 * Finishes an invite: the /auth/confirm route already authenticated this
 * person from the emailed token, so updateUser runs against their own
 * session — no admin client, no token juggling. Same (prevState,
 * formData) shape and errors-as-return-values as login's signIn.
 */
export async function setPassword(
  _prevState: SetPasswordResult | null,
  formData: FormData,
): Promise<SetPasswordResult> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 6) {
    return { ok: false, message: "Use at least 6 characters." };
  }
  if (password !== confirm) {
    return { ok: false, message: "Those don't match — try again." };
  }

  const supabase = await authClient();

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return {
      ok: false,
      message: "This invite session has expired — ask an admin to resend it.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    // GoTrue's message is safe here (e.g. "New password should be
    // different..."), but keep the same no-raw-messages stance as login.
    return {
      ok: false,
      message: "Couldn't set that password — try a different one.",
    };
  }

  redirect("/admin");
}
