import { PageHeader, StatusPill, Tag } from "@/components/admin/ui";
import { SkippedRowsBanner } from "@/components/feedback";
import { getQuestionReport } from "@/lib/services/reports";
import { registry } from "@/lib/templates/registry";

import { HeaderLink, TallyBars } from "../../../reports/report-bits";
import { ScoreBar } from "../../../reports/score-bar";

/**
 * The question's dashboard — what clicking a question row means now
 * (2026-08-11: "everything goes to a report"). Editing moved behind the
 * explicit button in the header; the editor itself is unchanged at
 * `/admin/questions/[id]`.
 *
 * Numbers are ORG-WIDE: every batch and live session this question has run
 * in, deduped to each participant's first answer.
 */
export default async function QuestionReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getQuestionReport(id);
  const q = report.question;

  return (
    <>
      <PageHeader
        title={q.prompt}
        meta={`${registry[q.template].label} · ${report.responseCount} answer${report.responseCount === 1 ? "" : "s"} from ${report.participantCount} participant${report.participantCount === 1 ? "" : "s"}, all batches and sessions`}
        actions={
          <div className="flex items-center gap-2.5">
            <HeaderLink href="/admin/questions">← All questions</HeaderLink>
            <HeaderLink href={`/admin/questions/${q.id}`}>
              Edit question
            </HeaderLink>
          </div>
        }
      />

      <div className="flex flex-col gap-6 p-6">
        <SkippedRowsBanner skipped={report.skipped} />

        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={q.status} />
          {report.keyCode && (
            <Tag>key: {report.keyCode}</Tag>
          )}
          {report.topics.map((topic) => (
            <Tag key={topic.slug}>{topic.label}</Tag>
          ))}
          {report.duplicateCount > 0 && (
            <span className="text-[12px] text-muted-3">
              {report.duplicateCount} repeat answer
              {report.duplicateCount === 1 ? "" : "s"} excluded
            </span>
          )}
        </div>

        {report.total > 0 && (
          <section className="flex flex-col gap-1.5">
            <h2 className="text-[12px] tracking-[0.04em] text-faint">
              CORRECT RATE
            </h2>
            <ScoreBar
              label="All participants"
              correct={report.correct}
              total={report.total}
            />
          </section>
        )}

        <section className="flex flex-col gap-2.5">
          <h2 className="text-[12px] tracking-[0.04em] text-faint">
            ANSWER DISTRIBUTION
          </h2>
          {report.tally === null ? (
            <p className="text-[13px] text-muted-3">
              Prose answers — no distribution to chart.
            </p>
          ) : report.responseCount === 0 ? (
            <p className="text-[13px] text-muted-3">No answers yet.</p>
          ) : (
            <TallyBars groups={report.tally} />
          )}
        </section>

        {report.feedback.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h2 className="text-[12px] tracking-[0.04em] text-faint">
              WRITTEN FEEDBACK ({report.feedback.length})
            </h2>
            <ul className="flex flex-col gap-1.5">
              {report.feedback.map((text, index) => (
                <li
                  key={index}
                  className="rounded-[8px] border border-line-3 bg-white px-3 py-2 text-[12.5px] leading-[1.5] text-muted"
                >
                  {text}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
