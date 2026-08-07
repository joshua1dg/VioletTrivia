"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { topicCounts } from "@/lib/admin/fixtures";

/**
 * Client component only because the active item needs the current pathname.
 * Everything else here is static.
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

export function Sidebar() {
  const pathname = usePathname();
  const counts = topicCounts();

  return (
    <aside className="flex w-[212px] shrink-0 flex-col gap-6 border-r border-line-2 bg-surface px-3.5 py-5">
      <Link href="/admin" className="flex items-center gap-2.5 px-2">
        <span aria-hidden className="size-2.5 rounded-[2px] bg-violet" />
        <span className="text-[13.5px] font-semibold text-ink">
          Project Violet
        </span>
      </Link>

      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
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

      <div className="mt-auto flex flex-col gap-2 px-2.5">
        <span className="text-[11px] tracking-[0.06em] text-faint">TOPICS</span>
        <div className="flex flex-col gap-1.5 text-[12.5px] text-muted">
          {counts.map((t) => (
            <div key={t.slug} className="flex justify-between gap-2">
              <span className="truncate">{t.label}</span>
              <span className="text-faint">{t.count}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
