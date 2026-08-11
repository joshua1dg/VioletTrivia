import { PageHeader } from "@/components/admin/ui";
import { SkippedRowsBanner } from "@/components/feedback";
import { getTopicReport } from "@/lib/services/reports";

import { HeaderLink, QuestionStatTable } from "../../reports/report-bits";
import { ScoreBar } from "../../reports/score-bar";

/**
 * The topic's dashboard — what clicking a topic row means now (2026-08-11).
 * Rename/delete stay inline on `/admin/topics`; the library filtered to
 * this topic is one header link away.
 *
 * Numbers are ORG-WIDE across all this topic's questions, deduped to each
 * participant's first answer per question.
 */
export default async function TopicReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const report = await getTopicReport(slug);

  return (
    <>
      <PageHeader
        title={report.topic.label}
        meta={`Topic · ${report.questionCount} question${report.questionCount === 1 ? "" : "s"} · ${report.responseCount} answer${report.responseCount === 1 ? "" : "s"} from ${report.participantCount} participant${report.participantCount === 1 ? "" : "s"}`}
        actions={
          <div className="flex items-center gap-2.5">
            <HeaderLink href="/admin/topics">← All topics</HeaderLink>
            <HeaderLink href={`/admin/questions?topic=${report.topic.slug}`}>
              View in library
            </HeaderLink>
          </div>
        }
      />

      <div className="flex flex-col gap-6 p-6">
        <SkippedRowsBanner skipped={report.skipped} />

        {report.duplicateCount > 0 && (
          <p className="text-[12.5px] text-muted-3">
            {report.duplicateCount} repeat answer
            {report.duplicateCount === 1 ? "" : "s"} excluded — only each
            person&rsquo;s first answer per question counts.
          </p>
        )}

        <section className="flex flex-col gap-1.5">
          <h2 className="text-[12px] tracking-[0.04em] text-faint">
            CORRECT RATE
          </h2>
          {report.total === 0 ? (
            <p className="text-[13px] text-muted-3">
              No gradeable answers yet.
            </p>
          ) : (
            <ScoreBar
              label="All questions"
              correct={report.correct}
              total={report.total}
            />
          )}
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="text-[12px] tracking-[0.04em] text-faint">
            BY QUESTION
          </h2>
          <QuestionStatTable rows={report.questions} />
        </section>
      </div>
    </>
  );
}
