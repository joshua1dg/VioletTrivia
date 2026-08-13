import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader, PrimaryLink } from "@/components/admin/ui";
import { getProposalsView } from "@/lib/services/questions";

import { MineRow } from "./_ui/mine-row";
import { QueueRow } from "./_ui/queue-row";

/**
 * The Proposals tab (Wave 2, propose-to-master). There are no
 * notifications — this screen IS the inbox: project leads and admins work
 * the pending pile here ("Pending review", `view.queue` — null, not `[]`,
 * for anyone who isn't a curator, since the section doesn't exist for them
 * rather than merely being empty), and everyone tracks their own
 * submissions here ("Your proposals", `view.mine`), including the denial
 * note that is the only feedback a submitter ever gets.
 *
 * `getProposalsView()` already calls `requireStaff()` (the admin layout's
 * `requireStaff()` is the actual sign-in gate — see app/admin/layout.tsx);
 * this page does no authorization of its own, same as every other admin
 * screen that reads a service view straight into JSX.
 */
export default async function ProposalsPage() {
  const view = await getProposalsView();

  return (
    <>
      <PageHeader
        title="Proposals"
        meta="Anyone can propose a question; project leads and admins review the pile before it goes live."
        actions={<PrimaryLink href="/admin/questions/new">New question</PrimaryLink>}
      />

      <div className="flex flex-col gap-8 p-6">
        {view.queue !== null && (
          <Section title="Pending review">
            {view.queue.length === 0 ? (
              <p className="px-2 py-2 text-[13px] text-muted-3">
                Nothing waiting on review.
              </p>
            ) : (
              <div className="-mx-4 -my-2">
                {view.queue.map((q) => (
                  <QueueRow key={q.id} question={q} />
                ))}
              </div>
            )}
          </Section>
        )}

        <Section title="Your proposals">
          {view.mine.length === 0 ? (
            <p className="px-2 py-2 text-[13px] leading-[1.6] text-muted-3">
              You haven&apos;t proposed any questions yet — start one from
              the{" "}
              <Link
                href="/admin/questions/new"
                className="text-violet-ink hover:underline"
              >
                Questions
              </Link>{" "}
              screen.
            </p>
          ) : (
            <div className="-mx-4 -my-2">
              {view.mine.map((q) => (
                <MineRow key={q.id} question={q} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </>
  );
}

/** Same card-with-heading shape as app/admin/reports/page.tsx's local
 *  `Section` — kept as a second copy rather than shared, per this file's
 *  ownership boundary (no touching anything outside app/admin/proposals/**). */
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
