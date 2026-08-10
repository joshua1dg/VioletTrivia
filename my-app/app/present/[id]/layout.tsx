import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth";
import { AppError } from "@/lib/errors";

/**
 * THE authorization boundary for /present/* (PLAN §9 F5's brief: "its OWN
 * layout calls requireStaff() — the admin layout does NOT cover /present,
 * the proxy only redirects, the layout is the boundary"). Same shape as
 * `app/admin/layout.tsx`, deliberately duplicated rather than shared: this
 * route tree renders no admin chrome at all — it's the big screen, not a
 * management console — so there is nothing in `app/admin/layout.tsx` worth
 * reusing here beyond the guard itself.
 */
export default async function PresentLayout({
  children,
}: {
  children: ReactNode;
}) {
  try {
    await requireStaff();
  } catch (err) {
    if (err instanceof AppError && err.kind === "unauthorized") {
      redirect("/login");
    }

    if (err instanceof AppError && err.kind === "forbidden") {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
          <h1 className="text-[18px] font-semibold">No access</h1>
          <p className="max-w-[46ch] text-[13.5px] leading-[1.6] text-white/70">
            You&apos;re signed in, but this account isn&apos;t set up for
            staff access.
          </p>
        </main>
      );
    }

    throw err;
  }

  return <div className="min-h-screen bg-black text-white">{children}</div>;
}
