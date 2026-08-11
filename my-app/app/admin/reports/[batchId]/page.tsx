import { redirect } from "next/navigation";

/**
 * The batch report moved into the batches section (2026-08-11 — a batch
 * row clicks through to its report without leaving `/admin/batches`, the
 * same shape as questions/topics/principles). This route survives only so
 * old links keep working.
 */
export default async function LegacyBatchReportPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  redirect(`/admin/batches/${batchId}/report`);
}
