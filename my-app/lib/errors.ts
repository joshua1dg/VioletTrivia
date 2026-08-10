/**
 * The one error type that crosses layers (PLAN §5.8).
 *
 * NO `server-only` import: `AppError` is rendered by client components
 * (`components/feedback/<ErrorNote>`) and returned from Server Actions, so it
 * has to be importable from both sides of the boundary.
 *
 * Two rules that matter more than the taxonomy:
 *
 *   1. **Never render a raw PostgREST/Postgres error.** They echo column
 *      names, constraint names and occasionally row contents. Repos map
 *      codes to an `AppError`; only `userMessage` ever reaches a screen.
 *   2. **`conflict` on a duplicate response is not a failure.** It is the
 *      expected outcome of a refresh or a double-tap — `responses_dedupe` in
 *      Postgres is what actually wins the race — and the async path renders
 *      it as "You've already answered this", with the reveal.
 */

export type AppErrorKind =
  | "not_found"
  | "unauthorized" // not signed in
  | "forbidden" // signed in, wrong role
  | "conflict" // unique violation — e.g. responses_dedupe
  | "validation" // zod failed
  | "unavailable"; // postgrest / network / anything unexpected

/** The fallback shown when nothing better is known. Never a Postgres string. */
export const GENERIC_USER_MESSAGE =
  "Something went wrong. Please try again in a moment.";

export class AppError extends Error {
  readonly kind: AppErrorKind;
  /** Safe to render. NEVER a raw Postgres message. */
  readonly userMessage: string;

  constructor(
    kind: AppErrorKind,
    userMessage: string,
    options?: { cause?: unknown; message?: string },
  ) {
    // `message` is the developer-facing string (logs, stack traces). It
    // defaults to userMessage, but a repo can pass the raw driver message
    // here — it is logged, never rendered.
    super(options?.message ?? userMessage, { cause: options?.cause });
    this.name = "AppError";
    this.kind = kind;
    this.userMessage = userMessage;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Normalises anything thrown into an `AppError`, so a boundary can do
 * `catch (e) { return { ok: false, message: asAppError(e).userMessage } }`
 * without ever leaking a driver string.
 *
 * - An `AppError` passes through unchanged.
 * - A zod error becomes `validation` (duck-typed rather than importing zod,
 *   so this module stays dependency-free and cheap on the client).
 * - Everything else becomes `unavailable` with the generic message, with the
 *   original kept as `cause` for the logs.
 */
export function asAppError(error: unknown): AppError {
  if (isAppError(error)) return error;

  if (isZodLike(error)) {
    return new AppError("validation", firstZodMessage(error), {
      cause: error,
      message: "Input failed validation",
    });
  }

  return new AppError("unavailable", GENERIC_USER_MESSAGE, {
    cause: error,
    message: error instanceof Error ? error.message : String(error),
  });
}

type ZodLike = { issues: Array<{ message?: unknown; path?: unknown }> };

function isZodLike(error: unknown): error is ZodLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray((error as { issues: unknown }).issues)
  );
}

/**
 * Zod's own messages are authored by us and by zod — not by Postgres — so
 * they are safe to render, and far more useful than "check your input".
 */
function firstZodMessage(error: ZodLike): string {
  const first = error.issues[0];
  const message = typeof first?.message === "string" ? first.message : null;
  if (!message) return "That doesn't look right — check the form and retry.";

  const path = Array.isArray(first?.path) ? first.path.join(".") : "";
  return path ? `${path}: ${message}` : message;
}
