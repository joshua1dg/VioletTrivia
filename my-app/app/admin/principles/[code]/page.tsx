import { PageHeader } from "@/components/admin/ui";
import { SkippedRowsBanner } from "@/components/feedback";
import { getPrincipleReport } from "@/lib/services/reports";

import { HeaderLink, QuestionStatTable } from "../../reports/report-bits";
import { ScoreBar } from "../../reports/score-bar";

/**
 * The rubric code's dashboard — what clicking a principle row means now
 * (2026-08-11). The rubric stays read-only (D15); this screen answers "how
 * does the team do when THIS code is the answer", plus both directions of
 * the confusion signal.
 *
 * Numbers span every question KEYED to this code, org-wide, deduped to
 * first answers. Questions where the code is only a distractor contribute
 * the inbound-confusion count, not the found-rate.
 */
export default async function PrincipleReportPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const report = await getPrincipleReport(decodeURIComponent(code));
  const p = report.principle;

  return (
    <>
      <PageHeader
        title={`${p.code} — ${p.name}`}
        meta={`Rubric code · the answer on ${report.keyedQuestionCount} question${report.keyedQuestionCount === 1 ? "" : "s"}, in play on ${report.inPlayQuestionCount}`}
        actions={<HeaderLink href="/admin/principles">← All principles</HeaderLink>}
      />

      <div className="flex flex-col gap-6 p-6">
        <SkippedRowsBanner skipped={report.skipped} />

        {p.shortDescriptor && (
          <p className="max-w-[75ch] text-[13.5px] leading-[1.6] text-muted">
            {p.shortDescriptor}
          </p>
        )}

        <section className="flex flex-col gap-1.5">
          <h2 className="text-[12px] tracking-[0.04em] text-faint">
            FOUND WHEN IT WAS THE ANSWER
          </h2>
          {report.total === 0 ? (
            <p className="text-[13px] text-muted-3">
              No answers yet to questions keyed to {p.code}.
            </p>
          ) : (
            <ScoreBar
              label={`${report.participantCount} participant${report.participantCount === 1 ? "" : "s"}`}
              correct={report.correct}
              total={report.total}
            />
          )}
          {report.duplicateCount > 0 && (
            <p className="text-[12px] text-muted-3">
              {report.duplicateCount} repeat answer
              {report.duplicateCount === 1 ? "" : "s"} excluded.
            </p>
          )}
        </section>

        {(report.pickedInstead.length > 0 || report.wronglyPickedCount > 0) && (
          <section className="flex flex-col gap-2">
            <h2 className="text-[12px] tracking-[0.04em] text-faint">
              CONFUSION
            </h2>
            {report.pickedInstead.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[12.5px] text-muted-2">
                  When {p.code} was missed, people picked:
                </span>
                <ul className="flex flex-wrap gap-2">
                  {report.pickedInstead.map((pick) => (
                    <li
                      key={pick.code}
                      className="rounded-[7px] border border-line bg-surface px-2.5 py-1 text-[12.5px] text-ink-4"
                    >
                      <span className="font-mono text-[11.5px] text-violet-ink">
                        {pick.code}
                      </span>{" "}
                      {pick.name} · {pick.count}×
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {report.wronglyPickedCount > 0 && (
              <p className="text-[12.5px] text-muted-2">
                And {p.code} was wrongly picked{" "}
                <span className="tabular-nums">
                  {report.wronglyPickedCount}×
                </span>{" "}
                when some other code was the answer.
              </p>
            )}
          </section>
        )}

        <section className="flex flex-col gap-2.5">
          <h2 className="text-[12px] tracking-[0.04em] text-faint">
            QUESTIONS KEYED TO {p.code}
          </h2>
          <QuestionStatTable rows={report.questions} />
        </section>
      </div>
    </>
  );
}
