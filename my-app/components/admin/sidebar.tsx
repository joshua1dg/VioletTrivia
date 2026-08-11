"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/login/actions";

/**
 * Client component only because the active item needs the current pathname.
 * Everything else here is static — the topic counts are read on the server
 * by `app/admin/layout.tsx` and passed in, so this file touches no service.
 *
 * The sign-out control is a plain `<form action={signOut}>`. A Server Action
 * imported into a client component is just a reference to it, so this needs
 * no extra boundary and no client-side handler.
 */

const NAV = [
  { href: "/admin/questions", label: "Questions" },
  { href: "/admin/topics", label: "Topics" },
  // Not in the design, and it has to be: which_principle questions reference
  // rubric codes by foreign key, so nothing can be authored until these exist.
  { href: "/admin/principles", label: "Principles" },
  { href: "/admin/batches", label: "Batches" },
  { href: "/admin/sessions", label: "Live sessions" },
  { href: "/admin/reports", label: "Reports" },
];

export type SidebarTopic = { slug: string; label: string; questionCount: number };

export function Sidebar({
  topics,
  showStaffLink = false,
}: {
  topics: SidebarTopic[];
  /** Admin only — staff management is the system tier (PODS.md). Hiding
   * the entry is discoverability, not security: `/admin/staff`'s service
   * calls requireAdmin() regardless. */
  showStaffLink?: boolean;
}) {
  const pathname = usePathname();
  const nav = showStaffLink
    ? [...NAV, { href: "/admin/staff", label: "Staff" }]
    : NAV;

  return (
    <aside className="flex w-[212px] shrink-0 flex-col gap-6 border-r border-line-2 bg-surface px-3.5 py-5">
      <Link href="/admin" className="flex items-center gap-2.5 px-2">
        <span aria-hidden className="size-2.5 rounded-[2px] bg-violet" />
        <span className="text-[13.5px] font-semibold text-ink">
          Project Violet
        </span>
      </Link>

      <nav className="flex flex-col gap-0.5">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-2.5 py-2 text-[13px] transition-colors ${
                active
                  ? "bg-violet-tint-2 font-medium text-violet-ink"
                  : "text-muted hover:bg-line-3 hover:text-ink-4"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex min-h-0 flex-col gap-5">
        {topics.length > 0 && (
          <div className="flex min-h-0 flex-col gap-2 px-2.5">
            <span className="text-[11px] tracking-[0.06em] text-faint">
              TOPICS
            </span>
            {/* The one part of the sidebar allowed to scroll: a long topic
                list must never push sign-out off the bottom of the screen. */}
            <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto text-[12.5px] text-muted">
              {topics.map((t) => (
                <div key={t.slug} className="flex justify-between gap-2">
                  <span className="truncate">{t.label}</span>
                  <span className="text-faint">{t.questionCount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <form action={signOut} className="border-t border-line-2 pt-3">
          <button
            type="submit"
            className="w-full cursor-pointer rounded-md px-2.5 py-2 text-left text-[13px] text-muted transition-colors hover:bg-line-3 hover:text-ink-4"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
