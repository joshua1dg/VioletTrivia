"use client";

import { useState } from "react";
import Link from "next/link";
import { Field, Segmented, TextArea, TextInput } from "@/components/admin/form";
import { TurnsEditor } from "@/components/admin/turns-editor";
import { Chip, GhostButton, PrimaryButton } from "@/components/admin/ui";
import { registry, templateKeys, type QuestionTemplate } from "@/lib/templates/registry";
import type { PrincipleOption, TemplateKey, Turn } from "@/lib/templates/types";
import type { Topic } from "@/lib/admin/fixtures";

/**
 * Holds the content and answer key for one template, correctly typed.
 *
 * Generic so `content` and `answerKey` are the template's own shapes rather
 * than a union — that's what lets the Author form be strict about what it
 * edits. Mounted with key={template} above, so switching template resets to
 * a blank question of the new shape instead of carrying incompatible data.
 */
function TemplateSection<C extends { turns: Turn[] }, K>({
  def,
  principles,
  prompt,
  onPrompt,
  onPrincipleCodes,
}: {
  def: QuestionTemplate<C, K>;
  principles: PrincipleOption[];
  prompt: string;
  onPrompt: (next: string) => void;
  onPrincipleCodes: (codes: string[]) => void;
}) {
  const [{ content, answerKey }, setState] = useState(() => def.empty());

  // Every content change re-derives the principle links, so the rail always
  // shows what would actually be saved. Done here rather than in an effect —
  // it's the same event, not a reaction to one.
  const setContent = (next: C) => {
    setState((s) => ({ ...s, content: next }));
    onPrincipleCodes(def.principleCodes(next));
  };

  // The constraint lets the shared turns editor read content.turns for any
  // template. Writing needs one cast: TypeScript can't see that spreading a
  // generic C and replacing a known key still produces a C.
  const setTurns = (turns: Turn[]) =>
    setContent({ ...content, turns } as C);

  return (
    <div className="flex flex-col gap-6">
      <TurnsEditor turns={content.turns} onChange={setTurns} />

      <Field
        label="Prompt shown to reviewers"
        hint="The question itself. Stored as a column, not inside the template payload."
      >
        <TextInput
          value={prompt}
          onChange={onPrompt}
          placeholder={def.blurb}
        />
      </Field>

      <def.Author
        content={content}
        answerKey={answerKey}
        principles={principles}
        onContent={setContent}
        onAnswerKey={(next) => setState((s) => ({ ...s, answerKey: next }))}
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
  principles,
  prompt,
  onPrompt,
  onPrincipleCodes,
}: {
  template: TemplateKey;
  principles: PrincipleOption[];
  prompt: string;
  onPrompt: (next: string) => void;
  onPrincipleCodes: (codes: string[]) => void;
}) {
  const shared = { principles, prompt, onPrompt, onPrincipleCodes };
  switch (template) {
    case "which_principle":
      return <TemplateSection def={registry.which_principle} {...shared} />;
    case "rank_variants":
      return <TemplateSection def={registry.rank_variants} {...shared} />;
    case "write_feedback":
      return <TemplateSection def={registry.write_feedback} {...shared} />;
  }
}

export function QuestionEditor({
  topics,
  principles,
}: {
  topics: Topic[];
  principles: PrincipleOption[];
}) {
  const [template, setTemplate] = useState<TemplateKey>("which_principle");
  const [prompt, setPrompt] = useState("");
  const [topicSlugs, setTopicSlugs] = useState<string[]>([]);
  const [codes, setCodes] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

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
          <span className="text-[14px] font-semibold text-ink">New question</span>
        </div>
        {/* Creating a question and putting it in a batch are separate jobs.
            The design combined them ("Add to Batch A"), which quietly makes
            every new question belong to whatever batch was active — batch
            membership is batch_questions, and it's composed on the Batches
            screen against the whole library. */}
        <div className="flex items-center gap-2.5">
          <GhostButton>Save draft</GhostButton>
          <PrimaryButton>Add question</PrimaryButton>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-6 overflow-y-auto border-line-2 p-6 xl:border-r">
          <Field
            label="Template"
            hint="Switching resets the question — the three shapes don't convert into each other."
          >
            <Segmented
              value={template}
              onChange={setTemplate}
              options={templateKeys.map((k) => ({
                value: k,
                label: registry[k].label,
              }))}
            />
          </Field>

          <TemplateForm
            key={template}
            template={template}
            principles={principles}
            prompt={prompt}
            onPrompt={setPrompt}
            onPrincipleCodes={setCodes}
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
                  key={t.slug}
                  active={topicSlugs.includes(t.slug)}
                  onClick={() => setTopicSlugs(toggle(topicSlugs, t.slug))}
                >
                  {t.label}
                </Chip>
              ))}
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

          <Field
            label="Discussion note"
            hint="Shown at the reveal, for whoever is running the room."
          >
            <TextArea
              rows={3}
              value={note}
              onChange={setNote}
              placeholder="Watch for whether people separate the tone from the unverified claim."
            />
          </Field>

          <p className="mt-auto border-t border-line-2 pt-4 text-[12px] leading-[1.55] text-muted-3">
            Questions land in the library. Put them into a batch from the
            Batches screen, where you can see the whole library at once.
          </p>
          <p className="text-[12px] leading-[1.55] text-muted-3">
            Nothing saves yet — this writes to component state, not Postgres.
            The shapes it produces are the ones <span className="font-mono">content</span> and{" "}
            <span className="font-mono">answer_key</span> expect, so wiring it
            up is a repository call rather than a rewrite.
          </p>
        </aside>
      </div>
    </>
  );
}
