"use client";

// Real "use client" — owns the in-progress queue (selection + order) across
// the library and queue panels, and the pending/error state for saving it.

import { useMemo, useState, useTransition } from "react";

import type { ErrorLike } from "@/components/feedback";
import type { BatchWithCounts } from "@/lib/services/batches";
import type { QuestionSummary } from "@/lib/services/questions";

import { setQuestions } from "../../actions";
import { QuestionLibraryPanel } from "./question-library-panel";
import { QueuePanel } from "./queue-panel";
import { SettingsPanel } from "./settings-panel";

/**
 * Three columns, one shared piece of state: `queue`, the ordered list of
 * question ids. The library panel writes to it by tick-box (append/remove,
 * order unaffected); the queue panel writes to it by arrow (swap adjacent)
 * or removal. Neither panel calls a Server Action itself — `setQuestions`
 * only fires from this component's "Save queue" handler, so ticking ten
 * boxes is ten local state updates and one network round trip, not ten.
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
  const [queue, setQueue] = useState(initialQueue);
  const [savedQueue, setSavedQueue] = useState(initialQueue);
  const [error, setError] = useState<ErrorLike | null>(null);
  const [pending, startTransition] = useTransition();

  const questionsById = useMemo(
    () => new Map(library.map((q) => [q.id, q])),
    [library],
  );
  const selectedIds = useMemo(() => new Set(queue), [queue]);
  const dirty =
    queue.length !== savedQueue.length ||
    queue.some((id, i) => id !== savedQueue[i]);

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
    setError(null);
    startTransition(async () => {
      const result = await setQuestions(batch.id, queue);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSavedQueue(queue);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 items-stretch">
      <SettingsPanel batch={batch} />
      <QuestionLibraryPanel
        library={library}
        selectedIds={selectedIds}
        onToggle={toggle}
      />
      <QueuePanel
        queue={queue}
        questionsById={questionsById}
        dirty={dirty}
        pending={pending}
        error={error}
        onMove={move}
        onRemove={remove}
        onSave={save}
        activeWarning={batch.isActiveAsync}
      />
    </div>
  );
}
