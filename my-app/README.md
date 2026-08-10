# Project Violet — Alignment Trivia

An internal calibration tool. Reviewers read excerpts of agent conversations and
judge how the model **communicates** — not whether the code was right. Three
question shapes, run either asynchronously by link or live in a room with a host
controlling the reveal.

This README is a handoff document. It covers what exists, what doesn't, the
decisions behind the shape of things, and the traps that already cost time once.

---

## Repo layout

```
code-trivia/
├── my-app/            the Next.js app (THIS folder — Vercel Root Directory)
│   ├── app/
│   │   ├── templates/ the three question templates, live, at both sizes
│   │   └── admin/     library · topics · principles · question editor
│   ├── components/
│   │   ├── question/  shell, excerpt, rich-text, why-note
│   │   └── admin/     sidebar, form primitives, turns editor
│   └── lib/
│       ├── templates/ one folder per template + the registry
│       └── admin/     fixtures
└── supabase/
    └── migrations/    a single init migration, edited in place
```

`AGENTS.md` in this folder is written by `next dev` and warns that Next 16
diverges from older conventions. It is accurate — read
`node_modules/next/dist/docs/` before assuming an App Router API.

---

## Running it

```bash
supabase start          # from the repo root
pnpm --dir my-app dev
```

`/` links to `/templates` and `/admin`.

There are **no environment variables yet**, because nothing touches Supabase.
Every screen reads fixtures.

### Iterating on the schema

The migration is edited **in place** and replayed, rather than adding new
migrations. Nothing depends on it yet, so this is cheaper than a chain of
patches:

```bash
supabase db reset
```

---

## The domain

**Question** — an excerpt plus a prompt plus an answer key. Belongs to a
template, which decides the shape of everything inside it.

**Topic** — why a question is worth asking (a common confusion, an edge case).
**Not** the failure mode; that's the principles axis. Many-to-many.

**Principle** — a rubric code (S1, C1, I1…). **Fixed and seeded directly into
the database — not user-editable.** The admin screen is read-only reference.
Questions link to codes via `question_principles`.

**Batch** — a bundle of questions. Async participants draw a random
`async_sample_size` from it; live sessions run the whole thing in order.

**Participant** — anonymous. A uuid the browser generates about itself. No
accounts, no PII, arrives by link.

**Live session** — one row that acts as a remote control. The host updates
`phase` and `current_question_id`; Realtime pushes the row to every phone and
the presenter screen.

---

## Schema decisions worth not re-litigating

Full reasoning is in the migration's comments. The short version:

**`content` and `answer_key` are separate jsonb columns.** Not one blob — so
"don't send the answer to the reviewer" is a column list on the select rather
than a recursive prune. Structurally impossible to leak by forgetting.

**`template` is an enum**, and it drives `TemplateKey` in TypeScript. Adding a
value stops the project compiling until the registry has a matching entry, which
can't be written without the schemas and components. Adding is one line;
**removing means recreating the type**, so treat the list as a ratchet.

**Async and live are derived, not stored.** A batch has no mode. Async is the
`/b/{token}` link plus `is_active_async`; live is a `live_sessions` row entered
by room number. A batch can serve both at once, and several hosts can run
sessions off the same batch simultaneously.

**One open session per host**, not per batch. An abandoned session blocks that
host from starting another, so a force-end control is needed.

**`batch_status = 'inactive'` means read-only, not off.** Closing a batch must
not strand participants who were told they could review the answers afterwards.

**`responses.question_id` is `ON DELETE RESTRICT`.** Archive questions; never
delete answered ones. Deleting an unanswered draft still works.

**There is no `participant_count` column.** A row can't disappear when a tab
closes — `beforeunload` doesn't fire on a crash, a force-quit, or a dead
network. The live headcount comes from **Realtime Presence**.
`session_participants` is an append-only log for afterwards.

**RLS is enabled everywhere with almost no policies.** Everything goes through
the service role, so RLS is a fail-closed backstop, not a security boundary.
The one exception is an anon SELECT on `live_sessions`, which Realtime needs.

**No Drizzle yet.** `supabase-js` is required regardless for Realtime and Auth.
Drizzle earns its place when multi-statement writes need real transactions —
saving a question plus its topics plus its principles, or ending one session and
starting another. Until then, put data access behind a repository layer so
swapping the client later is one folder.

---

## The template registry

The core architectural idea. `lib/templates/registry.ts` holds one object per
template:

```ts
{ key, label, blurb,
  Review, Reveal, Author,      // components
  empty(),                     // a blank question of this shape
  principleCodes(content),     // derived, never picked separately
  grade(answer, key) | null }  // 0 or 1, or null when ungradeable
```

**Nothing else in the app branches on `template`.** The reviewer page looks up
`Review`, the editor looks up `Author`, a results page will look up `tally`.
Adding a fourth template is a folder plus one registry entry.

One switch statement survives, in `app/admin/questions/new/editor.tsx`. That's
the boundary where a runtime string becomes a static type, and it can't be
erased without casts. It happens once.

### The three templates

| key | answer | gradeable |
|---|---|---|
| `which_principle` | pick a rubric code | yes, exact match |
| `rank_variants` | order N variants | yes, exact match |
| `write_feedback` | **prose** | **no — `grade` is `null`** |

`write_feedback` has no key to compare against. Anything that scores must skip
it rather than count every response as wrong.

`rank_variants` grading is exact-match, which at four variants is 1-in-24 by
chance. That's the honest bar for calibration, but it will read as everyone
failing if it's ever presented as a score.

---

## What exists

- Three templates, reviewer and reveal views, at both sizes, on `/templates`
- The registry, with schemas, components, `empty`, `principleCodes`, `grade`
- Admin shell and nav
- Question library with working topic/type/search filters
- Topics and Principles screens (Principles is read-only)
- Question editor at `/admin/questions/new` — per-template form plus the
  answer-key section

## What does not exist

- **Any persistence at all.** No Supabase client, no repositories, no zod. Every
  screen reads fixtures. This is the biggest gap between what clicks and what
  works.
- **The reviewer flow.** No `/b/{token}`, no room join, no sequence across
  items, no batch-complete screen. `/templates` renders one question in
  isolation.
- Batches screen, live session host controls, presenter display, auth, reports.

## Open decisions

- **Topics are invented placeholders.** The real vocabulary hasn't been supplied.
- **S3 and I3 have no text.** Nothing in the design defines them, and a
  `which_principle` question can't be authored against an empty code.
- **`which_principle` `subtext`** — the per-option hint. The input was removed
  from the form, so nothing writes it. Either drop the field or source it from
  the principle's descriptor.
- **Whether `write_feedback` questions link to principles.** Its rationale names
  codes in prose only, so `principleCodes` returns `[]`. Linking them needs an
  explicit field.
- **Reports** — deferred and unmodelled.

---

## Traps that already cost time

**`"use client"` belongs at the boundary, not on leaf components.** Putting it
on a presentational component declares it an entry point, and Next then demands
every prop be serializable — which function handlers aren't. Only four files
have the directive, and they're exactly the four that use hooks. Keep it that
way.

**Layout uses container queries, not viewport breakpoints.** `@container` on the
question shell and `@3xl:` on everything inside. This is why a 390px frame
renders its real mobile layout while sitting on a desktop screen. Using `md:`
would make the phone frame a lie.

**`supabase db reset` reports `502 upstream` and still succeeds.** The error
fires at `Restarting containers`, after the migration has applied. PostgREST
isn't restarted by a reset, so it briefly can't answer while the database is
recreated underneath it. Verify with a query, not the CLI's exit message.

**Vercel: Root Directory must be `my-app`.** The repo root has no
`package.json`. Also, Vercel's Deployment Protection returns **404, not 403**,
for an unauthorised session — a successful build that 404s everywhere is an
access-control setting, not a routing problem.

**`next/font` variables are declared in `@layer base`** in `globals.css`.
Unlayered CSS beats layered CSS regardless of specificity, so the font's
injected class always wins and those declarations only act as a fallback. They
exist so the custom properties resolve statically.

**T2's rank number and letter mean different things.** The number lives with the
arrows and describes the slot — it stays put. The letter lives on the card and
is identity — it travels. The review list is keyed by **position**, not by id,
so no DOM node moves and `:hover` stays under the cursor.

---

## Design sources

`Design.pdf` and `QuestionTemplateDesign.pdf` at the repo root, plus a Claude
Design project. Two cautions:

The design docs **contradict each other and themselves** in places — an older
version of T3 was pick-the-best-of-four, the current one is write-your-own. When
they disagree, ask rather than assume the newer file wins.

**The prose in the designs is filler.** Treat the structure as the spec and the
copy as placeholder.
