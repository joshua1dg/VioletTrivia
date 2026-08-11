"use client";

// The one client boundary on this screen (PLAN's rule: at the boundary
// only). Owns the interaction state the page shouldn't: create/rename
// pending+error via useActionState, reorder pending via useTransition,
// delete via <ConfirmDelete> (which owns its own transition).

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";

import { GhostButton } from "@/components/admin/ui";
import { ConfirmDelete, ErrorNote, SubmitButton } from "@/components/feedback";
import type { TopicWithUsage } from "@/lib/services/topics";

import {
  createTopic,
  deleteTopic,
  reorderTopics,
  updateTopic,
  type ActionResult,
} from "../actions";

const initialState: ActionResult | null = null;

export function TopicsTable({ topics }: { topics: TopicWithUsage[] }) {
  const [isReordering, startReorder] = useTransition();
  const [reorderError, setReorderError] = useState<string | null>(null);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= topics.length) return;

    const next = topics.slice();
    [next[index], next[target]] = [next[target], next[index]];

    startReorder(async () => {
      const result = await reorderTopics(next.map((t) => t.id));
      setReorderError(result.ok ? null : result.message);
    });
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <p className="max-w-[70ch] rounded-[10px] border border-violet-line bg-violet-tint px-4 py-3 text-[13px] leading-[1.6] text-muted">
        These are placeholders. The design&rsquo;s topic list — overclaiming,
        sycophancy, hedging — was really a list of failure modes, which is
        what the rubric codes are for. Topics are why a question is worth
        asking. Replace these with your real vocabulary before anyone starts
        authoring.
      </p>

      <CreateTopicForm count={topics.length} />

      <ErrorNote error={reorderError} />

      <div className="overflow-hidden rounded-[10px] border border-line">
        <div className="grid grid-cols-[1fr_200px_100px_120px_auto] items-center gap-0 border-b border-line-2 bg-surface px-4 py-2.5 text-[11.5px] tracking-[0.04em] text-faint">
          <span>LABEL</span>
          <span>SLUG</span>
          <span>QUESTIONS</span>
          <span>ORDER</span>
          <span />
        </div>

        {topics.length === 0 && (
          <p className="px-4 py-8 text-[13.5px] text-muted-3">
            No topics yet — create the first one above.
          </p>
        )}

        {topics.map((topic, index) => (
          <TopicRow
            key={topic.id}
            topic={topic}
            isFirst={index === 0}
            isLast={index === topics.length - 1}
            reorderPending={isReordering}
            onMoveUp={() => move(index, -1)}
            onMoveDown={() => move(index, 1)}
          />
        ))}
      </div>
    </div>
  );
}

function CreateTopicForm({ count }: { count: number }) {
  const [state, action] = useActionState(createTopic, initialState);

  return (
    <form
      // Keyed by count so a successful create clears the (uncontrolled)
      // inputs by remounting the form rather than hand-rolling reset state.
      key={count}
      action={action}
      className="flex flex-wrap items-end gap-2.5 rounded-[10px] border border-line bg-white p-4"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-muted">Label</span>
        <input
          name="label"
          required
          placeholder="Edge case"
          className="w-48 rounded-[7px] border border-line px-3 py-1.5 text-[13.5px] text-ink outline-none focus:border-violet"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-muted">Slug</span>
        <input
          name="slug"
          required
          placeholder="edge-case"
          className="w-40 rounded-[7px] border border-line px-3 py-1.5 font-mono text-[12.5px] text-ink outline-none focus:border-violet"
        />
      </label>
      <SubmitButton>New topic</SubmitButton>
      <div className="basis-full">
        <ErrorNote error={state?.ok === false ? state.message : null} />
      </div>
    </form>
  );
}

function TopicRow({
  topic,
  isFirst,
  isLast,
  reorderPending,
  onMoveUp,
  onMoveDown,
}: {
  topic: TopicWithUsage;
  isFirst: boolean;
  isLast: boolean;
  reorderPending: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const boundUpdate = updateTopic.bind(null, topic.id);
  const [state, action, pending] = useActionState(boundUpdate, initialState);

  // useActionState's `state` keeps the last result until the next dispatch,
  // so reacting to "ok" on every render would immediately close a
  // *subsequent* edit too. Tracking the last-handled result in state makes
  // the collapse fire once per resolved action — the render-phase state
  // adjustment React documents for deriving from a previous render.
  const [handled, setHandled] = useState<ActionResult | null>(null);
  if (state?.ok && editing && handled !== state) {
    setHandled(state);
    setEditing(false);
  }

  const blastRadius =
    topic.questionCount === 0
      ? "No questions use this topic — nothing will change for any question."
      : `${topic.questionCount} question${topic.questionCount === 1 ? "" : "s"} will lose this topic.`;

  if (editing) {
    return (
      <form
        action={action}
        className="grid grid-cols-[1fr_200px_100px_120px_auto] items-center gap-2 border-b border-line-3 bg-violet-tint/30 px-4 py-3 last:border-b-0"
      >
        <input
          name="label"
          defaultValue={topic.label}
          required
          className="rounded-[6px] border border-line px-2.5 py-1 text-[13.5px] text-ink outline-none focus:border-violet"
        />
        <input
          name="slug"
          defaultValue={topic.slug}
          required
          className="rounded-[6px] border border-line px-2.5 py-1 font-mono text-[12px] text-ink outline-none focus:border-violet"
        />
        <span className="text-[12.5px] text-muted-2 tabular-nums">
          {topic.questionCount}
        </span>
        <span className="text-[12.5px] text-muted-3 tabular-nums">
          {topic.sortOrder}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer rounded-[6px] bg-violet px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-violet-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setEditing(false)}
            className="cursor-pointer rounded-[6px] border border-line px-2.5 py-1 text-[12px] text-ink-4 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
        {state?.ok === false && (
          <div className="col-span-5">
            <ErrorNote error={state.message} />
          </div>
        )}
      </form>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_200px_100px_120px_auto] items-center gap-2 border-b border-line-3 px-4 py-3 transition-colors last:border-b-0 hover:bg-surface">
      {/* The label IS the way into the topic: the questions library,
          pre-filtered to it. Rename/delete stay as the explicit buttons on
          the right, so the row's one click target does the obvious thing. */}
      <Link
        href={`/admin/questions?topic=${topic.slug}`}
        className="text-[13.5px] text-ink-3 transition-colors hover:text-violet-ink hover:underline"
      >
        {topic.label}
      </Link>
      <span className="font-mono text-[12.5px] text-muted-2">{topic.slug}</span>
      <Link
        href={`/admin/questions?topic=${topic.slug}`}
        className="text-[12.5px] text-muted-2 tabular-nums transition-colors hover:text-violet-ink hover:underline"
      >
        {topic.questionCount}
      </Link>
      <span className="text-[12.5px] text-muted-3 tabular-nums">
        {topic.sortOrder}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Move up"
          disabled={isFirst || reorderPending}
          onClick={onMoveUp}
          className="cursor-pointer rounded-[6px] border border-line px-2 py-1 text-[12px] text-ink-4 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
        >
          ↑
        </button>
        <button
          type="button"
          aria-label="Move down"
          disabled={isLast || reorderPending}
          onClick={onMoveDown}
          className="cursor-pointer rounded-[6px] border border-line px-2 py-1 text-[12px] text-ink-4 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
        >
          ↓
        </button>
        <GhostButton onClick={() => setEditing(true)}>Rename</GhostButton>
        <ConfirmDelete
          triggerLabel="Delete"
          title={`Delete "${topic.label}"?`}
          description={blastRadius}
          onConfirm={() => deleteTopic(topic.id)}
        />
      </div>
    </div>
  );
}
