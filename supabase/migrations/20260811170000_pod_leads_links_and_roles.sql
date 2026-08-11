-- Pod leads, Wave 1 (PODS.md, settled 2026-08-11): three roles and
-- per-pod links on master batches.
--
-- Roles: `host` becomes `pod_lead` (rename — existing rows follow), and
-- `project_lead` is added between it and admin. One project, so project
-- leads need no grouping table: the role IS the scope.
--
-- Links: a batch_link is a second front door to an EXISTING batch — same
-- questions, same queue, same batch analytics — owned by a staff member
-- so the answers that arrive through it attribute to their pod. A
-- response stamped with a link counts in the batch's org numbers AND the
-- owner's pod slice; the slice is a filter, not a copy (PODS.md
-- decision 2, revised).

alter type staff_role rename value 'host' to 'pod_lead';
alter type staff_role add value 'project_lead';

create table batch_links (
  id         uuid primary key default gen_random_uuid(),
  batch_id   uuid not null references batches(id) on delete cascade,
  -- staff, not auth.users: a pod link is an AUTHORIZATION artifact like
  -- live_sessions.host_id — it should not outlive its owner's staff row.
  owner_id   uuid not null references staff(user_id) on delete cascade,
  -- Same contract as batches.token: >= 10 URL-safe chars, the only thing
  -- gating access. /b/[token] resolves either kind.
  token      text not null unique,
  created_at timestamptz not null default now(),

  -- "Get my pod link" is idempotent: one link per owner per batch.
  unique (batch_id, owner_id)
);

create index batch_links_batch_idx on batch_links(batch_id);
create index batch_links_owner_idx on batch_links(owner_id);

-- Which door the answer came through. Nullable: canonical-token and live
-- responses have no link. set null on delete so revoking a link keeps the
-- answers (they still belong to the batch — only the pod attribution goes).
alter table responses
  add column batch_link_id uuid references batch_links(id) on delete set null;

create index responses_batch_link_idx on responses(batch_link_id);

-- Fail-closed like every other table; service_role reaches it through the
-- init migration's default privileges. No anon grant — links resolve
-- server-side only.
alter table batch_links enable row level security;
