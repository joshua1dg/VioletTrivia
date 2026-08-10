"use client";

// Real "use client" — owns the whole in-progress edit (settings draft +
// queue selection/order), the dirty comparison against what's on the server,
// and the pending/error state for the one save that commits both.

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  ConfirmDelete,
  ErrorNote,
  SubmitButton,
  type ConfirmDeleteOutcome,
  type ErrorLike,
} from "@/components/feedback";
import type { BatchWithCounts } from "@/lib/services/batches";
import type { QuestionSummary } from "@/lib/services/questions";

import { deleteBatch, saveBatch } from "../../actions";
import { QuestionLibraryPanel } from "./question-library-panel";
import { QueuePanel } from "./queue-panel";
import {
  SettingsPanel,
  settingsDraftFromBatch,
  settingsEqual,
  settingsPatchFromDraft,
  type SettingsDraft,
} from "./settings-panel";

/**
 * Three columns over one footer action bar.
 *
 * All of it is one edit to one batch, so it is one state object and one
 * save. This screen used to have two: "Save settings" in the left column
 * wrote the four text fields, "Save queue" in the right column wrote the
 * question list, and the status pills and active-async checkbox each wrote
 * on click with no save at all — four write paths for one row. Now nothing
 * below this component calls a Server Action; the panels report changes
 * upward and the footer commits them together via `saveBatch`.
 *
 * The queue never autosaved on reorder even before this — arrows moved local
 * state and waited for the button — so unifying the save didn't take away
 * any write that used to happen on its own. What it DID take away is the
 * status/active-async click-to-write, which is deliberate: those are batch
 * settings, and "settings and queue are the same move" (Josh) has to include
 * them or the panel keeps two idioms.
 *
 * The cost of one deferred save is that unsaved work can now be navigated
 * away from. Three things address it: the footer says so in words, the
 * button only lights up when there's something to commit, and `beforeunload`
 * catches a reload or a closed tab. In-app <Link> navigation (the sidebar)
 * is NOT intercepted — that needs `onNavigate` on the links themselves,
 * which live outside this screen.
 */
export function Composer({
  batch,
  initialQueue,
  library,
}: {
  batch: BatchWithCounts;
  initialQueue: string[];
  library: QuestionSummary[];
}) {
  const router = useRouter();

  const [settings, setSettings] = useState<SettingsDraft>(() =>
    settingsDraftFromBatch(batch),
  );
  const [queue, setQueue] = useState(initialQueue);

  // What the server last confirmed. Seeded from the props, then replaced with
  // the exact payload each successful save sent — not with the state as it
  // stands when the response lands, so edits made mid-flight stay dirty.
  const [saved, setSaved] = useState<{
    settings: SettingsDraft;
    queue: string[];
  }>(() => ({ settings: settingsDraftFromBatch(batch), queue: initialQueue }));

  const [error, setError] = useState<ErrorLike | null>(null);
  const [pending, startTransition] = useTransition();

  const questionsById = useMemo(
    () => new Map(library.map((q) => [q.id, q])),
    [library],
  );
  const selectedIds = useMemo(() => new Set(queue), [queue]);

  const queueDirty =
    queue.length !== saved.queue.length ||
    queue.some((id, i) => id !== saved.queue[i]);
  const dirty = queueDirty || !settingsEqual(settings, saved.settings);

  // Covers reload, tab close and typing a URL. Client-side <Link> navigation
  // doesn't fire this event, so it is a backstop, not a guarantee.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function changeSettings(patch: Partial<SettingsDraft>) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  function toggle(id: string) {
    setQueue((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function move(index: number, direction: -1 | 1) {
    setQueue((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function remove(id: string) {
    setQueue((prev) => prev.filter((x) => x !== id));
  }

  function save() {
    if (!dirty || pending) return;
    setError(null);

    // Snapshot first: the save is idempotent (it sends the whole batch and
    // the whole queue, never a diff), so a failure is "click save again" and
    // a success marks exactly what went over the wire as clean.
    const snapshot = { settings, queue };

    startTransition(async () => {
      const result = await saveBatch(batch.id, {
        settings: settingsPatchFromDraft(snapshot.settings),
        orderedIds: snapshot.queue,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved(snapshot);
    });
  }

  async function confirmedDelete(): Promise<ConfirmDeleteOutcome> {
    const result = await deleteBatch(batch.id);
    if (!result.ok) return { ok: false, message: result.message };
    router.push("/admin/batches");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-stretch">
        <SettingsPanel draft={settings} onChange={changeSettings} />
        <QuestionLibraryPanel
          library={library}
          selectedIds={selectedIds}
          onToggle={toggle}
        />
        <QueuePanel
          queue={queue}
          questionsById={questionsById}
          onMove={move}
          onRemove={remove}
          activeWarning={settings.isActiveAsync}
        />
      </div>

      {/* Save on one side, delete on the other — the two things you can do
          to the batch as a whole, at the bottom of the thing they act on. */}
      <footer className="flex shrink-0 flex-col gap-3 border-t border-line-2 px-6 py-4">
        <ErrorNote error={error} />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SubmitButton
              type="button"
              onClick={save}
              pending={pending}
              variant={dirty ? "primary" : "ghost"}
            >
              {dirty ? "Save changes" : "Saved"}
            </SubmitButton>
            <span className="text-[12px] leading-[1.5] text-muted-3">
              {dirty
                ? "Unsaved changes — settings and queue save together."
                : "Settings and queue match what's saved."}
            </span>
          </div>

          <ConfirmDelete
            triggerLabel="Delete batch"
            title="Delete this batch?"
            description={
              <>
                Removes {batch.questionCount} question
                {batch.questionCount === 1 ? "" : "s"} from its queue.{" "}
                {batch.responseCount > 0
                  ? `${batch.responseCount} recorded response${
                      batch.responseCount === 1 ? "" : "s"
                    } keep their answers but lose the batch link.`
                  : "No responses have been recorded against it yet."}{" "}
                A batch with a live session still open can&rsquo;t be deleted —
                end the session first.
              </>
            }
            onConfirm={confirmedDelete}
          />
        </div>
      </footer>
    </div>
  );
}
