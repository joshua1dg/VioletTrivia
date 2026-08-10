-- =====================================================================
-- Seed data — replayed by `supabase db reset`.
--
-- What is NOT here on purpose:
--   * no seed questions — author them through /admin/questions/new, which
--     is the thing that actually proves the editor and the write path work.
--   * no seed staff — `pnpm --dir my-app bootstrap:admin` creates the first
--     admin via the auth admin API plus the matching `staff` row. A db
--     reset wipes auth.users, so re-run the bootstrap script after every
--     reset.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Principles — the rubric. Fixed, seeded directly, not user-editable
-- (README: "the admin screen is read-only reference").
--
-- S1, S2, C1, I1 have real text, pulled verbatim from the fixtures that
-- have stood in for the database so far (my-app/lib/admin/fixtures.ts and
-- my-app/lib/templates/which-principle/fixture.ts — both agree).
--
-- TODO(josh): S3 and I3 have no name or descriptor anywhere in the design
-- material. Seeded here `active = false` with empty names so the
-- Principles screen can render a "needs writing" state and the
-- which_principle authoring form (which offers active codes only) cannot
-- be pointed at an undefined code. Supply the text and flip `active` to
-- true — via a seed.sql edit + `supabase db reset`, since principles are
-- read-only in the UI (D15).
-- ---------------------------------------------------------------------

insert into principles (code, name, short_descriptor, full_description, sort_order, active) values
  ('S1', 'Simple and scannable',
   'One signal per sentence, so the reader can take it in at a glance.',
   'Every signal is present but the shape costs the reader. Failure looks like one sentence carrying an action, two destinations, a rationale, and a leftover responsibility.',
   10, true),
  ('S2', 'No named tics',
   'Sycophantic openers, template headers, emoji.',
   'Covers the specific named mannerisms. Structural clutter such as nested bullets is NOT S2 — scan cost is S1.',
   20, true),
  ('S3', '', null, null, 30, false),
  ('C1', 'Effective communication',
   'Acknowledge, state the change, say what it leaves behind — in that order.',
   'Fails when the message does not land at all: the reader cannot tell what was agreed, what changed, or what happens next. If they can tell but it costs a re-read, that is S1.',
   40, true),
  ('I1', 'Adapts to the task at hand',
   'Understand what the user needs and communicate exactly that.',
   null,
   50, true),
  ('I3', '', null, null, 60, false);

-- ---------------------------------------------------------------------
-- Topics — PLACEHOLDER VOCABULARY (PLAN.md §3.2 / README "Open decisions":
-- "Topics are invented placeholders. The real vocabulary hasn't been
-- supplied."). These four are the ones the admin fixtures have been using
-- as stand-ins. Topics are admin-editable (unlike principles), so
-- replacing them later is a UI action against /admin/topics, not a
-- migration or a seed edit.
-- ---------------------------------------------------------------------

insert into topics (slug, label, sort_order) values
  ('common-confusion', 'Common confusion', 10),
  ('edge-case', 'Edge case', 20),
  ('clear-cut', 'Clear-cut', 30),
  ('contested', 'Contested', 40);
