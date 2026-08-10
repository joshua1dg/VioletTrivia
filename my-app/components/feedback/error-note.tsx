import type { AppError } from "@/lib/errors";

// No "use client" here — this is presentational, same reasoning as
// components/question/shell.tsx. It takes strings/objects, not handlers, so
// it stays server-compatible and only enters the client bundle by being
// imported from something that already is one (SubmitButton, ConfirmDelete,
// a form's own client wrapper).

/**
 * What every call site actually has in hand: either the plain `message`
 * string a Server Action returns (`{ ok: false, message }` — the common
 * case, per PLAN §7.2), or something AppError-shaped that still exposes only
 * `userMessage`. Never a raw `Error`/`AppError` instance — `cause` and
 * `.message` on the real class can carry a raw Postgres string, and this
 * type makes reaching for them impossible rather than merely discouraged.
 */
export type ErrorLike = string | Pick<AppError, "userMessage">;

export type ErrorNoteTone = "bad" | "warn" | "neutral";

const TONE: Record<ErrorNoteTone, { border: string; bg: string; text: string; dot: string }> = {
  bad: {
    border: "border-bad-line",
    bg: "bg-bad-tint",
    text: "text-bad-ink",
    dot: "bg-bad",
  },
  warn: {
    border: "border-warn-line",
    bg: "bg-warn-tint",
    text: "text-warn-ink",
    dot: "bg-warn",
  },
  // For the "not really an error" cases §5.8 calls out — e.g. a duplicate
  // response. Same shape as the other two, no alarm color.
  neutral: {
    border: "border-line",
    bg: "bg-surface",
    text: "text-muted-2",
    dot: "bg-faint-2",
  },
};

/** Duck-types anything AppError-shaped down to the one field that's ever
 *  safe to render. Exported so ConfirmDelete (and any Wave 3 catch block)
 *  can normalize a thrown value the same way, without importing the class. */
export function toErrorLike(value: unknown): ErrorLike | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (
    typeof value === "object" &&
    "userMessage" in value &&
    typeof (value as { userMessage?: unknown }).userMessage === "string"
  ) {
    return { userMessage: (value as { userMessage: string }).userMessage };
  }
  // A plain Error, or anything else unrecognized: its .message might be a
  // raw Postgres/PostgREST string. Refuse to render it and fall back to a
  // generic line instead — see the rule this file exists to enforce.
  return "Something went wrong. Try again.";
}

function resolve(error: ErrorLike | null | undefined): string | null {
  if (!error) return null;
  return typeof error === "string" ? error : error.userMessage;
}

/**
 * Renders a safe user-facing message under a form field or at the top of a
 * card. Never renders a raw error object — the prop type only ever offers a
 * string. `null`/`undefined`/`""` render nothing, so call sites can pass
 * `error={state?.message}` unconditionally.
 */
export function ErrorNote({
  error,
  tone = "bad",
}: {
  error: ErrorLike | null | undefined;
  tone?: ErrorNoteTone;
}) {
  const message = resolve(error);
  if (!message) return null;

  const t = TONE[tone];

  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-[8px] border px-3 py-2 ${t.border} ${t.bg}`}
    >
      <span aria-hidden className={`mt-[5px] size-1.5 shrink-0 rounded-full ${t.dot}`} />
      <p className={`text-[12.5px] leading-[1.5] ${t.text}`}>{message}</p>
    </div>
  );
}
