import "server-only";

/**
 * The public surface (PLAN §5.3). Nothing outside this folder imports
 * `reports.service.ts` or a `*.util.ts` directly.
 */

export {
  getBatchReport,
  listBatchReportSummaries,
  type BatchReport,
  type BatchReportSummary,
} from "./reports.service";

export type { ExcludedQuestion } from "./exclusion.util";
export type { RubricRow } from "./rubric.util";
export type { TopicRow } from "./topic.util";

export type { SkippedRow } from "@/lib/repos/_shared";
