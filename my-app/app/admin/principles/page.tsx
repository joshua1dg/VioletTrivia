import Link from "next/link";

import { PageHeader } from "@/components/admin/ui";
import { listPrinciplesWithUsage } from "@/lib/services/principles";

/**
 * READ-ONLY (D15) — no add, no edit, no delete control anywhere, and no
 * action module exists for this screen. The rubric is fixed vocabulary
 * seeded straight into the database; this screen exists to look codes up
 * while authoring a `which_principle` question, and to show which ones
 * still lack text. A plain Server Component is enough — there is no
 * mutation and therefore no pending/error state to own (PLAN §5.6: reads
 * have no loading state).
 */
export default async function PrinciplesPage() {
  const principles = await listPrinciplesWithUsage();
  const incomplete = principles.filter((p) => !p.name || !p.shortDescriptor);

  return (
    <>
      <PageHeader
        title="Principles"
        meta={`${principles.length} codes · reference only, seeded in the database`}
      />

      <div className="flex flex-col gap-4 p-6">
        {incomplete.length > 0 && (
          <p className="max-w-[70ch] rounded-[10px] border border-line bg-surface px-4 py-3 text-[13px] leading-[1.6] text-muted">
            <span className="font-medium text-ink-3">
              {incomplete.map((p) => p.code).join(", ")}
            </span>{" "}
            {incomplete.length === 1 ? "has" : "have"} no name or descriptor.
            They appear as chips on the T3 example but nothing in the design
            defines them. A{" "}
            <span className="font-mono text-[12px]">which_principle</span>{" "}
            question can&rsquo;t be authored against a code that has no text.
          </p>
        )}

        <div className="flex flex-col gap-2.5">
          {principles.map((p) => {
            const blank = !p.name || !p.shortDescriptor;
            return (
              // The card clicks through to the code's report (2026-08-11:
              // "everything goes to a report"); the rubric itself stays
              // read-only, so there is no edit affordance to make room for.
              <Link
                key={p.code}
                href={`/admin/principles/${p.code}`}
                className={`flex gap-4 rounded-[10px] border p-4 transition-colors ${
                  blank
                    ? "border-dashed border-line-4 bg-surface hover:border-line"
                    : "border-line bg-white hover:border-faint-2"
                }`}
              >
                <span className="w-8 shrink-0 pt-0.5 font-mono text-[12px] text-violet-ink">
                  {p.code}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span
                    className={`text-[14px] font-semibold tracking-[-0.01em] ${
                      p.name ? "text-ink" : "text-faint italic"
                    }`}
                  >
                    {p.name || "Untitled — needs writing"}
                  </span>
                  {p.shortDescriptor ? (
                    <span className="text-[13px] leading-[1.55] text-muted">
                      {p.shortDescriptor}
                    </span>
                  ) : (
                    <span className="text-[13px] text-faint italic">
                      No descriptor
                    </span>
                  )}
                  {p.fullDescription && (
                    <span className="text-[12.5px] leading-[1.6] text-muted-3">
                      {p.fullDescription}
                    </span>
                  )}
                  {!p.active && (
                    <span className="text-[11.5px] tracking-[0.04em] text-faint">
                      INACTIVE — not offered to authors
                    </span>
                  )}
                </div>
                <span className="shrink-0 self-start text-[12.5px] whitespace-nowrap text-muted-3">
                  {p.questionCount} question{p.questionCount === 1 ? "" : "s"}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
