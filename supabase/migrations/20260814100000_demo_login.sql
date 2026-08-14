-- =====================================================================
-- Shared demo login (2026-08-14): demo@demo.com / demo — created by
-- migration because the email isn't real, so the invite flow (which
-- needs a deliverable inbox) can't provision it.
--
-- KNOWN PASSWORD, ON PURPOSE — Josh's call for the demo window, so
-- viewers can sign in from the pre-filled /login form. Role is
-- 'admin' (also Josh's call, 2026-08-14) so the demo covers the staff
-- / topics / rubric screens too — meaning anyone with this login can
-- mutate or delete anything. Delete the user the moment the demo
-- window closes.
--
-- The password is written straight into GoTrue's table, which is also
-- why 4 chars beats the 6-char policy floor: the policy only runs in
-- GoTrue's API paths. Delete the row (or set a real password) when the
-- demo window closes.
-- =====================================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-a000-000000000004',
  'authenticated', 'authenticated',
  'demo@demo.com',
  extensions.crypt('demo', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}', '{}',
  now(), now(),
  '', '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '00000000-0000-4000-a000-000000000004',
  '00000000-0000-4000-a000-000000000004',
  '{"sub":"00000000-0000-4000-a000-000000000004","email":"demo@demo.com","email_verified":true}',
  'email', now(), now(), now()
);

insert into staff (user_id, role, email, display_name) values
  ('00000000-0000-4000-a000-000000000004', 'admin', 'demo@demo.com', 'Demo');
