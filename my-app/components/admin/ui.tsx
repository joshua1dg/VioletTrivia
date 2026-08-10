import Link from "next/link";
import type { ReactNode } from "react";
// The status union belongs to the questions domain, and its one definition
// is the `questionStatus` zod enum (`lib/schemas` carries no `server-only`,
// so a shared presentational file may take a type from it — PLAN §5.7).
import type { QuestionStatusInput as QuestionStatus } from "@/lib/schemas/questions";

/** Title, count line, and right-hand actions. Same on every admin screen. */
export function PageHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line-2 px-6 py-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-[17px] font-semibold tracking-[-0.015em] text-ink">
          {title}
        </h1>
        {meta && <span className="text-[12.5px] text-muted-3">{meta}</span>}
      </div>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </header>
  );
}

/**
 * `type` defaults to "button" on both buttons below, so dropping one inside
 * a form never submits it by accident; pass `type="submit"` when that IS
 * the intent. `onClick` and `disabled` are optional and change nothing when
 * omitted — the look is fixed, only the wiring is caller-supplied.
 */
export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="cursor-pointer rounded-[7px] bg-violet px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-violet-ink disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/** Same look as PrimaryButton, but navigates. */
export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-[7px] bg-violet px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-violet-ink"
    >
      {children}
    </Link>
  );
}

export function GhostButton({
  children,
  onClick,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="cursor-pointer rounded-[7px] border border-line px-3.5 py-2 text-[13px] text-ink-4 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/** Filter pill. Purely presentational — the page owns which one is on. */
export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer rounded-md border px-2.5 py-1 text-[12.5px] transition-colors ${
        active
          ? "border-violet-line bg-violet-tint-2 text-violet-ink"
          : "border-line text-muted hover:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}

/** Read-only tag, e.g. a topic on a table row. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[5px] border border-line px-2 py-0.5 text-[12px] whitespace-nowrap text-muted">
      {children}
    </span>
  );
}

const STATUS_TONE: Record<QuestionStatus, string> = {
  live: "text-violet-ink",
  draft: "text-muted-3",
  archived: "text-faint",
};

export function StatusPill({ status }: { status: QuestionStatus }) {
  return (
    <span className={`text-[12.5px] capitalize ${STATUS_TONE[status]}`}>
      {status}
    </span>
  );
}

/** Shown where a screen exists in the design but isn't built yet. */
export function Placeholder({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="m-6 flex flex-col gap-2 rounded-[12px] border border-dashed border-line-4 bg-white/60 p-6">
      <span className="text-[14px] font-medium text-muted">{title}</span>
      <p className="max-w-[66ch] text-[13.5px] leading-[1.6] text-muted-3">
        {children}
      </p>
    </div>
  );
}
