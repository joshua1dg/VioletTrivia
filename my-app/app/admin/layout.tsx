import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { Sidebar } from "@/components/admin/sidebar";
import { requireStaff } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { listTopicsWithUsage } from "@/lib/services/topics";

/**
 * THE authorization boundary for /admin/* (proxy.ts is convenience only —
 * see its file comment). requireStaff() throws AppError("unauthorized")
 * when there's no signed-in user at all, and AppError("forbidden") when
 * there's a signed-in user with no matching `staff` row. Those get two
 * different outcomes: a redirect to /login, versus a plain "no access"
 * screen for someone who authenticated but was never made staff.
 *
 * Sign-out lives in the sidebar footer (a `<form action={signOut}>`), and
 * the sidebar's topic counts are read HERE rather than there: the sidebar
 * is a client component (it needs the pathname), so it cannot import a
 * server-only service itself.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  let staff;
  try {
    staff = await requireStaff();
  } catch (err) {
    if (err instanceof AppError && err.kind === "unauthorized") {
      redirect("/login");
    }

    if (err instanceof AppError && err.kind === "forbidden") {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center">
          <h1 className="text-[18px] font-semibold text-ink">No access</h1>
          <p className="max-w-[46ch] text-[13.5px] leading-[1.6] text-muted-2">
            You&apos;re signed in, but this account isn&apos;t set up for
            admin access. Ask an admin to add you, or sign in with a staff
            account.
          </p>
        </main>
      );
    }

    throw err;
  }

  const topics = await listTopicsWithUsage();

  return (
    // h-screen + overflow-hidden pins the shell to the viewport: the
    // sidebar never scrolls (sign-out stays at the bottom of the monitor),
    // and the content pane scrolls by itself.
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar
        topics={topics.map((t) => ({
          slug: t.slug,
          label: t.label,
          questionCount: t.questionCount,
        }))}
        showStaffLink={staff.role === "admin"}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
