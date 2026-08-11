import type { ReactNode } from "react";

import { PageHeader } from "@/components/admin/ui";
import { SkippedRowsBanner } from "@/components/feedback";
import { getBatchReport } from "@/lib/services/reports";

import { HeaderLink, QuestionStatTable } from "../../../reports/report-bits";
import { ScoreBar } from "../../../reports/score-bar";

/**
 * The batch's dashboard, at home in the batches section (2026-08-11: a
 * batch row clicks through to its report the way every other entity does,
 * WITHOUT leaving `/admin/batches`; `/admin/reports/[batchId]` redirects
 * here). The composer stays at `/admin/batches/[id]`, behind Edit — the
 * same split as questions.
 *
 * Numbers are BATCH-scoped: only answers given through this batch (async
 * via its link, or live sessions run off it), deduped to first answers.
 * The per-question rows click through to each question's ORG-WIDE report.
 */
export default async function BatchReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getBatchReport(id);

  return (
    <>
      <PageHeader
        title={report.batch.name}
        meta={`${report.participantCount} participant${report.participantCount === 1 ? "" : "s"} · ${report.questionCount} question${report.questionCount === 1 ? "" : "s"}`}
        actions={
          <div className="flex items-center gap-2.5">
            <HeaderLink href="/admin/batches">← All batches</HeaderLink>
            <HeaderLink href={`/admin/batches/${report.batch.id}`}>
              Edit batch
            </HeaderLink>
          </div>
        }
      />

      <div className="flex flex-col gap-6 p-6">
        <SkippedRowsBanner skipped={report.skipped} />

        {report.duplicateCount > 0 && (
          <p className="text-[12.5px] text-muted-3">
            {report.duplicateCount} repeat answer
            {report.duplicateCount === 1 ? "" : "s"} excluded — when the same
            person answers the same question more than once (async and live,
            or across sessions), only their first answer counts.
          </p>
        )}

        <Section title="By rubric code">
          {report.rubric.length === 0 ? (
            <p className="text-[13px] text-muted-3">
              No which_principle responses yet.
            </p>
          ) : (
            <>
              <div className="flex flex-col">
                {report.rubric.map((row) => (
                  <ScoreBar
                    key={row.code}
                    label={`${row.code} — ${row.name}`}
                    correct={row.correct}
                    total={row.total}
                    note={
                      row.mostPickedWrong &&
                      `most-picked wrong: ${row.mostPickedWrong.code}`
                    }
                  />
                ))}
              </div>
              <p className="mt-1 text-[12px] leading-[1.5] text-muted-3">
                A code&rsquo;s bar counts only the questions it was the
                ANSWER to — a miss debits the code being tested, not every
                code that appeared as an option.
              </p>
            </>
          )}
        </Section>

        <Section title="By topic">
          {report.topics.length === 0 ? (
            <p className="text-[13px] text-muted-3">
              No gradeable responses yet.
            </p>
          ) : (
            <>
              <div className="flex flex-col">
                {report.topics.map((row) => (
                  <ScoreBar
                    key={row.slug}
                    label={row.label}
                    correct={row.correct}
                    total={row.total}
                  />
                ))}
              </div>
              <p className="mt-1 text-[12px] leading-[1.5] text-muted-3">
                Includes rank_variants responses, graded exact-match. A low
                bar on a topic that&rsquo;s mostly rank_variants questions
                reflects that template&rsquo;s 1-in-24 chance floor, not
                necessarily miscalibration — see the rubric axis above for
                the calibration signal proper.
              </p>
            </>
          )}
        </Section>

        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-ink-3">
            By question
          </h2>
          <QuestionStatTable rows={report.questions} />
          <p className="text-[12px] leading-[1.5] text-muted-3">
            Counts here are this batch&rsquo;s answers only; a question&rsquo;s
            row opens its org-wide report.
          </p>
        </section>

        {report.excluded.length > 0 && (
          <div className="rounded-[10px] border border-line bg-surface p-4">
            <p className="text-[13px] text-muted-2">
              {report.excluded.length} write_feedback question
              {report.excluded.length === 1 ? "" : "s"} excluded from grading
              — prose answers have no key to grade against.
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer select-none text-[12.5px] text-violet-ink hover:text-violet-deep">
                Read the responses →
              </summary>
              <div className="mt-3 flex flex-col gap-4">
                {report.excluded.map((question) => (
                  <div key={question.id} className="flex flex-col gap-1.5">
                    <p className="text-[12.5px] font-medium text-ink-3">
                      {question.prompt}
                    </p>
                    {question.responses.length === 0 ? (
                      <p className="text-[12px] text-faint">
                        No responses yet.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {question.responses.map((response, index) => (
                          <li
                            key={index}
                            className="rounded-[8px] border border-line-3 bg-white px-3 py-2 text-[12.5px] leading-[1.5] text-muted"
                          >
                            {response.feedback}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-ink-3">
        {title}
      </h2>
      <div className="rounded-[10px] border border-line bg-white px-4 py-2">
        {children}
      </div>
    </section>
  );
}
