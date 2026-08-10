import "server-only";

import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import type { ZodType } from "zod";

import { AppError, GENERIC_USER_MESSAGE } from "@/lib/errors";

/**
 * The pattern every repo in this folder copies. Read this file before adding
 * `lib/repos/sessions.ts` or `lib/repos/reports.ts` in Wave 3 — one shape, one
 * error taxonomy, one place that knows what a PostgREST error code means.
 *
 * A repo module:
 *   · builds exactly ONE PostgREST query per method, via `serviceClient()`;
 *   · maps snake_case → camelCase here and nowhere else (`camelRow`, or an
 *     explicit mapper where jsonb has to be parsed on the way out);
 *   · parses jsonb columns with zod — always (PLAN §5.7). List reads
 *     soft-fail (`collect`), single-item reads throw (`parseJsonb`);
 *   · translates PostgREST codes into `AppError` (`mapPostgrestError`);
 *   · contains NO business logic, NO cross-table orchestration, NO auth.
 *
 * "Save a question plus its topics plus its principles" is three repo calls
 * orchestrated by a service, not one repo method.
 */

/* ------------------------------------------------------------------ *
 * snake_case → camelCase
 * ------------------------------------------------------------------ */

type CamelKey<S extends string> = S extends `${infer Head}_${infer Tail}`
  ? `${Head}${Capitalize<CamelKey<Tail>>}`
  : S;

export type Camel<T> = {
  [K in keyof T as K extends string ? CamelKey<K> : K]: T[K];
};

function camelKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Shallow snake→camel on a flat row. Typed, so the caller gets
 * `{ sortOrder: number }` rather than `Record<string, unknown>`.
 *
 * Only for rows that are entirely flat scalars. Anything with a jsonb column
 * or an embedded relation gets an explicit mapper instead — the parse has to
 * happen in the same place, and an explicit mapper is where it goes.
 */
export function camelRow<T extends Record<string, unknown>>(row: T): Camel<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) out[camelKey(key)] = value;
  return out as Camel<T>;
}

/* ------------------------------------------------------------------ *
 * PostgREST / Postgres error codes → AppError
 *
 *   23505      unique violation             → conflict
 *   23503      foreign key violation        → conflict
 *   23514      check constraint violation   → validation
 *   PGRST116   .single() found no rows      → not_found
 *   PGRST202   no matching function/route   → unavailable
 *   anything else, incl. network            → unavailable
 *
 * The raw message goes into `cause` and the developer-facing `message`,
 * never into `userMessage`.
 * ------------------------------------------------------------------ */

export type PostgrestErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export type ErrorMessages = {
  /** What the user sees for 23505 / 23503. */
  conflict?: string;
  /** What the user sees for PGRST116 on a `.single()`. */
  notFound?: string;
  /** What the user sees for 23514. */
  validation?: string;
  /** Fallback for everything else. */
  unavailable?: string;
};

export function mapPostgrestError(
  error: PostgrestErrorLike,
  messages: ErrorMessages = {},
): AppError {
  const code = error.code ?? "";
  const raw = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" | ");

  switch (code) {
    case "23505":
      return new AppError(
        "conflict",
        messages.conflict ?? "That already exists.",
        { cause: error, message: raw },
      );
    case "23503":
      return new AppError(
        "conflict",
        messages.conflict ?? "Something else still refers to this.",
        { cause: error, message: raw },
      );
    case "23514":
      return new AppError(
        "validation",
        messages.validation ?? "Those values aren't allowed.",
        { cause: error, message: raw },
      );
    case "PGRST116":
      return new AppError(
        "not_found",
        messages.notFound ?? "That doesn't exist any more.",
        { cause: error, message: raw },
      );
    default:
      return new AppError(
        "unavailable",
        messages.unavailable ?? GENERIC_USER_MESSAGE,
        { cause: error, message: raw || `PostgREST error ${code}` },
      );
  }
}

/** Postgres code from a caught error, when the caller needs to branch on it. */
export function errorCode(error: PostgrestErrorLike | null | undefined) {
  return error?.code ?? null;
}

/**
 * Unwraps a PostgREST result. `{ data, error }` in, data out, `AppError`
 * thrown. Every repo method ends in this or in `collect`.
 *
 * The parameter is supabase's own response type rather than a structural
 * `{ data: T | null; error: E | null }`, and that is deliberate: the real
 * response is a union of a success arm and a failure arm, and inferring `T`
 * across it structurally lands on `null` — every repo row silently becomes
 * `null` and the errors point everywhere except here. This is the only
 * `@supabase/*` import outside `lib/db`, and lib/repos is the one folder
 * allowed to have one (PLAN §5.2).
 */
export function unwrap<T>(
  result: PostgrestSingleResponse<T>,
  messages: ErrorMessages = {},
): T {
  if (result.error) throw mapPostgrestError(result.error, messages);
  if (result.data === null) {
    throw new AppError(
      "not_found",
      messages.notFound ?? "That doesn't exist any more.",
      { message: "PostgREST returned no data and no error" },
    );
  }
  return result.data;
}

/** Same, for queries whose empty result is legitimate (`maybeSingle`). */
export function unwrapMaybe<T>(
  result: PostgrestSingleResponse<T | null>,
  messages: ErrorMessages = {},
): T | null {
  if (result.error) {
    if (result.error.code === "PGRST116") return null;
    throw mapPostgrestError(result.error, messages);
  }
  return result.data;
}

/* ------------------------------------------------------------------ *
 * jsonb, on the way out (PLAN §5.7 / D11)
 * ------------------------------------------------------------------ */

/** A row that could not be parsed, and why. Rendered as a banner, not an error. */
export type SkippedRow = { id: string; reason: string };

/** What every soft-failing list read returns. */
export type ListResult<T> = { rows: T[]; skipped: SkippedRow[] };

/**
 * Single-item read: an unparseable row THROWS. Silently rendering half a
 * question is worse than an error page.
 */
export function parseJsonb<T>(
  schema: ZodType<T>,
  value: unknown,
  context: { id: string; column: string },
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const reason = describeZodIssues(result.error);
  console.error(
    `[repo] ${context.column} failed to parse for row ${context.id}: ${reason}`,
  );
  throw new AppError(
    "validation",
    "This question was saved in an older shape and can't be shown. Re-save it from the editor.",
    { cause: result.error, message: `${context.column} invalid: ${reason}` },
  );
}

/**
 * List read: an unparseable row is SKIPPED and logged with its id, and the
 * caller gets `{ rows, skipped }`. One question authored under an older shape
 * must not take down the whole library.
 *
 * `map` returns the mapped row, or throws — throwing is how it reports that
 * this row is unusable, which is exactly what `parseJsonb` already does.
 */
export function collect<Row, T>(
  rows: Row[],
  idOf: (row: Row) => string,
  map: (row: Row) => T,
): ListResult<T> {
  const out: T[] = [];
  const skipped: SkippedRow[] = [];

  for (const row of rows) {
    const id = idOf(row);
    try {
      out.push(map(row));
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "unreadable row shape";
      console.error(`[repo] skipping row ${id}: ${reason}`);
      skipped.push({ id, reason });
    }
  }

  return { rows: out, skipped };
}

/** Merges the skipped lists of several soft-failing reads. */
export function mergeSkipped(
  ...results: Array<{ skipped: SkippedRow[] }>
): SkippedRow[] {
  return results.flatMap((r) => r.skipped);
}

function describeZodIssues(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray((error as { issues: unknown[] }).issues)
  ) {
    const issues = (error as { issues: Array<Record<string, unknown>> }).issues;
    return issues
      .slice(0, 3)
      .map((issue) => {
        const path = Array.isArray(issue.path) ? issue.path.join(".") : "";
        const message =
          typeof issue.message === "string" ? issue.message : "invalid";
        return path ? `${path}: ${message}` : message;
      })
      .join("; ");
  }
  return error instanceof Error ? error.message : "invalid";
}
