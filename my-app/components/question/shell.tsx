import type { ReactNode } from "react";

// No "use client" here on purpose. These are presentational — they take
// handlers but own no state. They reach the client bundle by being imported
// from a component that IS a client entry point. Adding the directive would
// declare them entry points themselves, and Next would then require every
// prop to be serializable, which function handlers are not.

/**
 * The chrome every template shares: header, progress rule, scrolling body,
 * and a footer whose button is full-width on a phone and right-aligned on a
 * desktop. Templates render only their body, which is what keeps a registry
 * entry small and the chrome identical when a fourth template shows up.
 *
 * Height is not set here. Given a fixed-height parent the body scrolls;
 * given none the card grows to fit. The demo page uses both.
 */
export function QuestionShell({
  label,
  progress,
  status,
  statusTone = "muted",
  hint,
  action,
  children,
}: {
  label: string;
  /** 0–1. Omit for no progress rule. */
  progress?: number;
  status?: string;
  statusTone?: "muted" | "ok";
  hint?: string;
  action: { label: string; onClick?: () => void; disabled?: boolean };
  children: ReactNode;
}) {
  return (
    // @container so every @3xl: below responds to THIS card's width, not the
    // viewport's. That is what lets a 390px frame and a 1040px frame sit side
    // by side on one screen and each render its own real layout.
    <section className="@container flex h-full min-h-0 flex-col overflow-hidden rounded-[14px] border border-line bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-line-2 px-[18px] py-4 @3xl:px-6">
        <span className="text-[13px] font-medium text-ink-4">{label}</span>
        {status && (
          <span
            className={`text-[12.5px] ${
              statusTone === "ok" ? "text-ok-ink" : "text-muted-3"
            }`}
          >
            {status}
          </span>
        )}
      </header>

      {progress !== undefined && (
        <div className="h-0.5 shrink-0 bg-line-2">
          <div
            className="h-full bg-violet transition-[width] duration-300"
            style={{ width: `${Math.min(Math.max(progress, 0), 1) * 100}%` }}
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-[18px] @3xl:p-6">
        {children}
      </div>

      <footer className="flex flex-col gap-3 border-t border-line-2 p-[18px] @3xl:flex-row @3xl:items-center @3xl:justify-between @3xl:px-6 @3xl:py-4">
        {hint && (
          <p className="text-[12.5px] leading-[1.5] text-muted-3">{hint}</p>
        )}
        <button
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className={`w-full shrink-0 rounded-[9px] px-6 py-3.5 text-[14.5px] font-semibold transition-colors @3xl:w-auto @3xl:py-2.5 @3xl:text-[14px] @3xl:font-medium ${
            action.disabled
              ? "cursor-not-allowed bg-line-3 text-faint"
              : "cursor-pointer bg-violet text-white hover:bg-violet-ink"
          }`}
        >
          {action.label}
        </button>
      </footer>
    </section>
  );
}

/** A selectable answer card. Used by both pick-one templates. */
export function OptionCard({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full cursor-pointer items-start gap-3 rounded-[10px] border p-4 text-left transition-colors ${
        selected
          ? "border-violet bg-violet-tint"
          : "border-line bg-white hover:bg-surface"
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 size-4 shrink-0 rounded-full border-[1.5px] ${
          selected ? "border-violet bg-violet" : "border-dot bg-transparent"
        }`}
      />
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}
