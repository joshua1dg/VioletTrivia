// No "use client" — presentational, and the disclosure below is plain HTML
// (<details>/<summary>) rather than a hook, so this stays server-compatible.

export type SkippedRow = { id: string; reason?: string };

/**
 * The §5.7 soft-fail banner: a list read skipped some unparseable rows and
 * kept going rather than taking the whole screen down. Deliberately calm —
 * amber, not red, and it renders *above* a list that still rendered
 * everything else, never instead of it.
 *
 * Accepts either the full `{ id, reason }[]` a repo returns, or a bare count
 * when a caller only has the number (e.g. a page that just forwards
 * `skipped.length` from a service that already logged the ids server-side).
 * With ids, they sit behind a <details> disclosure — visible on request,
 * never dumped into the page by default.
 */
export function SkippedRowsBanner({ skipped }: { skipped: SkippedRow[] | number }) {
  const count = typeof skipped === "number" ? skipped : skipped.length;
  if (count === 0) return null;

  const rows = typeof skipped === "number" ? null : skipped;

  return (
    <div className="flex flex-col gap-1.5 rounded-[9px] border border-warn-line bg-warn-tint px-4 py-3">
      <p className="text-[12.5px] text-warn-ink">
        {count} row{count === 1 ? "" : "s"} could not be displayed.
      </p>
      {rows && rows.length > 0 && (
        <details className="text-[12px] text-muted-2">
          <summary className="cursor-pointer select-none text-warn-ink/80 hover:text-warn-ink">
            Show affected ids
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1 font-mono text-[11.5px] text-muted-3">
            {rows.map((row) => (
              <li key={row.id}>
                {row.id}
                {row.reason ? ` — ${row.reason}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
