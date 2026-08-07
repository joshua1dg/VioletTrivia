import { PageHeader, Placeholder } from "@/components/admin/ui";

export default function SessionsPage() {
  return (
    <>
      <PageHeader title="Live sessions" meta="Next pass" />
      <Placeholder title="Host controls">
        Start a session off a batch, then advance, lock, reveal and end it.
        Every one of those is an update to a single `live_sessions` row that
        Realtime pushes to the phones and the presenter screen. Needs the
        force-end control too — sessions are one-per-host, so an abandoned one
        blocks that host from starting another.
      </Placeholder>
    </>
  );
}
