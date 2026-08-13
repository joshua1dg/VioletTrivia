"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Field, Segmented, TextInput } from "@/components/admin/form";
import { TurnsEditor } from "@/components/admin/turns-editor";
import { Chip } from "@/components/admin/ui";
import {
  ConfirmDelete,
  ErrorNote,
  SubmitButton,
  type ErrorLike,
} from "@/components/feedback";
import { registry, templateKeys, type QuestionTemplate } from "@/lib/templates/registry";
import type {
  PrincipleOption,
  RankVariantsContent,
  RankVariantsKey,
  TemplateKey,
  Turn,
  WhichPrincipleContent,
  WhichPrincipleKey,
  WriteFeedbackContent,
  WriteFeedbackKey,
} from "@/lib/templates/types";
import type { QuestionStatusInput } from "@/lib/schemas/questions";
import type { EditableQuestion } from "@/lib/services/questions";
import type { Topic } from "@/lib/services/topics";

import {
  archiveQuestion,
  createQuestion,
  deleteQuestion,
  submitQuestionForReview,
  updateQuestion,
  type ActionResult,
} from "../actions";

/**
 * One template's Author form, plus the two pieces every template shares
 * (the excerpt and the reviewer-facing prompt). Fully controlled from
 * `QuestionEditor` — no local state — so the parent has what it needs at
 * save time without a second channel back up.
 */
function TemplateSection<C extends { turns: Turn[] }, K>({
  def,
  content,
  answerKey,
  onContent,
  onAnswerKey,
  principles,
  prompt,
  onPrompt,
}: {
  def: QuestionTemplate<C, K>;
  content: C;
  answerKey: K;
  onContent: (next: C) => void;
  onAnswerKey: (next: K) => void;
  principles: PrincipleOption[];
  prompt: string;
  onPrompt: (next: string) => void;
}) {
  // The constraint lets the shared turns editor read content.turns for any
  // template. Writing needs one cast: TypeScript can't see that spreading a
  // generic C and replacing a known key still produces a C.
  const setTurns = (turns: Turn[]) => onContent({ ...content, turns } as C);

  return (
    <div className="flex flex-col gap-6">
      <TurnsEditor turns={content.turns} onChange={setTurns} />

      <Field
        label="Prompt shown to reviewers"
        hint="The question itself. Stored as a column, not inside the template payload."
      >
        <TextInput value={prompt} onChange={onPrompt} placeholder={def.blurb} />
      </Field>

      <def.Author
        content={content}
        answerKey={answerKey}
        principles={principles}
        onContent={onContent}
        onAnswerKey={onAnswerKey}
      />
    </div>
  );
}

/**
 * The one place a runtime template string becomes a static type. A switch is
 * unavoidable at that boundary; what the registry buys is that it happens
 * exactly once instead of in every screen that touches a question.
 */
function TemplateForm({
  template,
  content,
  answerKey,
  principles,
  prompt,
  onPrompt,
  onContent,
  onAnswerKey,
}: {
  template: TemplateKey;
  content: unknown;
  answerKey: unknown;
  principles: PrincipleOption[];
  prompt: string;
  onPrompt: (next: string) => void;
  onContent: (next: unknown) => void;
  onAnswerKey: (next: unknown) => void;
}) {
  const shared = { principles, prompt, onPrompt };
  switch (template) {
    case "which_principle":
      return (
        <TemplateSection
          def={registry.which_principle}
          content={content as WhichPrincipleContent}
          answerKey={answerKey as WhichPrincipleKey}
          onContent={onContent as (next: WhichPrincipleContent) => void}
          onAnswerKey={onAnswerKey as (next: WhichPrincipleKey) => void}
          {...shared}
        />
      );
    case "rank_variants":
      return (
        <TemplateSection
          def={registry.rank_variants}
          content={content as RankVariantsContent}
          answerKey={answerKey as RankVariantsKey}
          onContent={onContent as (next: RankVariantsContent) => void}
          onAnswerKey={onAnswerKey as (next: RankVariantsKey) => void}
          {...shared}
        />
      );
    case "write_feedback":
      return (
        <TemplateSection
          def={registry.write_feedback}
          content={content as WriteFeedbackContent}
          answerKey={answerKey as WriteFeedbackKey}
          onContent={onContent as (next: WriteFeedbackContent) => void}
          onAnswerKey={onAnswerKey as (next: WriteFeedbackKey) => void}
          {...shared}
        />
      );
  }
}

/** Display-only re-derivation of principleCodes for the rail — the source of
 *  truth is still `registry[template].principleCodes`, called again inside
 *  the service at save time against the validated content. Duplicated here
 *  (rather than imported) because `lib/services/questions` is server-only
 *  and this file is a client component. */
function principleCodesFor(template: TemplateKey, content: unknown): string[] {
  const derive = registry[template].principleCodes as (content: unknown) => string[];
  return derive(content);
}

export function QuestionEditor({
  mode,
  id,
  topics,
  principles,
  initial,
  canCurate,
  initialSubmitError,
}: {
  mode: "new" | "edit";
  /** Required when mode === "edit". */
  id?: string;
  topics: Topic[];
  principles: PrincipleOption[];
  initial?: EditableQuestion;
  /** `canCurateMaster(staff)`, computed server-side by the page. Everyone
   *  now drafts the same way (2026-08-13) — this only still matters for the
   *  lifecycle buttons (Save draft/Save & publish/Archive/Delete) on an
   *  already-APPROVED question, which only a curator can reach at all
   *  (`assertCanEdit`). The UI here is discoverability, not security. */
  canCurate: boolean;
  /** Set by `[id]/page.tsx` from `?submitError=1` — the one case where a
   *  save-then-submit chain (from the `new` page) succeeded at the save but
   *  failed at the submit. The row exists as a draft either way; this just
   *  tells the freshly-landed edit page to say so, since the client state
   *  that saw the failure didn't survive the navigation. */
  initialSubmitError?: boolean;
}) {
  const router = useRouter();

  const [template, setTemplateState] = useState<TemplateKey>(
    initial?.template ?? "which_principle",
  );
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [content, setContent] = useState<unknown>(
    () => initial?.content ?? registry[template].empty().content,
  );
  const [answerKey, setAnswerKey] = useState<unknown>(
    () => initial?.answerKey ?? registry[template].empty().answerKey,
  );
  const [topicIds, setTopicIds] = useState<string[]>(initial?.topicIds ?? []);

  const toggleTopic = (topicId: string) =>
    setTopicIds((ids) =>
      ids.includes(topicId) ? ids.filter((v) => v !== topicId) : [...ids, topicId],
    );

  // Switching template resets the question — the three shapes don't convert
  // into each other (same rule the "New question" hint already stated).
  function changeTemplate(next: TemplateKey) {
    setTemplateState(next);
    const blank = registry[next].empty();
    setContent(blank.content);
    setAnswerKey(blank.answerKey);
  }

  const codes = principleCodesFor(template, content);

  const reviewStatus = initial?.reviewStatus;
  const isApproved = reviewStatus === "approved";

  function buildPayload(status: QuestionStatusInput) {
    return {
      ...(mode === "edit" && id ? { id } : {}),
      template,
      prompt,
      content,
      answerKey,
      status,
      topicIds,
    };
  }

  // Pure save, no review-status change (2026-08-13: saving never moves the
  // review needle any more). Drives every plain "Save…" button — the
  // lifecycle buttons on an approved question, "Save (stays in review)" on
  // a proposed one, and the ghost "Save"/"Save draft" beside the
  // save-then-submit buttons below.
  const action = mode === "edit" ? updateQuestion : createQuestion;
  const [state, dispatch, pending] = useActionState<ActionResult | null, unknown>(
    action,
    null,
  );

  function save(status: QuestionStatusInput) {
    startTransition(() => dispatch(buildPayload(status)));
  }

  const saveError = state && !state.ok ? state.message : null;
  const saved = mode === "edit" && state?.ok === true;

  // `new` mode has no server redirect any more (createQuestion just returns
  // `{ ok, id }`, same shape as updateQuestion, so the save-then-submit
  // chain below can read the new id back out). "Save draft" still lands on
  // the edit page afterward — just via client navigation instead of a
  // server-side `redirect()`.
  useEffect(() => {
    if (mode === "new" && state?.ok) {
      router.push(`/admin/questions/${state.id}`);
    }
  }, [mode, state, router]);

  // The save-then-submit chain (2026-08-13): submitting is now its own
  // explicit step (`submitQuestionForReview`), never implicit in a save. The
  // "submit" buttons still read as one click, so they chain a save and the
  // submit client-side rather than leaving unsaved edits behind — silently
  // submitting stale content would be worse than the extra round trip.
  // Shared by both the `new`-mode and `edit`-mode (draft/denied) submit
  // buttons; only one is ever mounted at a time.
  const [combinedPending, startCombined] = useTransition();
  const [combinedError, setCombinedError] = useState<ErrorLike | null>(null);
  const [combinedNotice, setCombinedNotice] = useState<string | null>(null);

  function handleCreateAndSubmit() {
    setCombinedError(null);
    setCombinedNotice(null);
    startCombined(async () => {
      const created = await createQuestion(null, buildPayload("draft"));
      if (!created.ok) {
        setCombinedError(created.message);
        return;
      }
      // The row exists as a draft from here on regardless of what happens
      // next — always land on its edit page rather than leaving this `new`
      // form mounted, which would create a second row on another click.
      const submitted = await submitQuestionForReview(created.id);
      router.push(
        submitted.ok
          ? `/admin/questions/${created.id}`
          : `/admin/questions/${created.id}?submitError=1`,
      );
    });
  }

  function handleUpdateAndSubmit() {
    if (!id) return;
    setCombinedError(null);
    setCombinedNotice(null);
    startCombined(async () => {
      const savedResult = await updateQuestion(null, buildPayload("draft"));
      if (!savedResult.ok) {
        setCombinedError(savedResult.message);
        return;
      }
      const submitted = await submitQuestionForReview(id);
      if (submitted.ok) {
        setCombinedNotice("Submitted for review.");
        // Pulls fresh `reviewStatus`/`reviewNote` from the server — this
        // component reads those straight off `initial` rather than local
        // state, so the refreshed props are enough to flip the status line
        // and button set without a full remount.
        router.refresh();
      } else {
        setCombinedError(submitted.message);
      }
    });
  }

  const [archivePending, startArchive] = useTransition();
  const [archiveError, setArchiveError] = useState<ErrorLike | null>(null);

  function handleArchive() {
    if (!id) return;
    startArchive(async () => {
      const result = await archiveQuestion(id);
      if (result.ok) router.push("/admin/questions");
      else setArchiveError(result.message);
    });
  }

  async function handleDelete() {
    if (!id) return { ok: false as const, message: "Missing question id." };
    const result = await deleteQuestion(id);
    if (result.ok) {
      router.push("/admin/questions");
      return { ok: true as const };
    }
    return result;
  }

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line-2 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/questions"
            className="text-[13px] text-muted-3 hover:text-ink-4"
          >
            Questions
          </Link>
          <span className="text-[13px] text-faint-2">/</span>
          <span className="text-[14px] font-semibold text-ink">
            {mode === "edit" ? "Edit question" : "New question"}
          </span>
        </div>
        {/* Creating a question and putting it in a batch are separate jobs.
            The design combined them ("Add to Batch A"), which quietly makes
            every new question belong to whatever batch was active — batch
            membership is batch_questions, and it's composed on the Batches
            screen against the whole library. */}
        <div className="flex items-center gap-2.5">
          {mode === "edit" && initial && reviewStatus !== "approved" && (
            <span className="text-[12.5px] font-medium text-muted-3">
              {reviewStatus === "denied"
                ? "Denied"
                : reviewStatus === "draft"
                  ? "Draft — not submitted"
                  : "Pending review"}
            </span>
          )}
          {canCurate && mode === "edit" && id && isApproved && initial?.status !== "archived" && (
            <SubmitButton
              type="button"
              variant="ghost"
              pending={archivePending}
              onClick={handleArchive}
            >
              Archive
            </SubmitButton>
          )}
          {canCurate && mode === "edit" && id && isApproved && (
            <ConfirmDelete
              title="Delete this question?"
              description="Permanent, and only succeeds if nobody has answered it yet. An answered question is refused — archive it instead."
              onConfirm={handleDelete}
            />
          )}
          {mode === "edit" && id && !isApproved && (
            <ConfirmDelete
              triggerLabel={reviewStatus === "draft" ? "Delete draft" : "Withdraw proposal"}
              title={
                reviewStatus === "draft"
                  ? "Delete this draft?"
                  : "Withdraw this proposal?"
              }
              description="Permanent — once removed, you'd need to start over."
              onConfirm={handleDelete}
            />
          )}
          {mode === "edit" && isApproved ? (
            <>
              <SubmitButton
                type="button"
                variant="ghost"
                pending={pending}
                onClick={() => save("draft")}
              >
                Save draft
              </SubmitButton>
              <SubmitButton type="button" pending={pending} onClick={() => save("live")}>
                Save & publish
              </SubmitButton>
            </>
          ) : reviewStatus === "proposed" ? (
            <SubmitButton type="button" pending={pending} onClick={() => save("draft")}>
              Save (stays in review)
            </SubmitButton>
          ) : mode === "new" ? (
            <>
              <SubmitButton
                type="button"
                variant="ghost"
                pending={pending}
                onClick={() => save("draft")}
              >
                Save draft
              </SubmitButton>
              <SubmitButton
                type="button"
                pending={combinedPending}
                onClick={handleCreateAndSubmit}
              >
                Save & submit for review
              </SubmitButton>
            </>
          ) : (
            // mode === "edit", reviewStatus draft or denied — save-then-submit
            // chains rather than an implicit resubmit-on-save (2026-08-13).
            <>
              <SubmitButton
                type="button"
                variant="ghost"
                pending={pending}
                onClick={() => save("draft")}
              >
                {reviewStatus === "denied" ? "Save" : "Save draft"}
              </SubmitButton>
              <SubmitButton
                type="button"
                pending={combinedPending}
                onClick={handleUpdateAndSubmit}
              >
                {reviewStatus === "denied" ? "Resubmit for review" : "Submit for review"}
              </SubmitButton>
            </>
          )}
        </div>
      </header>

      {mode === "edit" && reviewStatus === "denied" && initial?.reviewNote && (
        <div className="mx-6 mt-4 flex flex-col gap-1.5 rounded-[10px] border border-violet-line-2 bg-violet-tint-2 px-4 py-3.5">
          <p className="text-[12.5px] font-semibold text-violet-ink">
            Denied by the roundtable:
          </p>
          <p className="text-[13px] leading-[1.55] text-violet-ink">
            {initial.reviewNote}
          </p>
        </div>
      )}

      {(saveError ||
        archiveError ||
        saved ||
        combinedError ||
        combinedNotice ||
        initialSubmitError) && (
        <div className="flex flex-col gap-2 px-6 pt-4">
          <ErrorNote error={saveError} />
          <ErrorNote error={archiveError} />
          <ErrorNote error={combinedError} />
          {initialSubmitError && (
            <ErrorNote
              error="Saved as a draft, but submitting it for review failed. Try again below."
              tone="warn"
            />
          )}
          {saved && <ErrorNote error="Saved." tone="neutral" />}
          {combinedNotice && <ErrorNote error={combinedNotice} tone="neutral" />}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-6 overflow-y-auto border-line-2 p-6 xl:border-r">
          <Field
            label="Template"
            hint="Switching resets the question — the three shapes don't convert into each other."
          >
            <Segmented
              value={template}
              onChange={changeTemplate}
              options={templateKeys.map((k) => ({
                value: k,
                label: registry[k].label,
              }))}
            />
          </Field>

          <TemplateForm
            template={template}
            content={content}
            answerKey={answerKey}
            principles={principles}
            prompt={prompt}
            onPrompt={setPrompt}
            onContent={setContent}
            onAnswerKey={setAnswerKey}
          />
        </div>

        <aside className="flex flex-col gap-6 overflow-y-auto bg-surface p-6">
          <Field
            label="Topics"
            hint="Why this question is worth asking. Reports group by bucket."
          >
            <div className="flex flex-wrap gap-2">
              {topics.map((t) => (
                <Chip
                  key={t.id}
                  active={topicIds.includes(t.id)}
                  onClick={() => toggleTopic(t.id)}
                >
                  {t.label}
                </Chip>
              ))}
              {topics.length === 0 && (
                <p className="text-[12.5px] text-muted-3">
                  No topics yet — create one on the Topics screen.
                </p>
              )}
            </div>
          </Field>

          <Field
            label="Principles exercised"
            hint="Derived from the question itself — the codes in play, or the calls a fellow made. Not editable here, so the two can't drift apart."
          >
            {codes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {codes.map((code) => (
                  <span
                    key={code}
                    className="rounded-md border border-violet-line bg-violet-tint-2 px-2.5 py-1 font-mono text-[12px] text-violet-ink"
                  >
                    {code}
                  </span>
                ))}
              </div>
            ) : (
              <p className="rounded-[9px] border border-dashed border-line-4 px-3.5 py-3 text-[12.5px] text-muted-3">
                None yet. Ranking questions never name a code; the other two
                pick them up as you fill the form in.
              </p>
            )}
          </Field>

          <p className="mt-auto border-t border-line-2 pt-4 text-[12px] leading-[1.55] text-muted-3">
            Questions land in the library. Put them into a batch from the
            Batches screen, where you can see the whole library at once.
          </p>
        </aside>
      </div>
    </>
  );
}
