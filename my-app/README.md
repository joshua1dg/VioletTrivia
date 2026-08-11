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
├── PLAN.md            the build plan — layer chain, decisions D1–D17, route map
├── my-app/            the Next.js app (THIS folder — Vercel Root Directory)
│   ├── app/
│   │   ├── templates/ the three question templates, live, at both sizes
│   │   ├── admin/     library · topics · principles · batches · sessions · reports
│   │   ├── b/[token]/ the async reviewer flow
│   │   ├── join/      room-number entry
│   │   ├── live/      the phone view
│   │   ├── present/   the shared screen
│   │   └── login/     staff sign-in
│   ├── components/    question/ · admin/ · feedback/ — presentational only
│   ├── lib/
│   │   ├── db/        the two Supabase clients
│   │   ├── repos/     one module per table-shaped concern
│   │   ├── services/  one folder per aggregate, server-only
│   │   ├── schemas/   zod for the action payloads
│   │   ├── templates/ one folder per template + the registry
│   │   ├── realtime/  the client lane — Realtime channel + room numbers
│   │   ├── auth/      requireStaff / requireAdmin
│   │   └── participant/ the anonymous-id bootstrap, both halves
│   └── scripts/       bootstrap-admin.ts
└── supabase/
    ├── migrations/    a single init migration, edited in place
    └── seed.sql       principles + placeholder topics
```

`AGENTS.md` in this folder is written by `next dev` and warns that Next 16
diverges from older conventions. It is accurate — read
`node_modules/next/dist/docs/` before assuming an App Router API.

---

## Running it

```bash
supabase start                       # from the repo root
cp my-app/.env.example my-app/.env.local
```

Fill `.env.local` from `supabase status`: `API_URL` → `NEXT_PUBLIC_SUPABASE_URL`,
`ANON_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SERVICE_ROLE_KEY` →
`SUPABASE_SECRET_KEY`. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the same
file, then:

```bash
pnpm --dir my-app bootstrap:admin    # creates the auth user + its staff row
pnpm --dir my-app dev
```

There is **no signup route**. Staff exist only because that script put them
there (`scripts/bootstrap-admin.ts` — idempotent, safe to re-run). Sign in at
`/login`; `/admin` redirects there when signed out.

`/` links to `/templates`, `/join` and `/admin`.

### Iterating on the schema

The migration is edited **in place** and replayed, rather than adding new
migrations:

```bash
supabase db reset
supabase gen types typescript --local > my-app/lib/db/database.types.ts
```

**`supabase db reset` wipes `auth.users`.** Re-run `pnpm bootstrap:admin` after
every reset or nothing can sign in. Responses and sessions go with it too;
that's the point of a reset, but it does mean re-seeding anything you were
mid-way through demoing.

Regenerate the types whenever a column changes. `database.types.ts` is what
makes a wrong column name a compile error instead of a runtime `null`.

---

## The layer chain

The spine of the app, and the thing a new reader most needs and cannot infer
from any one file. PLAN.md §5 is the long version.

```
  postgrest          supabase-js .from() query builder
      ↑
  lib/repos          ONE table-shaped concern each. No business logic.
      ↑
  lib/services       Business logic, decomposed into utils. Server-only.
      ↑
  ── boundary ──     Server Action  (the only crossing — no /api folder)
      ↑
  app/**/_ui         UI service: pending, error, optimistic. Client.
      ↑
  components         Presentational. Own no data.
```

1. **A layer only calls the one directly beneath it.** A component never
   imports a repo; a Server Action never imports `@supabase/*`.
2. **Repos are the only place PostgREST appears** — so swapping the client
   later is one folder, which is what this README has promised since the start.
3. **A repo is always wrapped in a service**, even when the service adds
   nothing. A passthrough is a one-line re-export, never a reimplementation.
4. **Services are `server-only`**, and so are repos and `lib/db/server.ts`.
   A `"use client"` file that imports one fails the build by name. That is the
   enforcement; "remember not to" is not.

`lib/schemas/**` and `lib/templates/**` deliberately carry **no** `server-only`,
because both sides validate against the same modules. `lib/realtime/**` is the
same: it is the client lane, and `room-number.ts` in particular is pure and
imported by four browser bundles.

Four exceptions exist, each commented at the site, each kept to one table and
one column list with no business logic:

- **`lib/auth`** reads `staff` through `serviceClient()` directly rather than
  through a repo — one auth-only lookup, contained inside the module that owns
  authorization.
- **`lib/repos/reports.ts`** and **`lib/repos/batches.ts`** each read one column
  off `live_sessions` (session ids for a batch; the open-session count behind
  D14's delete guard) rather than depending on the sessions repo.
- **`lib/repos/sessions.ts`** queries `responses` for live tallies — noted as an
  ownership exception in the file.
- **`lib/repos/_shared.ts`** imports `@supabase/supabase-js` **type-only**
  (`PostgrestSingleResponse`). It is the one `@supabase/` import outside
  `lib/db/`, and it compiles to nothing.

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
than a recursive prune. Structurally impossible to leak by forgetting. The
types make it structural too: `ReviewerQuestion` has no `answerKey` property at
all, so there is no field to forget to strip.

**`template` is an enum**, and it drives `TemplateKey` in TypeScript. Adding a
value stops the project compiling until the registry has a matching entry, which
can't be written without the schemas and components. Adding is one line;
**removing means recreating the type**, so treat the list as a ratchet.

**Async and live are derived, not stored.** A batch has no mode. Async is the
`/b/{token}` link plus `is_active_async`; live is a `live_sessions` row entered
by room number. A batch can serve both at once, and several hosts can run
sessions off the same batch simultaneously.

**One open session per host**, not per batch. An abandoned session blocks that
host from starting another, so there is a force-end control.

**`batch_status = 'inactive'` means read-only, not off.** Closing a batch must
not strand participants who were told they could review the answers afterwards.

**`responses.question_id` is `ON DELETE RESTRICT`.** Archive questions; never
delete answered ones. Deleting an unanswered draft still works.

**There is no `participant_count` column.** A row can't disappear when a tab
closes — `beforeunload` doesn't fire on a crash, a force-quit, or a dead
network. The live headcount comes from **Realtime Presence**.
`session_participants` is an append-only log for afterwards.

**`response_count` is incremented by a trigger.** PostgREST updates carry
literal values and there are no RPCs, so a read-modify-write in TypeScript would
lose the race. Same shape of problem as `updated_at`, same solution.

**RLS is enabled everywhere with almost no policies.** Everything goes through
the service role, so RLS is a fail-closed backstop, not a security boundary.
The one exception is an anon SELECT on `live_sessions`, which Realtime needs.

**No Drizzle (D13).** Considered and declined: it would mean hand-writing a
schema mirroring the migration plus a second connection path (Drizzle speaks
Postgres directly, not PostgREST), giving the repo layer two data-access
mechanisms. The cost is that multi-table saves are not transactional — a
question plus its topics plus its principles is three calls, and a mid-way
failure leaves a partial write. That is commented at each site. **Partial writes
actually biting is the trigger for revisiting this**, and nothing else.

---

## The template registry

The core architectural idea. `lib/templates/registry.ts` holds one object per
template:

```ts
{ key, label, blurb,
  Review, Reveal, Author,      // components
  empty(),                     // a blank question of this shape
  parse: { content, answerKey },// zod, on the STORED shape
  principleCodes(content),     // derived, never picked separately
  grade(answer, key) | null,   // 0 or 1, or null when ungradeable
  tally(answers, …)  | null }  // bars, or null when there's nothing to distribute
```

**Nothing else in the app branches on `template`.** The reviewer page looks up
`Review`, the editor looks up `Author`, the presenter and the reports screen
look up `tally`. Adding a fourth template is a folder plus one registry entry —
and because the enum drives `TemplateKey`, the project stops compiling until
that entry exists.

`parse` is the runtime guard on the two untyped jsonb columns, in both
directions: the authoring boundary on the way in, and the repo on the way out
(the generated types cannot describe jsonb, so this is the only thing standing
between a hand-edited row and a crash). The schemas themselves live in
`lib/templates/*/schema.ts` and the types are **inferred** from them, so there
is one definition rather than two.

**Stored is not always what the components see.** `which_principle` stores
`inPlayCodes: ["S1","C1"]` and the components receive
`inPlay: [{ code, name, descriptor }]` — names and descriptors come from the
`principles` table, so renaming S2 doesn't mean rewriting JSON blobs.
`lib/services/questions/hydrate.util.ts` is the boundary; the other two
templates are passthrough. `parse.content` validates the **stored** shape.

Two casts survive, both at the same boundary — a runtime `template` string
meeting the static per-template union. One is the switch in
`app/admin/questions/new/editor.tsx`; the other is the lookup table at the top
of `app/b/[token]/question-step.tsx`. Both are commented. That boundary can't be
erased, only kept to one line.

### The three templates

| key | answer | gradeable | tally |
|---|---|---|---|
| `which_principle` | pick a rubric code | yes, exact match | one group, one row per option |
| `rank_variants` | order N variants | yes, exact match | one group per position |
| `write_feedback` | **prose** | **no — `grade` is `null`** | **`null`** |

`write_feedback` has no key to compare against. Anything that scores must skip
it rather than count every response as wrong — reports exclude it and say so on
screen.

`rank_variants` grading is exact-match, which at four variants is 1-in-24 by
chance. That's the honest bar for calibration, but it will read as everyone
failing if it's ever presented as a score, so it isn't.

---

## What exists

Everything in the plan is built and wired to Postgres.

- **Admin CRUD** — questions (create, edit, archive, delete with a blast-radius
  confirm), topics, batches. Principles stay read-only by design (D15).
- **Auth** — `/login`, `requireStaff()` / `requireAdmin()` inside the services,
  staff bootstrapped by script.
- **The async flow** — `/b/{token}`, a deterministic per-participant draw, one
  step at a time, reveal after each answer, a complete screen, and read-only
  access after the batch is closed.
- **Live sessions** — `/join` by room number, the phone at `/live/{room}`, the
  shared screen at `/present/{id}`, host controls that advance / lock / reveal /
  end, Realtime Presence for the headcount.
- **Reports** — correct-rate per rubric code and per topic, plus the most-picked
  wrong answer (D5).
- The three templates on `/templates`, still, at both sizes.

## What does not exist

- **Automated tests.** D4: verification is browser-driven — screenshots, console
  checks, and the Supabase MCP for what landed in Postgres — plus `pnpm build`,
  `pnpm lint` and `tsc --noEmit` at integration. There is no Vitest and no
  Playwright, so a refactor has no safety net beyond the type checker.
- **Transactions on multi-table saves.** D13, above. Question + topics +
  principles is three sequential calls. Noted at the sites; the trigger for
  adding Drizzle is a partial write actually happening.
- **S3 and I3's text, and the real topic vocabulary.** Owed by Josh. S3 and I3
  are seeded `active = false` with empty names, and the authoring form offers
  active codes only — so a question cannot be authored against an undefined
  code. The four topics are placeholders, marked as such in `seed.sql` and in
  the Topics screen.

---

## Deploying (D8, D10)

**Vercel Root Directory must be `my-app`.** The repo root has no
`package.json`.

**Vercel's Deployment Protection returns 404, not 403**, for an unauthorised
session. A successful build that 404s everywhere is an access-control setting,
not a routing problem.

Environment variables in production: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` — the
dashboard's Publishable and Secret keys (`sb_publishable_…` /
`sb_secret_…`); the legacy anon / service_role JWTs fill the same slots. `ADMIN_EMAIL` /
`ADMIN_PASSWORD` are only for the bootstrap script and belong nowhere near a
deployment. Set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (`openssl rand -base64 32`)
so multiple instances agree on how to decrypt closed-over Server Action
arguments — without it, a build that scales past one instance fails
intermittently and confusingly.

**Deploying during a live session breaks every open phone.** Server Action IDs
are build-specific: a new deployment invalidates the ones the running tabs hold,
and the next submit fails with "Failed to find Server Action" until the page is
reloaded. **Deploy outside session windows.**

This is an **accepted trade (D10)**, not an oversight. Server Actions are the
only boundary in this app on purpose — one mechanism across admin, async and
live, with key safety coming from two separate functions rather than from the
transport. Do **not** "fix" this by adding route handlers or an `/api` folder;
that trades a scheduling constraint for a second, permanently maintained
boundary, and the constraint is one sentence in a runbook.

---

## Open decisions

- **`write_feedback` questions stay unlinked from principles (D9).**
  `principleCodes()` returns `[]` for it. The only consumer that wanted the link
  was reports, and reports exclude `write_feedback` because it has no gradeable
  answer — so linking it would put codes on the rubric axis that can never
  contribute a correct-rate. If "which codes does this batch *cover*" ever
  becomes a question distinct from "how well did people do on them," that is the
  moment to add an explicit field. Flagged for override.
- **`is_active_async` is a global singleton.** One active async batch at a time,
  app-wide. Fine for one pod; if two ever need to run their own async pools in
  parallel this needs scoping by owner — the same shape of problem
  one-open-session-per-host already solved on the live side.
- **S3 and I3 have no text, and the topics are invented placeholders.** Owed by
  Josh. Principles are supplied by editing `supabase/seed.sql` and re-running
  `supabase db reset` (they are deliberately not editable in the UI, D15);
  topics are admin-editable, so replacing those is a UI action.

---

## Traps that already cost time

**`"use client"` belongs at the boundary, not on leaf components.** Putting it
on a presentational component declares it an entry point, and Next then demands
every prop be serializable — which function handlers aren't. The directive
belongs on the files that use hooks, and nowhere else.

**Layout uses container queries, not viewport breakpoints.** `@container` on the
question shell and `@3xl:` on everything inside. This is why a 390px frame
renders its real mobile layout while sitting on a desktop screen. Using `md:`
would make the phone frame a lie.

**`supabase db reset` reports `502 upstream` and still succeeds.** The error
fires at `Restarting containers`, after the migration has applied. PostgREST
isn't restarted by a reset, so it briefly can't answer while the database is
recreated underneath it. Verify with a query, not the CLI's exit message.

**Vercel: Root Directory must be `my-app`,** and Deployment Protection 404s
rather than 403s. See Deploying, above.

**`next/font` variables are declared in `@layer base`** in `globals.css`.
Unlayered CSS beats layered CSS regardless of specificity, so the font's
injected class always wins and those declarations only act as a fallback. They
exist so the custom properties resolve statically.

**T2's rank number and letter mean different things.** The number lives with the
arrows and describes the slot — it stays put. The letter lives on the card and
is identity — it travels. The review list is keyed by **position**, not by id,
so no DOM node moves and `:hover` stays under the cursor.

**`error.tsx` gets both `retry` and `reset` in Next 16.** `retry()` re-fetches
and re-renders the segment; `reset()` only clears the boundary's own state. The
docs recommend `retry`, so `app/error.tsx` uses `retry ?? reset` — keep the
fallback, drop neither.

---

## Design sources

`Design.pdf` and `QuestionTemplateDesign.pdf` at the repo root, plus a Claude
Design project. Two cautions:

The design docs **contradict each other and themselves** in places — an older
version of T3 was pick-the-best-of-four, the current one is write-your-own. When
they disagree, ask rather than assume the newer file wins.

**The prose in the designs is filler.** Treat the structure as the spec and the
copy as placeholder.
