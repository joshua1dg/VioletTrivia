-- =====================================================================
-- Seed data — replayed by `supabase db reset`. LOCAL DEV ONLY.
--
-- The demoable content (topics, questions, batches, fake contestants,
-- pod links, proposals) moved to migration
-- 20260813190000_demo_content.sql on 2026-08-13 so it reaches
-- production too. What remains here is exactly the part that must NOT
-- reach production: known-password logins.
--
--   admin@violet.local   / password  — admin      (created here)
--   lead@violet.local    / password  — pod_lead   (password set here;
--   project@violet.local / password  — dol         users + staff rows
--                                                  come from the
--                                                  demo-content migration)
--
-- Production gets its admin via `pnpm --dir my-app bootstrap:admin`
-- (auth admin API), never via this file; the two demo staff users
-- carry unguessable random passwords there.
--
-- Written straight into GoTrue's tables so a reset needs no follow-up
-- step. The empty-string token columns are load-bearing: GoTrue scans
-- them as strings and chokes on NULLs.
-- =====================================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-a000-000000000001',
  'authenticated', 'authenticated',
  'admin@violet.local',
  extensions.crypt('password', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}', '{}',
  now(), now(),
  '', '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '00000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000001',
  '{"sub":"00000000-0000-4000-a000-000000000001","email":"admin@violet.local","email_verified":true}',
  'email', now(), now(), now()
);

insert into staff (user_id, role, email, display_name) values
  ('00000000-0000-4000-a000-000000000001', 'admin', 'admin@violet.local', 'Josh');

-- Sam (pod lead) and Ryan (DOL) already exist — the demo-content
-- migration created them with random passwords. Locally, make them
-- signable-into with the same throwaway password as the admin.
update auth.users
set encrypted_password = extensions.crypt('password', extensions.gen_salt('bf'))
where id in ('00000000-0000-4000-a000-000000000002',
             '00000000-0000-4000-a000-000000000003');
