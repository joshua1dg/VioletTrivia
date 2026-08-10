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
-- Principles are NOT seeded here. The real thirteen-principle rubric is
-- installed by migration 20260810130000_replace_placeholder_principles.sql
-- — a migration, not a seed, so it reaches production too. Seeding them
-- here as well would collide with that migration's rows on reset
-- (principles_code_key is unique).
-- ---------------------------------------------------------------------

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
