-- =====================================================================
-- Alignment Trivia — initial schema
--
-- Architecture: server-side-first. All reads and writes go through Next.js
-- route handlers using the service role key. There are no RPCs — the logic
-- that used to live in SQL functions lives in the TS service layer, where
-- it can change without a migration.
--
-- The ONE client-side exception is an anon SELECT on live_sessions, which
-- Realtime needs to drive live mode. There is no server-only Realtime.
--
-- WHAT POSTGRES STILL ENFORCES (everything else moved to TS + zod):
--   * the unique index on responses — the only reliable one-vote-per-
--     participant guarantee under concurrency; app code loses that race
--   * foreign keys and check constraints
--   * RLS enabled with no policies = deny all, so a table anyone forgets
--     fails closed instead of leaking
--   * the realtime publication on live_sessions
--
-- Note that with the service role in front of everything, RLS is a
-- backstop, not a security boundary. Do not design as though it protects
-- something.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

-- Template determines the shape of questions.content, questions.answer_key,
-- and responses.answer. Those shapes are enforced by zod at the authoring
-- boundary, NOT by Postgres — the columns are jsonb and Drizzle's .$type<>()
-- is a compile-time cast that performs no runtime check.
--
--   which_principle  T1 · two rubric codes in play; pick which one the
--                         excerpt should be judged under
--   rank_variants    T2 · four completions of the same answer; drag to rank
--   best_feedback    T3 · a fellow's rationale and its rubric calls; pick
--                         which of four responses helps them most
--
-- Adding a fourth is `alter type template_type add value '…'`, which does
-- not rewrite the table. Removing one is not symmetrical — dropping a value
-- means recreating the type and re-pointing the column — so this list is a
-- ratchet.
--
-- The enum is also the trigger for the code side. TemplateKey is derived
-- from it and the registry is Record<TemplateKey, QuestionTemplate>, so
-- adding a value here stops the project compiling until that template has
-- its zod schemas, its three components, and its grade/tally functions.
create type template_type as enum (
  'which_principle',
  'rank_variants',
  'best_feedback'
);

create type question_status as enum ('draft', 'live', 'archived');

-- draft    — link resolves to nothing
-- active   — link works: answer questions, and read the reveal for any you
--            have already answered
-- inactive — link still opens, READ ONLY. You can re-read your answers and
--            their reveals; you cannot submit. Replaces the old
--            'scheduled'/'closed' pair and absorbs the old link_active
--            boolean. Closing a batch must not strand people who were
--            promised they could look at the answers afterwards.
create type batch_status as enum ('draft', 'active', 'inactive');

-- Live session state machine. Every phone + the presenter display
-- subscribe to this column via Realtime.
create type session_phase as enum ('lobby', 'voting', 'locked', 'revealed', 'ended');

-- ---------------------------------------------------------------------
-- Staff
--
-- auth.users has no is_admin column. It has is_super_admin, which belongs
-- to GoTrue's own admin API, and role, which is the Postgres role in the
-- JWT ('authenticated'). Neither is an application role, so this table is.
--
-- Not app_metadata claims either: their advantage is being readable from
-- inside the JWT by an RLS policy, and there are no RLS policies here.
-- What is left is the downside — writes go through the admin API and do
-- not take effect until the token refreshes, and you cannot join on it to
-- populate a "pick a host" list.
--
-- Bootstrap after first signup:
--   insert into staff (user_id, role) values ('<your-auth-uid>', 'admin');
-- ---------------------------------------------------------------------

-- admin ⊃ host. Admins author questions, manage batches and the rubric,
-- and read reports; both roles can run a live session. A pod lead who
-- should run rooms without editing the question library is a 'host'.
create type staff_role as enum ('admin', 'host');

create table staff (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role         staff_role not null default 'host',
  email        text,
  display_name text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Reference tables
--
-- These two stay normalized on purpose. They are the things that actually
-- get queried across questions — reports group by topic, and the rubric
-- vocabulary is edited on its own screen. Renaming S2 should not mean
-- rewriting JSON blobs.
-- ---------------------------------------------------------------------

create table principles (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,   -- 'S1', 'C1'
  name             text not null,
  short_descriptor text,
  full_description text,
  sort_order       int  not null default 0,
  active           boolean not null default true
);

create table topics (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  label      text not null,
  sort_order int  not null default 0
);

-- ---------------------------------------------------------------------
-- Questions
--
-- content and answer_key are separate columns rather than one blob so that
-- "don't send the answer to the client" is a column list on the select,
-- not a recursive prune of a nested object. Structurally impossible to
-- leak by forgetting.
--
-- WHO MAY READ answer_key — enforced in the service layer, since everything
-- goes through the service role:
--
--   async  a participant may read it for a question they have already
--          answered. Immediately on submit, and again any time afterwards,
--          including once the batch is 'inactive'.
--   live   nobody on a phone, ever. The host advances the room to phase
--          'revealed' and it renders on the presenter screen, which is the
--          host's own authenticated browser. Phones show "Results are on
--          the shared screen".
--   staff  always.
--
-- The live rule is why phones never need this column at all: it reaches
-- exactly one authenticated client per room, server-rendered.
--
-- CONTENT SHAPES (zod is the real definition; these are the sketch):
--
--   which_principle
--     { turns: [{ role, body, meta? }],            -- meta: '1 sentence · turn 3'
--       in_play: ['S1','C1'],                      -- codes listed above the excerpt
--       options: [{ id:'S1', principle_code:'S1', subtext }] }
--     Names and descriptors come from the principles table — the author
--     references codes rather than retyping them. subtext is the one-line
--     hint under each option, which IS question-specific.
--
--   rank_variants
--     { turns: [{ role:'user', body }], shuffle: true,
--       options: [{ id:'a', body, note }] }        -- note: what the variant does structurally
--
--   best_feedback
--     { turns: [{ role, body }],                   -- body may be markdown; T3 assistant turns have bullets
--       subject: { rationale, calls: [{ code:'S1', verdict:'wrong' }] },
--       options: [{ id:'a', body }] }              -- four candidate responses
--
-- ANSWER KEY SHAPES — every question has one:
--
--   which_principle / best_feedback  (pick one)
--     { key: 'S1', rationale: '…',
--       per_option: { S1: '…', C1: 'not the issue here: …' },
--       bullets?: [{ label, detail }],             -- T3 'what makes it strong'
--       summary?: '…', discussion_note?: '…' }
--
--   rank_variants
--     { key_order: ['b','c','a','d'], rationale: 'why the top one wins…',
--       per_option: { b: '…' } }
--
-- grade(answer, answer_key) returns 0 or 1 — exact match, including for
-- rank_variants. tally(answers, content) returns groups of bars: one group
-- for the pick-one templates, one group per position for rank_variants.
-- Both live in the registry, both computed at read time, neither stored.
--
-- option ids must be stable and never reused. responses.answer stores the
-- id as a string — there is no FK to catch it if you recycle one.
-- ---------------------------------------------------------------------

create table questions (
  id         uuid primary key default gen_random_uuid(),
  template   template_type not null,
  prompt     text not null,          -- the ask, universal across templates
  content    jsonb not null,         -- everything the reviewer sees
  answer_key jsonb not null,         -- the key and its explanation. Never select this for a reviewer.
  status     question_status not null default 'draft',
  author_id  uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint questions_content_is_object    check (jsonb_typeof(content)    = 'object'),
  constraint questions_answer_key_is_object check (jsonb_typeof(answer_key) = 'object')
);

create index questions_status_idx on questions(status);

-- No search index. The admin library's "Search excerpts" box is an ILIKE
-- over content::text — fine at a few hundred questions, and worth an index
-- only if that stops being true.

-- The admin library sorts by updated. Kept as a trigger rather than a
-- server responsibility because it is the one thing that is always correct
-- to do and easy to forget on a write path.
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger questions_touch_updated_at
  before update on questions
  for each row execute function touch_updated_at();

-- Many-to-many: the New Question screen multi-selects topic chips, and
-- reports group by bucket.
create table question_topics (
  question_id uuid not null references questions(id) on delete cascade,
  topic_id    uuid not null references topics(id) on delete cascade,
  primary key (question_id, topic_id)
);

create index question_topics_topic_idx on question_topics(topic_id);

-- Which rubric codes a question exercises. Many-to-many, and NOT limited to
-- the which_principle template: an aligned_misaligned question about a
-- sycophantic opener is an S2 question, and reveal rationales name codes on
-- every template. Topic is the failure-mode bucket, principle is the rubric
-- code; reports will want to group by either.
--
-- This is the queryable relation — "show me every question touching S1",
-- usage counts on the principles screen, warning before deactivating a code
-- that is in use. content still carries the per-question presentation (which
-- principles are listed above the excerpt, what subtext each option shows),
-- referencing principles by id. Both are written by the same service call
-- when a question is saved; nothing in the database keeps them in step.
create table question_principles (
  question_id  uuid not null references questions(id) on delete cascade,
  principle_id uuid not null references principles(id) on delete cascade,
  primary key (question_id, principle_id)
);

create index question_principles_principle_idx on question_principles(principle_id);

-- ---------------------------------------------------------------------
-- Batches
--
-- A batch is a list of questions. It has no mode, because async and live
-- are not two states of a batch — they are two entry points, and a batch
-- can be serving both at once.
--
--   ASYNC  /b/{token}   status 'active', not expired -> answer + reveal
--                       status 'inactive' or expired -> read only
--                       status 'draft'               -> nothing
--   LIVE   room number  -> join that live_sessions row
--
-- expires_at is just an automatic way to reach 'inactive'; an expired link
-- goes read-only rather than dead, same as closing it by hand.
--
-- Live never resolves through the batch token. Several hosts can run their
-- own session off the same batch simultaneously (ten pod leads, ten rooms,
-- one question list) and nothing is ambiguous, because participants arrive
-- by room number.
--
-- OPEN QUESTION: is_active_async is a global singleton — exactly one batch
-- is the async pool for everyone. If pods eventually want their own async
-- batch running in parallel, this has the same shape of problem that
-- one-session-per-batch had, and wants scoping by owner.
-- ---------------------------------------------------------------------

create table batches (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,

  -- Free text, not an enum: 'reviewers', 'taskers', 'pod leads', whatever
  -- comes next. Nothing branches on it — it is a label for filtering and
  -- report headers, so it should not cost a migration to extend.
  audience          text,

  status            batch_status not null default 'draft',

  -- Only the TOKEN is stored; the URL is assembled at display time as
  -- {APP_URL}/b/{token}. Never persist a full URL — the domain and path
  -- belong to the app, not the batch.
  -- Use >= 10 URL-safe chars; this token is the only thing gating access.
  token             text not null unique,
  expires_at        timestamptz,

  -- How many questions an async participant draws from the batch.
  -- NULL = no sampling, everyone answers all of them.
  async_sample_size int,

  -- The pool new async participants draw from. At most one at a time,
  -- enforced by the partial index below.
  is_active_async   boolean not null default false,

  owner_id          uuid references auth.users(id) on delete set null,
  scheduled_for     timestamptz,
  created_at        timestamptz not null default now(),

  constraint batches_sample_size_positive
    check (async_sample_size is null or async_sample_size > 0)
);

create unique index batches_one_active_async
  on batches(is_active_async) where is_active_async;

create table batch_questions (
  batch_id    uuid not null references batches(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  position    int  not null,
  primary key (batch_id, question_id)
);

-- ---------------------------------------------------------------------
-- Participation  (anonymous by construction)
-- ---------------------------------------------------------------------

-- A participant is a uuid the BROWSER generated about itself via
-- crypto.randomUUID(), kept in localStorage. No PII. Not assigned by the
-- server, not derivable back to a person — there is nothing to derive to.
--
-- There is deliberately no assignment table. The async subset is DERIVED
-- in the service layer from a stable hash of (participant, batch,
-- question), so a refresh or a return visit deals the identical set.
--
-- CAVEAT that survives the move to TS: the draw depends on the batch's
-- question list. Adding or removing questions from an active async batch
-- reshuffles everyone's draw. Compose the batch, then open it.
create table participants (
  id           uuid primary key,      -- client-generated
  entry_batch  uuid references batches(id) on delete set null,
  display_name text,                  -- optional, live sessions only
  created_at   timestamptz not null default now()
);

-- The live "remote control". The server updates phase + current_question_id;
-- Postgres pushes the row to every subscribed phone and the display.
create table live_sessions (
  id                  uuid primary key default gen_random_uuid(),
  batch_id            uuid not null references batches(id) on delete cascade,
  -- Sequential, so it never collides and never needs recycling. Stored as
  -- the bare number; the app renders it as 'VLT-0042'. The prefix is a
  -- display choice, same as the batch token's URL — changing it later
  -- should be a string change, not a backfill.
  room_number         int unique generated by default as identity,
  current_question_id uuid references questions(id) on delete set null,
  current_position    int,
  phase               session_phase not null default 'lobby',
  -- References staff, not auth.users: this one is an AUTHORIZATION link,
  -- and the DB already constrains it (one open session per host), so the
  -- FK may as well enforce that a host is staff. Contrast questions.author_id
  -- and batches.owner_id, which point at auth.users because they are
  -- attribution and should survive someone being removed from staff.
  host_id             uuid references staff(user_id) on delete set null,

  -- How many have answered the CURRENT question. Server-maintained (it is
  -- the only writer) and reset to 0 when the host advances.
  --
  -- There is deliberately no participant_count. "How many are in the room"
  -- has to DROP when someone closes a tab, and no table can know that — a
  -- row only disappears if something tells it to, and beforeunload does not
  -- fire on a crash, a force-quit, a dead network, or a backgrounded phone.
  -- That number comes from Realtime Presence on the session channel, which
  -- drops a client when its socket does. See session_participants below for
  -- what the table is still good for.
  response_count      int not null default 0,

  started_at          timestamptz,
  ended_at            timestamptz,

  -- An open session must have a host, so live_sessions_one_open_per_host
  -- cannot be dodged by leaving host_id null. Ended sessions may go
  -- hostless when an admin account is deleted.
  constraint live_sessions_open_needs_host
    check (phase = 'ended' or host_id is not null)
);

-- One open session per HOST, not per batch. Ten admins can run ten rooms
-- at the same time, including off the same batch; what a host cannot do is
-- run two at once, since they only have one pair of hands and one screen.
--
-- host_id is nullable (an admin can be deleted without taking their session
-- history with them), so the check constraint on the table is what stops an
-- open session from slipping past this index with a null host.
create unique index live_sessions_one_open_per_host
  on live_sessions(host_id) where phase <> 'ended';

-- Who PASSED THROUGH the room — an append-only log, not a live roster.
-- The live headcount comes from Realtime Presence, which is the only thing
-- that can decrement when a tab closes. This table answers the question
-- presence cannot, because presence is ephemeral: after the session ends,
-- how many distinct people were ever in it.
--
-- So "17 of 17 in" during the session reads its denominator from presence
-- and its numerator from response_count. This table is for afterwards.
create table session_participants (
  live_session_id uuid not null references live_sessions(id) on delete cascade,
  participant_id  uuid not null references participants(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  primary key (live_session_id, participant_id)
);

-- ---------------------------------------------------------------------
-- Responses
--
-- One polymorphic answer column, matching the polymorphic content column.
-- The old design kept selected_option_id as a real FK, but options now
-- live inside content JSON and have no rows to point at, so the FK is gone
-- either way. Accepted cost: nothing stops an answer referencing an option
-- id that was edited out of the question.
--
-- ANSWER SHAPES:
--   single-select   { option: 'misaligned' }
--   rank_variants   { order: ['b','c','a','d'] }
--   write_feedback  { option: 'weak', feedback: '…' }
--
-- rationale is the optional "Why?" note offered on every template, kept
-- out of answer because it is universal and gets read in bulk at reveal.
-- ---------------------------------------------------------------------

create table responses (
  id              uuid primary key default gen_random_uuid(),
  -- RESTRICT, not cascade: archive questions, never delete answered ones.
  -- This makes that a rule Postgres enforces rather than a habit. Deleting
  -- an unanswered draft still works, since restrict only bites when rows
  -- exist.
  question_id     uuid not null references questions(id) on delete restrict,
  participant_id  uuid not null references participants(id) on delete cascade,
  batch_id        uuid references batches(id) on delete set null,        -- async context
  live_session_id uuid references live_sessions(id) on delete set null,  -- live context
  answer          jsonb not null,
  rationale       text,
  created_at      timestamptz not null default now(),

  constraint responses_answer_is_object check (jsonb_typeof(answer) = 'object')
);

-- THE constraint the service layer cannot replace. One vote per
-- participant per question per context (async vs a given live session).
-- Deliberately not scoped by batch_id: if a question appears in two async
-- batches, a participant still answers it once, so tallies stay clean.
create unique index responses_dedupe on responses (
  question_id,
  participant_id,
  coalesce(live_session_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

create index responses_question_idx on responses(question_id);
create index responses_batch_idx    on responses(batch_id);
create index responses_session_idx  on responses(live_session_id);

-- Tallies are group-by on answer->>'option' now that there is no FK.
create index responses_answer_idx on responses using gin (answer);

-- ---------------------------------------------------------------------
-- Row Level Security
--
-- Enabled everywhere with no policies: deny all. The service role bypasses
-- it, which is the entire access path. A table added later without a
-- policy fails closed rather than leaking.
-- ---------------------------------------------------------------------

alter table staff                enable row level security;
alter table principles           enable row level security;
alter table topics               enable row level security;
alter table questions            enable row level security;
alter table question_topics      enable row level security;
alter table question_principles  enable row level security;
alter table batches              enable row level security;
alter table batch_questions      enable row level security;
alter table participants         enable row level security;
alter table live_sessions        enable row level security;
alter table session_participants enable row level security;
alter table responses            enable row level security;

-- THE ONE ANON EXCEPTION.
-- Live mode requires a browser websocket subscription and there is no
-- server-side-only Realtime. live_sessions holds nothing sensitive — a
-- room code, a phase, a question id, two counts — so exposing exactly this
-- one table keeps the client surface at near zero. In particular it does
-- NOT expose questions.answer_key, which never leaves the server except as
-- fields the server chose to send.
create policy anon_read_live_sessions
  on live_sessions for select to anon
  using (true);

alter publication supabase_realtime add table live_sessions;