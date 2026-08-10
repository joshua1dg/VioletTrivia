import type { ReactNode } from "react";

// No "use client" — presentational, no hooks. Same reasoning as
// components/question/shell.tsx and components/admin/ui.tsx's Placeholder.

/**
 * Icon-less, text-first "nothing here yet" — for a real screen with zero
 * rows (an empty question library, a topic with no questions), not for a
 * screen that doesn't exist yet. That case is Placeholder in
 * components/admin/ui.tsx; this is its sibling for genuine empty data,
 * built here because Wave 3 owns no shared primitives (PLAN §9).
 *
 * Same dashed-border, off-white card language as Placeholder, so the two
 * read as one family rather than two competing empty-state styles.
 */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  /** Supporting copy — one or two sentences, plain prose. */
  children?: ReactNode;
  /** e.g. a PrimaryLink to create the first item. */
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[12px] border border-dashed border-line-4 bg-white/60 px-6 py-8">
      <span className="text-[14px] font-medium text-muted">{title}</span>
      {children && (
        <p className="max-w-[52ch] text-[13.5px] leading-[1.6] text-muted-3">
          {children}
        </p>
      )}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}
