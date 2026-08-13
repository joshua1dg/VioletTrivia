import { PageHeader } from "@/components/admin/ui";
import { getStaff } from "@/lib/auth";
import { asAppError } from "@/lib/errors";
import { listStaff } from "@/lib/services/staff";

import { StaffTable } from "./_ui/staff-table";

/**
 * Admin-only screen (PODS.md decision 4: staff is system-tier). The layout
 * already gates /admin/* on `requireStaff()`, so a signed-in pod or project
 * lead can reach this ROUTE — `listStaff()`'s own `requireAdmin()` is what
 * actually keeps them out. Caught here rather than left to throw so the
 * page still renders (200, not an error boundary): a lead who follows a
 * stale link sees "requires an admin account," not a crash.
 */
export default async function StaffPage() {
  let rows;
  try {
    rows = await listStaff();
  } catch (error) {
    return (
      <>
        <PageHeader title="Staff" />
        <p className="max-w-[60ch] p-6 text-[13.5px] leading-[1.6] text-muted-2">
          {asAppError(error).userMessage}
        </p>
      </>
    );
  }

  // Already known to be an admin — listStaff() above would have thrown
  // otherwise. Only used to grey out this admin's own remove/demote
  // controls in the table; the service enforces it regardless.
  const me = await getStaff();

  // StaffTable renders the PageHeader itself — the header's "Add staff"
  // button toggles the invite card, and that state lives client-side.
  return <StaffTable staff={rows} currentUserId={me?.userId ?? null} />;
}
