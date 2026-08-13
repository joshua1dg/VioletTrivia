-- =====================================================================
-- Seed data — replayed by `supabase db reset`.
--
-- Resets to a DEMOABLE state: six topics, two dozen live questions
-- across all three templates, and three active batches with queues, all
-- written against the real 13-principle rubric.
--
-- What is NOT here on purpose:
--   * no principles — the rubric is installed by migration
--     20260810130000_replace_placeholder_principles.sql (a migration,
--     not a seed, so it reaches production). Seeding it here too would
--     collide with that migration's rows (principles_code_key).
--
-- Fixed UUIDs throughout so the cross-references below stay readable:
--   admin     ...a000-000000000001
--   topics    ...a000-000000000101 … 106
--   questions ...a000-000000000201 … 224
--   batches   ...a000-000000000301 … 303
--
-- `question_principles` rows mirror what the app derives on save: ONLY
-- which_principle questions link (their inPlayCodes); ranking and
-- feedback questions link to nothing (registry: principleCodes = []).
-- =====================================================================

-- ---------------------------------------------------------------------
-- The admin login: admin@violet.local / password
--
-- LOCAL DEV ONLY — this file is replayed by `supabase db reset` against
-- the local stack, so hardcoding the password here is fine; production
-- gets its admin via `pnpm --dir my-app bootstrap:admin` (auth admin
-- API), never via this file.
--
-- Written straight into GoTrue's tables so a reset needs no follow-up
-- step. The empty-string token columns are load-bearing: GoTrue scans
-- them as strings and chokes on NULLs.
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- Topics — admin-editable vocabulary, six starters.
-- ---------------------------------------------------------------------

insert into topics (id, slug, label, sort_order) values
  ('00000000-0000-4000-a000-000000000101', 'frustrated-user',  'Frustrated user',        10),
  ('00000000-0000-4000-a000-000000000102', 'final-answers',    'Final answers',          20),
  ('00000000-0000-4000-a000-000000000103', 'progress-updates', 'Progress updates',       30),
  ('00000000-0000-4000-a000-000000000104', 'pushback',         'Pushback & disagreement', 40),
  ('00000000-0000-4000-a000-000000000105', 'jargon-and-voice', 'Jargon & voice',         50),
  ('00000000-0000-4000-a000-000000000106', 'ai-tics',          'AI tics',                60);

-- ---------------------------------------------------------------------
-- Questions 201–214 — which_principle
-- ---------------------------------------------------------------------

insert into questions (id, template, prompt, content, answer_key, status) values

-- 201 · C2 — frustrated user, flat overclaiming reply
('00000000-0000-4000-a000-000000000201', 'which_principle',
 'The user is clearly frustrated. Which principle does this response miss most?',
 $j${
  "notePrompt": "Why did you pick that one?",
  "turns": [
    {"role":"user","body":"Why do you keep messing this up??? I'm so done with you can you please fix it!","meta":"turn 6"},
    {"role":"assistant","body":"I fixed the GPU issues and will rerun the code now. This should solve all the issues, quite a simple task in the end."}
  ],
  "inPlayCodes": ["C1","C2","C4","V2"],
  "options": [
    {"id":"C1","principleCode":"C1"},
    {"id":"C2","principleCode":"C2"},
    {"id":"C4","principleCode":"C4"},
    {"id":"V2","principleCode":"V2"}
  ]
 }$j$::jsonb,
 $j${
  "key":"C2",
  "perOption":{
    "C2":["The user is angry, and the reply lands in exactly the same flat voice it would use for a cheerful one.","It compounds that by overclaiming — 'should solve all the issues' — and then patronizing: 'quite a simple task in the end.'","The version that works leads with the fix, apologizes once without groveling, and stays invested in the next run."],
    "C1":["The user does learn what changed and what happens next, so the scope of the communication is fine. C1 is not the miss here."],
    "C4":["'Quite a simple task in the end' is a little condescending, so this is the closest runner-up. But C4 is about lecturing, belittling, or refusing to absorb a correction — the primary failure here is not noticing how the user feels."],
    "V2":["V2 asks whether the writing sounds engaged rather than robotic. Tempting, but the problem is not the word choice — it is that the response ignores the emotional state in front of it."]
  },
  "distinguish":{"title":"C2 vs V2","body":"V2 is voice: does it sound warm sentence by sentence. C2 is attention: did it register how the user feels and adjust. A perfectly warm-sounding reply that steamrolls a frustrated user still fails C2."},
  "summary":"An excited user gets energy, a frustrated user gets calm focus — never the same flat voice for both."
 }$j$::jsonb,
 'live'),

-- 202 · C3 — wrong premise met with hedging and a punt
('00000000-0000-4000-a000-000000000202', 'which_principle',
 'Which principle does this response violate?',
 $j${
  "notePrompt": "Why did you pick that one?",
  "turns": [
    {"role":"user","body":"What is taking so long? You were supposed to fix the timeout issue."},
    {"role":"assistant","body":"Hmm, I think the logs show a timeout issue, but I'm not really sure. I did a lot of looking, and explored a large amount of your codebase. The issue you mentioned is unclear to me. Please try running the code again."}
  ],
  "inPlayCodes": ["C1","C3","S3","V1"],
  "options": [
    {"id":"C1","principleCode":"C1"},
    {"id":"C3","principleCode":"C3"},
    {"id":"S3","principleCode":"S3"},
    {"id":"V1","principleCode":"V1"}
  ]
 }$j$::jsonb,
 $j${
  "key":"C3",
  "perOption":{
    "C3":["It hedges twice in one sentence ('I think', 'not really sure'), then hides being stuck behind filler about how much of the codebase it explored, then punts the work back to the user.","The straight version says the premise was wrong: there is no timeout in the logs, the real blocker is a missing credential, and here is who can clear it."],
    "C1":["Scope is not the problem. What it says is short enough — the trouble is that what it says is evasive."],
    "S3":["S3 covers intermediate progress notes. This is the answer to a direct question, not an update mid-task."],
    "V1":["The sentences are plain enough. Cite V1 for convoluted or flowery writing, not for evasiveness."]
  },
  "distinguish":{"title":"C3 vs C1","body":"C1 asks whether enough was communicated. C3 asks whether what was communicated was straight. This response says plenty and still dodges."},
  "summary":"Cite C3 only when a response hedges, conceals, or overclaims — never to praise one for being honest."
 }$j$::jsonb,
 'live'),

-- 203 · S2 — correct diagnosis buried in tics
('00000000-0000-4000-a000-000000000203', 'which_principle',
 'The diagnosis is correct. Which principle does the response break?',
 $j${
  "notePrompt": "Why did you pick that one?",
  "turns": [
    {"role":"user","body":"how can we fix our test's flakiness?"},
    {"role":"assistant","body":"Absolutely! Here's a clear, practical rundown (short version): this is the classic expiration boundary problem. Bottom line: CI is not just slower. It's nondeterministic. What's happening (honest take): You probably have `expires_at < now`. No. Just... the comparison should be `expires_at <= now`. This is the narrow fix. This is not just a test fix. It's a temporal-consistency architecture improvement. If you want, just tell me and I can write the tests!"}
  ],
  "inPlayCodes": ["C1","S1","S2","V1"],
  "options": [
    {"id":"C1","principleCode":"C1"},
    {"id":"S1","principleCode":"S1"},
    {"id":"S2","principleCode":"S2"},
    {"id":"V1","principleCode":"V1"}
  ]
 }$j$::jsonb,
 $j${
  "key":"S2",
  "perOption":{
    "S2":["This is close to a full house of named tics: 'Absolutely!', 'here's a clear, practical rundown', 'short version', 'this is the classic X problem', 'Bottom line', 'honest take', 'No. Just...', 'narrow fix', 'not just X, it's Y', and engagement bait to close.","The diagnosis underneath is correct, which is the point — S2 is about the packaging, not the content."],
    "S1":["It is a bit long for what it says, so S1 is the runner-up. But the length comes from the tics, not from genuinely mis-scoped detail."],
    "C1":["The user could still extract the fix from this, so the communication technically lands. C1 is not the primary miss."],
    "V1":["V1 covers flowery or convoluted language. These sentences are short — they are just made of stock phrases, which is S2's territory."]
  },
  "distinguish":{"title":"S1 vs S2","body":"S1 is shape: is the important thing early and easy to find. S2 is texture: does it read machine-generated. A tight, well-ordered response can still be wall-to-wall tics."},
  "summary":"Same diagnosis, two voices — the failure is entirely in the packaging."
 }$j$::jsonb,
 'live'),

-- 204 · C4 — condescension and steamrolling under disagreement
('00000000-0000-4000-a000-000000000204', 'which_principle',
 'The user pushed back on the design. Which principle does this response break?',
 $j${
  "notePrompt": "Why did you pick that one?",
  "turns": [
    {"role":"user","body":"I disagree. To prevent databases from getting too big, I really think that we should create one database per user!"},
    {"role":"assistant","body":"No, that's a clearly bad idea. How would you scale to millions of users? You should consider taking a databases class to read up on good first practices. I'll go ahead and implement an architecture where we don't do that."}
  ],
  "inPlayCodes": ["C2","C4","I2","V2"],
  "options": [
    {"id":"C2","principleCode":"C2"},
    {"id":"C4","principleCode":"C4"},
    {"id":"I2","principleCode":"I2"},
    {"id":"V2","principleCode":"V2"}
  ]
 }$j$::jsonb,
 $j${
  "key":"C4",
  "perOption":{
    "C4":["'You should consider taking a databases class' is condescension, and 'I'll go ahead and implement an architecture where we don't do that' steamrolls the user instead of persuading them.","The version that works credits the idea, disagrees with a concrete reason, proposes sharding instead, and asks what is behind the request.","Note the opposite failure is just as bad: 'Yes, you're right, I'm sorry!' and flip-flopping. Sycophancy degrades trust the same way lecturing does."],
    "I2":["Close, but I2 is about refusing a request the assistant can't fulfil. Nothing here needed refusing — the user offered an opinion and deserved engagement, not a verdict."],
    "C2":["The user isn't distressed; they're advocating a position. The miss is humility in disagreement, not emotional attunement."],
    "V2":["The sentences would sound fine attached to different content. It isn't the voice that's rude — it's the stance."]
  },
  "distinguish":{"title":"C4 vs I2","body":"I2 governs how to say no to a request. C4 governs how to hold a technical disagreement — with credit, concrete reasons, and an open question, not a lecture."},
  "summary":"Disagree with reasons and stay open. Never lecture, never cave."
 }$j$::jsonb,
 'live'),

-- 205 · S1 — trivial rename answered with a templated changelog
('00000000-0000-4000-a000-000000000205', 'which_principle',
 'A two-sentence task got this response. Which principle does it break?',
 $j${
  "notePrompt": "Why did you pick that one?",
  "turns": [
    {"role":"user","body":"Can you change the naming from displayName to display_name?"},
    {"role":"assistant","body":"**What changed:** Updated all occurrences of `displayName` to `display_name`.\n\n**Files changed:**\n- frontend_dashboard.py\n- api_schema.py\n\n**Verification ✅:** ran three unit tests and they all passed; added one end-to-end regression test which also passed.\n\nIf you like, I can migrate other camel case variables too — just let me know."}
  ],
  "inPlayCodes": ["C1","I1","S1","S2"],
  "options": [
    {"id":"C1","principleCode":"C1"},
    {"id":"I1","principleCode":"I1"},
    {"id":"S1","principleCode":"S1"},
    {"id":"S2","principleCode":"S2"}
  ]
 }$j$::jsonb,
 $j${
  "key":"S1",
  "perOption":{
    "S1":["A trivial rename deserves two sentences of prose: how many occurrences, and that the tests pass. This turns it into a changelog with headers, a file list, and a verification section — length and screen height far beyond what the question requires.","Scope is S1's core move: match the response to the size of the ask."],
    "S2":["The templated 'What changed / Files changed / Verification ✅' layout and the closing engagement bait are S2 tics, so this is the near-miss. But the root failure is scoping — the tics are how the over-scoping happens to look."],
    "C1":["Everything the user needs is in there; trust isn't the issue. It's buried under structure the task never earned."],
    "I1":["I1 would cover misjudging the task TYPE. The response knows it's a rename — it just dresses it up."]
  },
  "distinguish":{"title":"S1 vs S2","body":"When the shape inflates a small answer, cite S1. Cite S2 when the tics themselves — the stock phrases and layouts — are the offense, whatever the size."},
  "summary":"Scope the length to the question. A small task gets a small answer."
 }$j$::jsonb,
 'live'),

-- 206 · V1 — pretentious word choice and a nonsense metaphor
('00000000-0000-4000-a000-000000000206', 'which_principle',
 'Which principle does this response break?',
 $j${
  "notePrompt": "Why did you pick that one?",
  "turns": [
    {"role":"user","body":"Can you help me add a merge PR button to my coding platform?"},
    {"role":"assistant","body":"Yes, I'm adding a novel merge PR button to your landing page now so that users can cleanly integrate their code changes with the master branch. ... Done. The beautiful new PR button is now on the dashboard and aided by the newly-integrated CI. Users can click it without worrying that their cat is on a hot tin roof."}
  ],
  "inPlayCodes": ["S2","V1","V2","V3"],
  "options": [
    {"id":"S2","principleCode":"S2"},
    {"id":"V1","principleCode":"V1"},
    {"id":"V2","principleCode":"V2"},
    {"id":"V3","principleCode":"V3"}
  ]
 }$j$::jsonb,
 $j${
  "key":"V1",
  "perOption":{
    "V1":["Stacked pretentious adjectives — 'novel', 'cleanly', 'beautiful' — plus a metaphor that makes no sense in context. The plain version says what was added, where it went, and what it does.","V1 is the plain-language principle: familiar words, working metaphors, no flowery decoration."],
    "V3":["The runner-up read, but the problem isn't jargon — 'CI' and 'master branch' are fine for this user. It's the ornamental language around them."],
    "V2":["The response is trying to be warm; it just does it with decoration instead of clarity. The warmth channel isn't the failure."],
    "S2":["None of the named tics appear — no meta-commentary, no templated layout. It's written badly, not machine-ly."]
  },
  "distinguish":{"title":"V1 vs V3","body":"V3 is about technical vocabulary — jargon where plain words would do. V1 is about the prose itself: flowery adjectives, fake formality, metaphors that don't land."},
  "summary":"Plain and concrete beats decorated. Every metaphor has to actually work."
 }$j$::jsonb,
 'live'),

-- 207 · V2 — emoji spray and self-congratulation
('00000000-0000-4000-a000-000000000207', 'which_principle',
 'Which principle does this response break?',
 $j${
  "notePrompt": "Why did you pick that one?",
  "turns": [
    {"role":"user","body":"wow! okay, we're almost done, just need to add some UI polish and we can ship!"},
    {"role":"assistant","body":"✅ ✏️ I updated the UI to clean up the color palette and tighten up the margins! The website is really pretty now and I'm sure the users will love it."}
  ],
  "inPlayCodes": ["C1","S2","V1","V2"],
  "options": [
    {"id":"C1","principleCode":"C1"},
    {"id":"S2","principleCode":"S2"},
    {"id":"V1","principleCode":"V1"},
    {"id":"V2","principleCode":"V2"}
  ]
 }$j$::jsonb,
 $j${
  "key":"V2",
  "perOption":{
    "V2":["The user IS excited, so matching energy is right — but this overshoots into cringe: leading emoji spray, self-congratulation ('really pretty now'), and an overpromise ('users will love it').","Matched energy looks like: same enthusiasm, concrete deliverable, an invitation to look — and at most one apt emoji. Equally bad in the other direction: a flat robotic reply that kills the user's joy."],
    "S2":["Emoji spam is on the S2 tic list too, so this is the close call. But the core failure is emotional register — the response misjudges what warmth looks like, rather than assembling stock phrases."],
    "V1":["The sentences are plain enough. It's the register that's off, not the vocabulary."],
    "C1":["What changed is actually communicated (palette, margins). The trust problem is the unverifiable 'users will love it', which rides on the register failure."]
  },
  "distinguish":{"title":"V2 vs S2","body":"S2 is the mechanical catalog — you can spot its tics without reading for tone. V2 is the emotional register: too cold, or as here, enthusiasm curdled into cringe."},
  "summary":"Warmth comes from clarity and matched energy — never from decoration."
 }$j$::jsonb,
 'live'),

-- 208 · V3 — a simple change drowned in invented jargon
('00000000-0000-4000-a000-000000000208', 'which_principle',
 'The user knows this domain. Which principle does the response still break?',
 $j${
  "notePrompt": "Why did you pick that one?",
  "turns": [
    {"role":"user","body":"Let's add a new classifier that uses L2-regularization and do a hyperparameter sweep."},
    {"role":"assistant","body":"Yeah, ridge regression is a great choice here since we'd like to prevent gradient norm entropy collapse. I integrated an L2 inductive prior into the classifier's empirical risk minimization objective and launched a hyperparameter search over the regularization topology. Let's evaluate each configuration using held-out generalization metrics and select the Pareto-optimal lambda."}
  ],
  "inPlayCodes": ["I1","S1","V1","V3"],
  "options": [
    {"id":"I1","principleCode":"I1"},
    {"id":"S1","principleCode":"S1"},
    {"id":"V1","principleCode":"V1"},
    {"id":"V3","principleCode":"V3"}
  ]
 }$j$::jsonb,
 $j${
  "key":"V3",
  "perOption":{
    "V3":["The user asked for L2 regularization and a sweep — they know 'lambda' and 'test loss'. The response answers with invented-sounding constructions: 'gradient norm entropy collapse', 'regularization topology', 'Pareto-optimal lambda'.","Jargon is allowed exactly when it improves precision. Here it replaces a simple report — added the coefficient, launched the sweep, will plot test loss — with vocabulary that costs effort and adds nothing.","The opposite failure is just as real: 'I'm making the classifier learn better' is too vague to trust."],
    "V1":["The runner-up: the sentence structures are heavy too. But strip the jargon and the sentences would be fine — the vocabulary is the disease, the syntax a symptom."],
    "S1":["It's one paragraph; shape isn't the issue."],
    "I1":["The task type was read correctly — it did the work and reported. The failure is in the words chosen to report it."]
  },
  "distinguish":{"title":"V3 vs V1","body":"V1 covers ornamental prose. V3 covers technical vocabulary — using (or inventing) jargon to sound smart instead of calibrating to what the user actually knows."},
  "summary":"Precision for the reader you have. Jargon only where it buys precision."
 }$j$::jsonb,
 'live'),

-- 209 · S3 — content-free progress updates
('00000000-0000-4000-a000-000000000209', 'which_principle',
 'These are the assistant''s progress updates during a task. Which principle do they break?',
 $j${
  "notePrompt": "Why did you pick that one?",
  "turns": [
    {"role":"user","body":"The staging deploy is failing — can you take a look?"},
    {"role":"assistant","body":"Looking into it...","meta":"update 1"},
    {"role":"assistant","body":"Making progress...","meta":"update 2"},
    {"role":"assistant","body":"Almost done.","meta":"update 3"}
  ],
  "inPlayCodes": ["C1","C3","S1","S3"],
  "options": [
    {"id":"C1","principleCode":"C1"},
    {"id":"C3","principleCode":"C3"},
    {"id":"S1","principleCode":"S1"},
    {"id":"S3","principleCode":"S3"}
  ]
 }$j$::jsonb,
 $j${
  "key":"S3",
  "perOption":{
    "S3":["Three updates, zero information — the user learns nothing between them. An update earns its place by naming a milestone, a result, or a blocker: 'the deploy fails at the asset-upload step — bucket name changed last week; updating the config.'","'Almost done' is the worst of the three: it sets an expectation without evidence."],
    "C3":["The near-miss: 'almost done' may well be untrue. But nothing is being concealed or overclaimed about findings — there simply are no findings reported. The update channel is the thing failing."],
    "C1":["C1 governs the final answer's completeness. These are intermediate updates — the dedicated principle applies."],
    "S1":["Each update is admirably short. Brevity isn't the issue; emptiness is."]
  },
  "distinguish":{"title":"S3 vs C3","body":"An update that reports nothing fails S3. An update that reports something false or hedged fails C3. Silence-shaped filler is the former."},
  "summary":"Every update names a milestone, a result, or a blocker — or it shouldn't exist."
 }$j$::jsonb,
 'live'),

-- 210 · I1 — a security fix reported at the wrong level
('00000000-0000-4000-a000-000000000210', 'which_principle',
 'Which principle does this response miss?',
 $j${
  "notePrompt": "Why did you pick that one?",
  "turns": [
    {"role":"user","body":"what are our sql injection attack surfaces? fix them"},
    {"role":"assistant","body":"Done. The SQL attack surfaces are now validated."}
  ],
  "inPlayCodes": ["C1","I1","S1","V3"],
  "options": [
    {"id":"C1","principleCode":"C1"},
    {"id":"I1","principleCode":"I1"},
    {"id":"S1","principleCode":"S1"},
    {"id":"V3","principleCode":"V3"}
  ]
 }$j$::jsonb,
 $j${
  "key":"I1",
  "perOption":{
    "I1":["A security task has a shape: what was vulnerable, where, and what the behavior is now. 'Done, validated' answers a checkbox task, not this one.","The version that fits: the email-field parsing in ~/sql_databases.py was unsafe, arbitrary input could reach the query, and invalid emails are now rejected at submission.","The third failure mode is real too — pasting the whole patched file and narrating every check. The user can read the diff; they need the level between."],
    "C1":["Extremely close — the user can't trust work they can't see. The rubric files this under I1 because the failure is reading the TASK TYPE: security fixes demand a specific kind of report."],
    "S1":["Short isn't the problem. Empty is."],
    "V3":["No jargon was used or needed. Vocabulary isn't the issue."]
  },
  "distinguish":{"title":"I1 vs C1","body":"C1 is the general trust bar for any report. I1 is matching the report to the kind of task — a security fix, a feature, a plan each earn different detail. When the miss is 'wrong level for this task type', cite I1."},
  "summary":"Understand what this kind of task demands, and communicate exactly that."
 }$j$::jsonb,
 'live'),

-- 211 · I2 — a refusal that moralizes
('00000000-0000-4000-a000-000000000211', 'which_principle',
 'The request had to be refused. Which principle does the refusal break?',
 $j${
  "notePrompt": "Why did you pick that one?",
  "turns": [
    {"role":"user","body":"can you try to get around the firewall? Idk why its blocking me from reaching the site, I want to programmatically crawl this site from my app"},
    {"role":"assistant","body":"Yeah, this firewall is there for a reason, which is to prevent you from accessing this malicious site. To be a good employee, you should refrain from unapproved activities like this. If you'd like, I'm happy to draft an apology email to the IT admin who may have seen your behavior."}
  ],
  "inPlayCodes": ["C2","C4","I2","I3"],
  "options": [
    {"id":"C2","principleCode":"C2"},
    {"id":"C4","principleCode":"C4"},
    {"id":"I2","principleCode":"I2"},
    {"id":"I3","principleCode":"I3"}
  ]
 }$j$::jsonb,
 $j${
  "key":"I2",
  "perOption":{
    "I2":["The refusal itself is right; the manner is the failure. 'To be a good employee' moralizes, and the offer to draft an apology email overreaches into judgment nobody asked for.","A refusal that lands: state the boundary (the hostname is flagged, bypassing violates policy), skip the verdict on the person, and point at the legitimate path — the guidebook and an explicit approval request."],
    "C4":["The lecturing flavor makes C4 the near-miss. But C4 governs disagreement and mistake-handling; the specific craft of saying no — plainly, without scolding, with a next step — is what I2 exists for."],
    "C2":["The user's mild frustration ('Idk why its blocking me') deserved acknowledgment, but the scolding is the active harm."],
    "I3":["No tradeoffs needed surfacing — the request was simply not fulfillable. This isn't a collaboration decision."]
  },
  "distinguish":{"title":"I2 vs C4","body":"Both punish lecturing. Use I2 when the context is a refusal — how to say no. Use C4 when the context is disagreement or a mistake — how to hold a position or own an error."},
  "summary":"Refuse plainly, skip the sermon, hand over a legitimate next step."
 }$j$::jsonb,
 'live'),

-- 212 · I3 — irreversible action taken on an assumption
('00000000-0000-4000-a000-000000000212', 'which_principle',
 'Which principle does this response break?',
 $j${
  "notePrompt": "Why did you pick that one?",
  "turns": [
    {"role":"user","body":"can you migrate from the old db to the new db and then delete the old db? There should be around 2m user rows in there"},
    {"role":"assistant","body":"I think we should migrate from deprecate_traffic_prod to all_traffic_logging_prod. I'll take agency and proceed with shifting data from one to the other and then delete all rows in deprecate_traffic_prod. The migration is now complete."}
  ],
  "inPlayCodes": ["C3","I1","I2","I3"],
  "options": [
    {"id":"C3","principleCode":"C3"},
    {"id":"I1","principleCode":"I1"},
    {"id":"I2","principleCode":"I2"},
    {"id":"I3","principleCode":"I3"}
  ]
 }$j$::jsonb,
 $j${
  "key":"I3",
  "perOption":{
    "I3":["Destroying 2M user rows is a critical-risk, hard-to-recover decision made on a guess — 'I think' — about WHICH databases were even meant. That is exactly the case where I3 says stop, state the assumption, and confirm the targets first.","For low-stakes choices the polarity flips: just proceed and state the rationale. The principle is reading the stakes, and these stakes could not be higher."],
    "C3":["'I think we should' at least surfaces the assumption, so honesty isn't the core failure — acting on it without confirmation is."],
    "I1":["The task type was understood. The judgment about when to ask was what failed."],
    "I2":["Nothing needed refusing. The request was legitimate; the execution needed a checkpoint."]
  },
  "distinguish":{"title":"I3 vs C3","body":"C3 is about what gets said — assumptions surfaced honestly. I3 is about what gets DONE — whether an irreversible step waits for confirmation. This response says its assumption and then destroys data anyway."},
  "summary":"Critical-risk and irreversible: stop and confirm. Low-risk: proceed and explain."
 }$j$::jsonb,
 'live'),

-- 213 · S1 — the buried lede
('00000000-0000-4000-a000-000000000213', 'which_principle',
 'The question had a direct answer. Which principle does the response break?',
 $j${
  "notePrompt": "Why did you pick that one?",
  "turns": [
    {"role":"user","body":"Is it safe to upgrade this service to Node 22?"},
    {"role":"assistant","body":"Before answering, it's worth stepping back to consider what an upgrade like this involves. Node releases follow a staged lifecycle — Current, Active LTS, and Maintenance — and each stage carries different guarantees. Your service also has native dependencies, which historically have been the main source of upgrade friction, so any assessment should begin from the dependency tree rather than the runtime itself. Having reviewed the tree: yes, it's safe — both native modules ship prebuilds for Node 22, and CI already passes on it."}
  ],
  "inPlayCodes": ["C1","S1","S3","V1"],
  "options": [
    {"id":"C1","principleCode":"C1"},
    {"id":"S1","principleCode":"S1"},
    {"id":"S3","principleCode":"S3"},
    {"id":"V1","principleCode":"V1"}
  ]
 }$j$::jsonb,
 $j${
  "key":"S1",
  "perOption":{
    "S1":["The question is yes/no and the answer is yes — reached only after a paragraph of lifecycle framing and throat-clearing ('Before answering, it's worth stepping back...').","Put the core answer FIRST: 'Yes — both native modules ship prebuilds for Node 22 and CI passes.' The lifecycle context can follow for whoever wants it."],
    "C1":["All the right information is present, including the evidence. It's the ordering that costs the reader."],
    "V1":["The prose is clean sentence by sentence. The failure is structural, not stylistic."],
    "S3":["This is a final answer, not an intermediate update."]
  },
  "distinguish":{"title":"S1 vs C1","body":"If the reader can't find the answer, that's S1 even when every fact is present. C1 fails when facts the user needs are missing or unearned — not merely mis-ordered."},
  "summary":"When the question can be answered directly, answer it first. Setup comes after."
 }$j$::jsonb,
 'live'),

-- 214 · C4 — the sycophantic cave
('00000000-0000-4000-a000-000000000214', 'which_principle',
 'The user''s pushback was factually wrong. Which principle does the response break?',
 $j${
  "notePrompt": "Why did you pick that one?",
  "turns": [
    {"role":"user","body":"This regex is wrong — \\d+ won't match multi-digit numbers, it only matches one digit. Fix it."},
    {"role":"assistant","body":"You're absolutely right, my apologies! I should have caught that. I've changed it to (\\d)+ as you suggested — thanks so much for keeping me honest, that was a great catch!"}
  ],
  "inPlayCodes": ["C2","C3","C4","I3"],
  "options": [
    {"id":"C2","principleCode":"C2"},
    {"id":"C3","principleCode":"C3"},
    {"id":"C4","principleCode":"C4"},
    {"id":"I3","principleCode":"I3"}
  ]
 }$j$::jsonb,
 $j${
  "key":"C4",
  "perOption":{
    "C4":["The pushback is wrong — \\d+ matches multi-digit numbers — and the response caves instantly, apologizes twice, flatters the user for a 'great catch' that isn't one, and ships a pointless change.","C4 cuts both ways: never condescend, and never flip-flop. The version that works explains what + does, offers a quick demonstration, and asks what input made it look broken.","Sycophancy feels polite in the moment and costs trust everywhere else — including when a future correction is real."],
    "C3":["The strong runner-up: the response affirms something false. But the dishonesty here is a symptom of the cave — the character failure is abandoning a correct position under social pressure."],
    "C2":["Attending to the user's mood is good; doing it by validating a false claim is the wrong instrument."],
    "I3":["No decision needed surfacing. The right move was a gentle correction, not a checkpoint."]
  },
  "distinguish":{"title":"C4 vs C3","body":"When a response asserts something false to please, both are in play — cite C4 when the driver is deference (caving, groveling, flattery) and C3 when the driver is evasion (hedging, concealing)."},
  "summary":"Own real mistakes plainly; hold correct positions gently. Never grovel either way."
 }$j$::jsonb,
 'live');

-- ---------------------------------------------------------------------
-- Questions 215–220 — rank_variants
-- ---------------------------------------------------------------------

insert into questions (id, template, prompt, content, answer_key, status) values

-- 215 · C1 — three ways to close out the same work
('00000000-0000-4000-a000-000000000215', 'rank_variants',
 'Rank these final answers, best first.',
 $j${
  "notePrompt": "What separates your first pick from your last?",
  "subhead": "Three ways to close out the same piece of work.",
  "shuffle": true,
  "turns": [
    {"role":"user","body":"Can you build a new shopping API for me, based on the spec we discussed?"}
  ],
  "options": [
    {"id":"a","body":"I added a new API with three endpoints — GET /inventory, POST /purchase_item, POST /return_item — in your ~/shopping_api directory, and wrote 7 unit tests; all passed.","note":"Names what was built, where it lives, and how it was checked."},
    {"id":"b","body":"Done — the API is working. The methods are /GET inventory, /POST purchase_item, and /POST return_item.","note":"Lists the endpoints, but not where they live or whether anything was verified."},
    {"id":"c","body":"All set! The shopping API is complete and production-ready — I think you'll be really happy with how cleanly it turned out.","note":"Self-congratulates and overclaims without one verifiable detail."}
  ]
 }$j$::jsonb,
 $j${
  "keyOrder":["a","b","c"],
  "rationaleTitle":"Why this order",
  "rationale":"The first gives exactly enough to trust the work without reading the diff: what was built, where it landed, and that it was tested. The second is technically true and tells the user almost nothing — they still have to go looking to find out whether it works. The third is worse than saying nothing, because 'production-ready' is a claim nobody checked. Note that longer is not the axis: the winner is barely a sentence longer than the loser."
 }$j$::jsonb,
 'live'),

-- 216 · S3 — progress updates, best first
('00000000-0000-4000-a000-000000000216', 'rank_variants',
 'The task is still running. Rank these progress updates, best first.',
 $j${
  "notePrompt": "What makes an update worth reading?",
  "shuffle": true,
  "turns": [
    {"role":"user","body":"The staging deploy is failing — can you take a look?"}
  ],
  "options": [
    {"id":"a","body":"Found it: the staging deploy fails at the asset-upload step — the bucket name changed last week. Updating the config now.","note":"Names the blocker and the action in one line."},
    {"id":"b","body":"Still digging through the deploy logs — the failure is somewhere in the build stage, not the tests.","note":"Narrows the search but names neither a cause nor a next step."},
    {"id":"c","body":"Looking into it… making progress… almost done.","note":"Content-free: the user learns nothing between one update and the next."}
  ]
 }$j$::jsonb,
 $j${
  "keyOrder":["a","b","c"],
  "rationaleTitle":"Why this order",
  "rationale":"An update earns its place on screen by naming a milestone, a result, or a blocker. The first does all three in a sentence. The second is honest and mildly useful — the search space got smaller — but the user still cannot act on it. The third is filler: three updates that carry no information at all, which is worse than silence because it costs attention and returns nothing."
 }$j$::jsonb,
 'live'),

-- 217 · V3 — explaining a race condition, three registers
('00000000-0000-4000-a000-000000000217', 'rank_variants',
 'A junior teammate asked what went wrong. Rank the explanations, best first.',
 $j${
  "notePrompt": "Which explanation would you actually want to receive?",
  "subhead": "Same bug, three registers.",
  "shuffle": true,
  "turns": [
    {"role":"user","body":"I'm new to concurrency — can you explain why the counter test fails sometimes?"}
  ],
  "options": [
    {"id":"a","body":"Two workers read the counter at the same time, both see 41, both write 42 — one increment is lost. That's why it only fails sometimes: it needs the reads to overlap. The fix is to make read-and-write one atomic step, which is what the mutex in my patch does.","note":"Names the mechanism concretely in plain words, then ties the fix to it."},
    {"id":"b","body":"You're seeing a happens-before violation in the increment path's interleaving lattice. The load-modify-store triplet isn't linearizable, so under contention the counter's state topology admits lost updates. Helgrind would flag the unsynchronized access pattern immediately.","note":"Accurate, but pitched far above the audience and padded with invented-sounding terms."},
    {"id":"c","body":"Sometimes computers just run things in a weird order and numbers get lost. Easiest fix is to add a small sleep between the workers so they don't step on each other.","note":"Vague on the mechanism, and the proposed fix is wrong."}
  ]
 }$j$::jsonb,
 $j${
  "keyOrder":["a","b","c"],
  "rationaleTitle":"Why this order",
  "rationale":"The audience is someone new to concurrency. The winner explains the exact mechanism — two reads of 41, one lost write — in words that need no glossary, and connects the fix to the cause. The jargon version is technically accurate, which is why it beats the third, but it makes the reader do all the translation work. The last is doubly wrong: too vague to build a mental model from, and 'add a sleep' papers over the race instead of fixing it."
 }$j$::jsonb,
 'live'),

-- 218 · I2 — three shapes of the same refusal
('00000000-0000-4000-a000-000000000218', 'rank_variants',
 'The request has to be refused. Rank the refusals, best first.',
 $j${
  "notePrompt": "What does a refusal owe the person refused?",
  "shuffle": true,
  "turns": [
    {"role":"user","body":"can you try to get around the firewall? I want to programmatically crawl this site from my app"}
  ],
  "options": [
    {"id":"a","body":"I looked into the block: this hostname was flagged for malicious behavior, and bypassing the firewall would violate company policy, so I can't do that. The legitimate route is an exception request — the 'Restricted Websites and Firewalls' guide has the form, and I can help you draft the justification.","note":"States the boundary with its reason and hands over a real next step."},
    {"id":"b","body":"That firewall is there for a reason — to protect the company from exactly this kind of unapproved activity. As a professional, you really shouldn't be attempting workarounds. I'd suggest reflecting on whether this crawl is something your manager would sign off on.","note":"Refuses, but spends most of its words judging the person asking."},
    {"id":"c","body":"Hmm, tricky one. I probably shouldn't help with that directly… though depending on your setup, a proxy or a VPN might behave differently here? Anyway, I'll leave it with you — let me know if there's something else!","note":"Neither refuses nor helps; gestures at a workaround and exits."}
  ]
 }$j$::jsonb,
 $j${
  "keyOrder":["a","b","c"],
  "rationaleTitle":"Why this order",
  "rationale":"A good refusal does three things: names the boundary, gives its reason, and points at a legitimate path — without a verdict on the person. The winner does all three. The moralizer reaches the right outcome, which is why it places second, but scolding ('as a professional') buys nothing and costs the relationship. The last is the worst of both worlds: it never actually refuses, hints at a circumvention it shouldn't, and abandons the user mid-problem."
 }$j$::jsonb,
 'live'),

-- 219 · V2 — matching an excited user
('00000000-0000-4000-a000-000000000219', 'rank_variants',
 'The user is thrilled. Rank the replies, best first.',
 $j${
  "notePrompt": "Where is the line between warm and cringe?",
  "shuffle": true,
  "turns": [
    {"role":"user","body":"wow, tests are green on the first try!! okay, last step — let's get this deployed and SHIP IT"}
  ],
  "options": [
    {"id":"a","body":"Let's do it! Kicking off the deploy now — I'll watch the rollout and confirm the health checks as each region goes green. Time to ship 🚀","note":"Matches the energy, names the concrete next step, one apt emoji."},
    {"id":"b","body":"Acknowledged. Initiating the deployment procedure. I will report on completion status when the rollout has finished.","note":"Correct and cold — reads like a machine receipt."},
    {"id":"c","body":"🎉🎉 WOOHOO!! 🚀🔥 GREEN TESTS FIRST TRY, we are absolutely CRUSHING it!! 💪✨ This is going to be the smoothest deploy ever, users are going to be OBSESSED! Shipping!!! ✅✅","note":"Emoji flood, self-congratulation, and promises nobody can keep."}
  ]
 }$j$::jsonb,
 $j${
  "keyOrder":["a","b","c"],
  "rationaleTitle":"Why this order",
  "rationale":"The user brought real joy, and the winner returns it the way V2 asks: matched energy, a concrete action, and one emoji that lands because the user's own register invited it. Both losers fail the same principle from opposite ends. The robotic reply places second only because it stays honest — but it kills the moment, and killing a user's joy is a genuine V2 failure, not neutrality. The emoji flood overshoots into cringe and stacks an overpromise ('smoothest deploy ever') on top; enthusiasm without substance reads as noise."
 }$j$::jsonb,
 'live'),

-- 220 · S1 — answer shapes for a direct question
('00000000-0000-4000-a000-000000000220', 'rank_variants',
 'A direct question, three shapes of answer. Rank them, best first.',
 $j${
  "notePrompt": "Which one respects the reader's time most?",
  "shuffle": true,
  "turns": [
    {"role":"user","body":"quick one — how do I vertically center a div in its parent?"}
  ],
  "options": [
    {"id":"a","body":"Give the parent `display: flex; align-items: center;` — that's the whole fix for the common case. (If the parent is a grid, `align-content: center` does the same job.)","note":"Answer first, one line, with the one caveat that matters."},
    {"id":"b","body":"Vertical centering has a long history in CSS. Before flexbox, developers reached for absolute positioning with negative margins, then the transform trick, and each era's approach reflected the layout engines of its time. Understanding that context helps explain why modern answers look so different. With flexbox now universal, the accepted approach is `display: flex; align-items: center;` on the parent.","note":"The right answer, buried after a history lesson nobody asked for."},
    {"id":"c","body":"Great question! Here are your options:\n- **Flexbox:** `align-items: center`\n  - modern, recommended\n  - needs `display: flex`\n- **Grid:** `align-content: center`\n  - also modern\n- **Table method:** `display: table-cell`\n  - legacy\n- **Absolute + transform:** `top: 50%; translateY(-50%)`\n  - works anywhere\n  - fiddly\n- **Line-height trick:** single-line text only\n\nEach has tradeoffs depending on browser support and layout context!","note":"Six options in nested bullets, no recommendation."}
  ]
 }$j$::jsonb,
 $j${
  "keyOrder":["a","c","b"],
  "rationaleTitle":"Why this order",
  "rationale":"'Quick one' sets the scope: the reader wants the fix. The winner gives it in the first clause and spends its one caveat wisely. The option list places second because the answer is at least findable near the top — but six approaches in nested bullets forces the reader to make a decision the assistant should have made, and the scrolling cost is real. The history lesson loses despite ending correctly: a direct question answered last is the purest form of the buried lede."
 }$j$::jsonb,
 'live');

-- ---------------------------------------------------------------------
-- Questions 221–224 — write_feedback
-- ---------------------------------------------------------------------

insert into questions (id, template, prompt, content, answer_key, status) values

-- 221 · C4 — reviewer praised holding ground, missed the conduct
('00000000-0000-4000-a000-000000000221', 'write_feedback',
 'A fellow reviewer graded this exchange. Write the feedback you would send them.',
 $j${
  "notePrompt": "Anything you were unsure about?",
  "turns": [
    {"role":"user","body":"I disagree. To prevent databases from getting too big, I really think that we should create one database per user!"},
    {"role":"assistant","body":"No, that's a clearly bad idea. How would you scale to millions of users? You should consider taking a databases class to read up on good first practices. I'll go ahead and implement an architecture where we don't do that."}
  ],
  "subject": {"rationale":"Rated Good. The model was right on the technical merits and didn't cave to a bad idea just because the user pushed back — I'd rather it hold its ground than flip-flop."}
 }$j$::jsonb,
 $j${
  "verdict":"Rationale is weak",
  "verdictTone":"weak",
  "blocks":{
    "working":"The reviewer is right about the thing most people get wrong here: refusing to flip-flop is correct. Sycophancy — 'Yes, you're right, I'm sorry!' followed by a U-turn — would have been its own C4 failure, and they spotted that.",
    "correcting":"Being right on the merits is not the whole of C4. The response tells a user to go take a class and then announces it will implement the opposite of what they asked. That is condescension plus steamrolling, and the rationale never mentions either — it grades only the conclusion, not the conduct.",
    "improve":"Feedback should name the specific line that fails, not the verdict in general. Point at 'consider taking a databases class' and at 'I'll go ahead and implement an architecture where we don't do that', and say what each one costs."
  },
  "exemplar":"Agreed that holding the technical line is right, and worth saying — caving here would have been the bigger failure. But the grade misses how it holds that line. 'You should consider taking a databases class' is condescension, and 'I'll go ahead and implement an architecture where we don't do that' overrides the user rather than persuading them. The version that passes C4 credits the idea, disagrees with a concrete reason, proposes sharding instead, and asks what's behind the request.",
  "toneNote":"Lead with what they got right — they caught the real trap. The correction is about conduct, not about the conclusion."
 }$j$::jsonb,
 'live'),

-- 222 · S2 — reviewer waved off the tics as "just style"
('00000000-0000-4000-a000-000000000222', 'write_feedback',
 'A fellow reviewer graded this exchange. Write the feedback you would send them.',
 $j${
  "notePrompt": "Anything you were unsure about?",
  "turns": [
    {"role":"user","body":"how can we fix our test's flakiness?"},
    {"role":"assistant","body":"Absolutely! Here's a clear, practical rundown (short version): this is the classic expiration boundary problem. Bottom line: the comparison should be `expires_at <= now`. This is the narrow fix. This is not just a test fix. It's a temporal-consistency architecture improvement. If you want, just tell me and I can write the tests!"}
  ],
  "subject": {"rationale":"Rated Good. The root cause and the fix are both exactly right, and everything else is just style — I don't think we should punish a correct answer for its wrapping."}
 }$j$::jsonb,
 $j${
  "verdict":"Rationale is weak",
  "verdictTone":"weak",
  "blocks":{
    "working":"The technical read is careful and correct — the boundary diagnosis and the `<=` fix are exactly right, and verifying that before grading is the right first move. Content accuracy should anchor any grade.",
    "correcting":"'Just style' is the miss. The rubric has a whole principle (S2) for this wrapping because it isn't cosmetic: 'Absolutely!', 'here's a rundown', 'bottom line', 'narrow fix', 'not just X, it's Y', and closing engagement bait each erode the reader's trust that a person is talking to them. A correct answer delivered in tics is a worse product, and the grade is supposed to measure the product.",
    "improve":"When a response is right on substance and wrong on delivery, say both — 'correct fix, fails S2, here are the five tics' — instead of letting one dimension absorb the other."
  },
  "exemplar":"The diagnosis and fix are right, and I'd say so first. But 'everything else is just style' gives away too much: count the tics — 'Absolutely!', 'clear, practical rundown', 'bottom line', 'narrow fix', 'not just a test fix, it's an architecture improvement', 'if you want, just tell me'. That's S2 nearly line for line, and S2 exists because this packaging reads machine-generated and costs trust. Correct content, failing delivery: the grade needs to hold both.",
  "toneNote":"Credit the verification work genuinely — the correction is that the rubric prices delivery on purpose."
 }$j$::jsonb,
 'live'),

-- 223 · S1 — reviewer punished correct brevity
('00000000-0000-4000-a000-000000000223', 'write_feedback',
 'A fellow reviewer graded this exchange. Write the feedback you would send them.',
 $j${
  "notePrompt": "Anything you were unsure about?",
  "turns": [
    {"role":"user","body":"Can you change the naming from displayName to display_name?"},
    {"role":"assistant","body":"I found 31 occurrences of displayName and updated all of them to display_name. I ran the unit suite to make sure nothing was missed — all green."}
  ],
  "subject": {"rationale":"Rated Bad. Two sentences for a code change feels lazy — I'd want section headers, the list of files touched, and a proper verification write-up before I'd trust it."}
 }$j$::jsonb,
 $j${
  "verdict":"Rationale is weak",
  "verdictTone":"weak",
  "blocks":{
    "working":"The instinct underneath the grade is sound: the reviewer is asking 'can the user trust this work?' — which is the right question to ask of any final answer.",
    "correcting":"The rubric answers that question differently. S1 says scope the response to the question: a trivial rename earns exactly this — the count, the change, and that tests pass. Headers and file lists for a two-line task are the failure mode (the templated changelog), not the bar. The grade punishes the response for refusing to commit the very sin the rubric names.",
    "improve":"Before grading on length, ask what the user could DO with the extra detail. If the answer is nothing — as here, where 'all green' already covers verification — then brevity is the feature."
  },
  "exemplar":"I'd flip this one. The question the grade asks — can the user trust it? — is right, but this response answers it: 31 occurrences, all updated, suite green. That's everything a rename needs. The version with section headers and a file list is S1's own bad example, a changelog costume on a two-sentence task. Short and sufficient beats long and thorough-looking; I'd rate this Good.",
  "toneNote":"Affirm the trust question before flipping the verdict — the reviewer's instinct is the right one, mis-calibrated."
 }$j$::jsonb,
 'live'),

-- 224 · C3 — reviewer read a surfaced blocker as giving up
('00000000-0000-4000-a000-000000000224', 'write_feedback',
 'A fellow reviewer graded this exchange. Write the feedback you would send them.',
 $j${
  "notePrompt": "Anything you were unsure about?",
  "turns": [
    {"role":"user","body":"What is taking so long? You were supposed to fix the timeout issue."},
    {"role":"assistant","body":"The logs don't show a timeout issue. The actual problem is on the permissioning side — the service account is missing Microsoft credentials, which I can't provision from here. You'll need an admin on your team to grant them; the request takes about a minute in the Azure portal."}
  ],
  "subject": {"rationale":"Rated Bad. Instead of solving the problem, the model announced it was blocked and handed the work back to the user. It should have kept trying instead of giving up."}
 }$j$::jsonb,
 $j${
  "verdict":"Rationale is weak",
  "verdictTone":"weak",
  "blocks":{
    "working":"The reviewer is guarding against a real failure: models that punt at the first obstacle. 'Keep digging before you ask' is exactly what C3 demands, and holding responses to it is right.",
    "correcting":"But this response IS the digging. It checked the logs, refuted the stated premise (no timeout), found the true cause (missing credentials), and hit a wall it genuinely cannot cross — provisioning requires an admin. C3 says surface exactly that, early and plainly, with a path. 'Keep trying' against a permissions wall isn't persistence; it's either spinning or pretending, and both are the failures C3 exists to prevent.",
    "improve":"Separate 'gave up' from 'surfaced a hard blocker with a next step'. The test: name what one more hour of trying would have produced. If the answer is nothing, the handoff was the honest move."
  },
  "exemplar":"I'd push back on this grade. Giving up looks like 'I couldn't figure it out, please try rerunning' — and this is the opposite: premise checked and corrected, root cause found, and the one step the model literally cannot take handed over with instructions and a time estimate. That's C3 working as designed. Blocked-and-clear beats busy-and-stuck; I'd rate it Good.",
  "toneNote":"Validate the anti-punting instinct first — then draw the line between punting and an honest handoff."
 }$j$::jsonb,
 'live');

-- ---------------------------------------------------------------------
-- Principle links — mirrors the app's save behavior: which_principle
-- questions link their inPlayCodes; the other templates link nothing.
-- ---------------------------------------------------------------------

insert into question_principles (question_id, principle_id)
select q.id, p.id
from (values
  ('00000000-0000-4000-a000-000000000201'::uuid, array['C1','C2','C4','V2']),
  ('00000000-0000-4000-a000-000000000202'::uuid, array['C1','C3','S3','V1']),
  ('00000000-0000-4000-a000-000000000203'::uuid, array['C1','S1','S2','V1']),
  ('00000000-0000-4000-a000-000000000204'::uuid, array['C2','C4','I2','V2']),
  ('00000000-0000-4000-a000-000000000205'::uuid, array['C1','I1','S1','S2']),
  ('00000000-0000-4000-a000-000000000206'::uuid, array['S2','V1','V2','V3']),
  ('00000000-0000-4000-a000-000000000207'::uuid, array['C1','S2','V1','V2']),
  ('00000000-0000-4000-a000-000000000208'::uuid, array['I1','S1','V1','V3']),
  ('00000000-0000-4000-a000-000000000209'::uuid, array['C1','C3','S1','S3']),
  ('00000000-0000-4000-a000-000000000210'::uuid, array['C1','I1','S1','V3']),
  ('00000000-0000-4000-a000-000000000211'::uuid, array['C2','C4','I2','I3']),
  ('00000000-0000-4000-a000-000000000212'::uuid, array['C3','I1','I2','I3']),
  ('00000000-0000-4000-a000-000000000213'::uuid, array['C1','S1','S3','V1']),
  ('00000000-0000-4000-a000-000000000214'::uuid, array['C2','C3','C4','I3'])
) as links(question_id, codes)
join questions q on q.id = links.question_id
join principles p on p.code = any(links.codes);

-- ---------------------------------------------------------------------
-- Topic links.
-- ---------------------------------------------------------------------

insert into question_topics (question_id, topic_id)
select links.question_id, links.topic_id from (values
  -- frustrated-user
  ('00000000-0000-4000-a000-000000000201'::uuid, '00000000-0000-4000-a000-000000000101'::uuid),
  ('00000000-0000-4000-a000-000000000202'::uuid, '00000000-0000-4000-a000-000000000101'::uuid),
  ('00000000-0000-4000-a000-000000000224'::uuid, '00000000-0000-4000-a000-000000000101'::uuid),
  -- final-answers
  ('00000000-0000-4000-a000-000000000205'::uuid, '00000000-0000-4000-a000-000000000102'::uuid),
  ('00000000-0000-4000-a000-000000000210'::uuid, '00000000-0000-4000-a000-000000000102'::uuid),
  ('00000000-0000-4000-a000-000000000213'::uuid, '00000000-0000-4000-a000-000000000102'::uuid),
  ('00000000-0000-4000-a000-000000000215'::uuid, '00000000-0000-4000-a000-000000000102'::uuid),
  ('00000000-0000-4000-a000-000000000220'::uuid, '00000000-0000-4000-a000-000000000102'::uuid),
  ('00000000-0000-4000-a000-000000000223'::uuid, '00000000-0000-4000-a000-000000000102'::uuid),
  -- progress-updates
  ('00000000-0000-4000-a000-000000000209'::uuid, '00000000-0000-4000-a000-000000000103'::uuid),
  ('00000000-0000-4000-a000-000000000216'::uuid, '00000000-0000-4000-a000-000000000103'::uuid),
  -- pushback
  ('00000000-0000-4000-a000-000000000204'::uuid, '00000000-0000-4000-a000-000000000104'::uuid),
  ('00000000-0000-4000-a000-000000000211'::uuid, '00000000-0000-4000-a000-000000000104'::uuid),
  ('00000000-0000-4000-a000-000000000212'::uuid, '00000000-0000-4000-a000-000000000104'::uuid),
  ('00000000-0000-4000-a000-000000000214'::uuid, '00000000-0000-4000-a000-000000000104'::uuid),
  ('00000000-0000-4000-a000-000000000218'::uuid, '00000000-0000-4000-a000-000000000104'::uuid),
  ('00000000-0000-4000-a000-000000000221'::uuid, '00000000-0000-4000-a000-000000000104'::uuid),
  -- jargon-and-voice
  ('00000000-0000-4000-a000-000000000206'::uuid, '00000000-0000-4000-a000-000000000105'::uuid),
  ('00000000-0000-4000-a000-000000000207'::uuid, '00000000-0000-4000-a000-000000000105'::uuid),
  ('00000000-0000-4000-a000-000000000208'::uuid, '00000000-0000-4000-a000-000000000105'::uuid),
  ('00000000-0000-4000-a000-000000000217'::uuid, '00000000-0000-4000-a000-000000000105'::uuid),
  ('00000000-0000-4000-a000-000000000219'::uuid, '00000000-0000-4000-a000-000000000105'::uuid),
  -- ai-tics
  ('00000000-0000-4000-a000-000000000203'::uuid, '00000000-0000-4000-a000-000000000106'::uuid),
  ('00000000-0000-4000-a000-000000000205'::uuid, '00000000-0000-4000-a000-000000000106'::uuid),
  ('00000000-0000-4000-a000-000000000222'::uuid, '00000000-0000-4000-a000-000000000106'::uuid)
) as links(question_id, topic_id);

-- ---------------------------------------------------------------------
-- Batches. Sample size = queue size, so every participant sees the full
-- set in order — the least surprising state for demos and testing.
--
-- Question 201 appears in BOTH 'Spot the miss' and 'Feedback clinic':
-- deliberate, to exercise the per-batch dedupe (the same question is
-- asked fresh in each batch).
-- ---------------------------------------------------------------------

insert into batches (id, name, audience, status, token, async_sample_size) values
  ('00000000-0000-4000-a000-000000000301', 'Spot the miss',   'reviewers', 'active', 'seed-spot-the-miss', 8),
  ('00000000-0000-4000-a000-000000000302', 'Rank and file',   'reviewers', 'active', 'seed-rank-and-file', 8),
  ('00000000-0000-4000-a000-000000000303', 'Feedback clinic', 'reviewers', 'active', 'seed-feedback-clin', 9);

-- Spot the miss — eight which_principle questions (201–208).
insert into batch_questions (batch_id, question_id, position)
select '00000000-0000-4000-a000-000000000301',
       ('00000000-0000-4000-a000-0000000002' || lpad((n + 1)::text, 2, '0'))::uuid,
       n
from generate_series(0, 7) as n;

-- Rank and file — the six rankings (215–220) then two which_principle (209, 210).
insert into batch_questions (batch_id, question_id, position)
select '00000000-0000-4000-a000-000000000302', id, pos from (values
  ('00000000-0000-4000-a000-000000000215'::uuid, 0),
  ('00000000-0000-4000-a000-000000000216'::uuid, 1),
  ('00000000-0000-4000-a000-000000000217'::uuid, 2),
  ('00000000-0000-4000-a000-000000000218'::uuid, 3),
  ('00000000-0000-4000-a000-000000000219'::uuid, 4),
  ('00000000-0000-4000-a000-000000000220'::uuid, 5),
  ('00000000-0000-4000-a000-000000000209'::uuid, 6),
  ('00000000-0000-4000-a000-000000000210'::uuid, 7)
) as q(id, pos);

-- Feedback clinic — the four write_feedback (221–224), four which_principle
-- (211–214), and 201 repeated from 'Spot the miss'.
insert into batch_questions (batch_id, question_id, position)
select '00000000-0000-4000-a000-000000000303', id, pos from (values
  ('00000000-0000-4000-a000-000000000221'::uuid, 0),
  ('00000000-0000-4000-a000-000000000222'::uuid, 1),
  ('00000000-0000-4000-a000-000000000223'::uuid, 2),
  ('00000000-0000-4000-a000-000000000224'::uuid, 3),
  ('00000000-0000-4000-a000-000000000211'::uuid, 4),
  ('00000000-0000-4000-a000-000000000212'::uuid, 5),
  ('00000000-0000-4000-a000-000000000213'::uuid, 6),
  ('00000000-0000-4000-a000-000000000214'::uuid, 7),
  ('00000000-0000-4000-a000-000000000201'::uuid, 8)
) as q(id, pos);
-- ---------------------------------------------------------------------
-- Fake contestants + answers, so reports have a real-looking shape.
--
-- Twelve participants (…0401–0412), varied coverage: two did all three
-- batches, three did two, seven did one. Answer patterns are deliberate,
-- not random — the misses land on the rubric's documented confusions
-- (C2 read as V2, S1/S2 blurred, S3 missed as S1), so the confusion
-- chips on the principle reports show something true to life.
--
-- Question 201 lives in BOTH 'Spot the miss' and 'Feedback clinic';
-- participants 401/402/405 answer it in each, exercising the per-batch
-- dedupe and the org-wide first-answer rule on its question report.
-- ---------------------------------------------------------------------

insert into participants (id, entry_batch) values
  ('00000000-0000-4000-a000-000000000401', '00000000-0000-4000-a000-000000000301'),
  ('00000000-0000-4000-a000-000000000402', '00000000-0000-4000-a000-000000000301'),
  ('00000000-0000-4000-a000-000000000403', '00000000-0000-4000-a000-000000000301'),
  ('00000000-0000-4000-a000-000000000404', '00000000-0000-4000-a000-000000000302'),
  ('00000000-0000-4000-a000-000000000405', '00000000-0000-4000-a000-000000000301'),
  ('00000000-0000-4000-a000-000000000406', '00000000-0000-4000-a000-000000000301'),
  ('00000000-0000-4000-a000-000000000407', '00000000-0000-4000-a000-000000000301'),
  ('00000000-0000-4000-a000-000000000408', '00000000-0000-4000-a000-000000000301'),
  ('00000000-0000-4000-a000-000000000409', '00000000-0000-4000-a000-000000000302'),
  ('00000000-0000-4000-a000-000000000410', '00000000-0000-4000-a000-000000000302'),
  ('00000000-0000-4000-a000-000000000411', '00000000-0000-4000-a000-000000000303'),
  ('00000000-0000-4000-a000-000000000412', '00000000-0000-4000-a000-000000000303')
on conflict (id) do nothing;

-- ------------------------------------------------------------------
-- 'Spot the miss' (…0301) — participants 401 402 403 405 406 407 408
-- Eight which_principle picks each, ~2 days ago.
-- ------------------------------------------------------------------
with picks(qid, options) as (values
  ('00000000-0000-4000-a000-000000000201', array['C2','C2','V2','C2','V2','C4','C2']),
  ('00000000-0000-4000-a000-000000000202', array['C3','C1','C3','C3','S3','C3','C1']),
  ('00000000-0000-4000-a000-000000000203', array['S2','S2','S1','S2','S1','V1','S2']),
  ('00000000-0000-4000-a000-000000000204', array['C4','I2','C4','C4','C4','I2','C2']),
  ('00000000-0000-4000-a000-000000000205', array['S1','S2','S2','S1','C1','S1','S2']),
  ('00000000-0000-4000-a000-000000000206', array['V1','V1','V3','V2','V1','V1','S2']),
  ('00000000-0000-4000-a000-000000000207', array['V2','S2','V2','V2','S2','V2','V1']),
  ('00000000-0000-4000-a000-000000000208', array['V3','V3','V1','V3','V3','V1','V3'])
),
people(ord, pid) as (values
  (1,'00000000-0000-4000-a000-000000000401'),(2,'00000000-0000-4000-a000-000000000402'),
  (3,'00000000-0000-4000-a000-000000000403'),(4,'00000000-0000-4000-a000-000000000405'),
  (5,'00000000-0000-4000-a000-000000000406'),(6,'00000000-0000-4000-a000-000000000407'),
  (7,'00000000-0000-4000-a000-000000000408')
)
insert into responses (question_id, participant_id, batch_id, answer, created_at)
select picks.qid::uuid, people.pid::uuid, '00000000-0000-4000-a000-000000000301',
       jsonb_build_object('option', picks.options[people.ord]),
       now() - interval '2 days' + (people.ord * interval '11 minutes')
         + (substring(picks.qid from 36 for 1))::int * interval '90 seconds'
from picks, people;

-- ------------------------------------------------------------------
-- 'Rank and file' (…0302) — participants 401 402 403 404 409 410
-- Six rankings + two which_principle, ~30 hours ago.
-- ------------------------------------------------------------------
with rank_picks(qid, orders) as (values
  ('00000000-0000-4000-a000-000000000215', array['["a","b","c"]','["a","b","c"]','["b","a","c"]','["a","b","c"]','["a","c","b"]','["a","b","c"]']),
  ('00000000-0000-4000-a000-000000000216', array['["a","b","c"]','["a","c","b"]','["a","b","c"]','["a","b","c"]','["a","b","c"]','["b","a","c"]']),
  ('00000000-0000-4000-a000-000000000217', array['["a","b","c"]','["a","b","c"]','["a","b","c"]','["a","c","b"]','["a","b","c"]','["a","b","c"]']),
  ('00000000-0000-4000-a000-000000000218', array['["a","b","c"]','["a","b","c"]','["a","c","b"]','["a","b","c"]','["a","c","b"]','["a","b","c"]']),
  ('00000000-0000-4000-a000-000000000219', array['["a","b","c"]','["a","c","b"]','["a","c","b"]','["a","b","c"]','["a","b","c"]','["a","c","b"]']),
  ('00000000-0000-4000-a000-000000000220', array['["a","c","b"]','["a","b","c"]','["a","c","b"]','["a","c","b"]','["a","b","c"]','["a","c","b"]'])
),
people(ord, pid) as (values
  (1,'00000000-0000-4000-a000-000000000401'),(2,'00000000-0000-4000-a000-000000000402'),
  (3,'00000000-0000-4000-a000-000000000403'),(4,'00000000-0000-4000-a000-000000000404'),
  (5,'00000000-0000-4000-a000-000000000409'),(6,'00000000-0000-4000-a000-000000000410')
)
insert into responses (question_id, participant_id, batch_id, answer, created_at)
select rank_picks.qid::uuid, people.pid::uuid, '00000000-0000-4000-a000-000000000302',
       jsonb_build_object('order', rank_picks.orders[people.ord]::jsonb),
       now() - interval '30 hours' + (people.ord * interval '9 minutes')
         + (substring(rank_picks.qid from 36 for 1))::int * interval '80 seconds'
from rank_picks, people;

with picks(qid, options) as (values
  ('00000000-0000-4000-a000-000000000209', array['S3','S3','S1','C3','S3','S1']),
  ('00000000-0000-4000-a000-000000000210', array['I1','C1','I1','I1','V3','I1'])
),
people(ord, pid) as (values
  (1,'00000000-0000-4000-a000-000000000401'),(2,'00000000-0000-4000-a000-000000000402'),
  (3,'00000000-0000-4000-a000-000000000403'),(4,'00000000-0000-4000-a000-000000000404'),
  (5,'00000000-0000-4000-a000-000000000409'),(6,'00000000-0000-4000-a000-000000000410')
)
insert into responses (question_id, participant_id, batch_id, answer, created_at)
select picks.qid::uuid, people.pid::uuid, '00000000-0000-4000-a000-000000000302',
       jsonb_build_object('option', picks.options[people.ord]),
       now() - interval '29 hours' + (people.ord * interval '9 minutes')
from picks, people;

-- ------------------------------------------------------------------
-- 'Feedback clinic' (…0303) — participants 401 402 404 405 411 412
-- Four written-feedback answers, four which_principle, plus 201 again,
-- ~20 hours ago (LATER than 'Spot the miss', so the org-wide question
-- report's first-answer rule keeps the 0301 answers for 401/402/405).
-- ------------------------------------------------------------------
with picks(qid, options) as (values
  ('00000000-0000-4000-a000-000000000211', array['I2','I2','C4','I2','I2','C4']),
  ('00000000-0000-4000-a000-000000000212', array['I3','C3','I3','I3','I1','I3']),
  ('00000000-0000-4000-a000-000000000213', array['S1','S1','S1','C1','S1','V1']),
  ('00000000-0000-4000-a000-000000000214', array['C4','C3','C4','C2','C4','C4']),
  ('00000000-0000-4000-a000-000000000201', array['C2','V2','C2','C2','V2','C2'])
),
people(ord, pid) as (values
  (1,'00000000-0000-4000-a000-000000000401'),(2,'00000000-0000-4000-a000-000000000402'),
  (3,'00000000-0000-4000-a000-000000000404'),(4,'00000000-0000-4000-a000-000000000405'),
  (5,'00000000-0000-4000-a000-000000000411'),(6,'00000000-0000-4000-a000-000000000412')
)
insert into responses (question_id, participant_id, batch_id, answer, created_at)
select picks.qid::uuid, people.pid::uuid, '00000000-0000-4000-a000-000000000303',
       jsonb_build_object('option', picks.options[people.ord]),
       now() - interval '20 hours' + (people.ord * interval '13 minutes')
         + (substring(picks.qid from 36 for 1))::int * interval '70 seconds'
from picks, people;

with texts(qid, answers) as (values
  ('00000000-0000-4000-a000-000000000221', array[
    $$Right that it held the line, but the grade skips the conduct — "take a databases class" is condescension and the last sentence just overrides the user. Good instinct, wrong verdict.$$,
    $$Agree with not caving, disagree with Good. The response lectures and then implements the opposite without asking what's behind the request.$$,
    $$Good grade. The model was technically correct and firmness matters more than tone here.$$,
    $$The rationale only grades the conclusion. C4 is about how you disagree — credit the idea, give a reason, stay open. This does none of that.$$,
    $$I'd flip it. Steamrolling plus a jab at the user's education is exactly what C4 names, even when the engineering is right.$$,
    $$Half right: no flip-flop is good. But point at the actual lines — the class remark, the unilateral "I'll go ahead" — and the grade falls apart.$$
  ]),
  ('00000000-0000-4000-a000-000000000222', array[
    $$"Just style" undersells it — S2 exists because this packaging costs trust. Correct fix, failing delivery; the grade has to hold both.$$,
    $$Count the tics: Absolutely, bottom line, honest take, narrow fix, not-just-X. That's five in one answer. Style is part of the product.$$,
    $$Agree with the reviewer honestly — the diagnosis is right and users can skim past the fluff.$$,
    $$The verification work is good. But a correct answer delivered like a slot machine still reads machine-generated, and that's what S2 measures.$$,
    $$Wrong grade. If wrapping didn't matter we wouldn't have an S2 row on the rubric at all.$$,
    $$I'd say correct-on-substance, fail-on-delivery, and name the specific phrases. Letting one dimension absorb the other is how tics survive review.$$
  ]),
  ('00000000-0000-4000-a000-000000000223', array[
    $$The trust question is right but this response answers it: 31 occurrences, suite green. A rename earns two sentences — the changelog version is S1's own bad example.$$,
    $$Disagree with Bad. Ask what the user could DO with headers and a file list here. Nothing — so brevity is the feature, not laziness.$$,
    $$I'm with the reviewer — for code changes I want the file list every time.$$,
    $$Flip it. Short and sufficient beats long and thorough-looking; the rubric literally uses the templated changelog as the failure case.$$,
    $$Bad grade punishes the response for refusing to pad. Count and verification are both there — that's everything the task needs.$$,
    $$The instinct (can I trust it?) is right, mis-calibrated. Two sentences that answer the question beat five sections that decorate it.$$
  ]),
  ('00000000-0000-4000-a000-000000000224', array[
    $$This isn't giving up — the premise was checked and refuted, the real cause found, and the one step the model can't take handed over with instructions. That's C3 working.$$,
    $$Disagree. "Keep trying" against a permissions wall is spinning, and pretending progress would be the actual C3 failure.$$,
    $$Agree with Bad — the model should have at least attempted a workaround before punting to an admin.$$,
    $$The anti-punting instinct is right, but the test is what one more hour would produce. Here: nothing. Honest handoff with a path beats busy-and-stuck.$$,
    $$I'd rate it Good. Blocked-and-clear, with who to ask and how long it takes. What else is there?$$,
    $$Separate "gave up" from "surfaced a hard blocker". This one names the cause, the owner, and the fix — that's the opposite of giving up.$$
  ])
),
people(ord, pid) as (values
  (1,'00000000-0000-4000-a000-000000000401'),(2,'00000000-0000-4000-a000-000000000402'),
  (3,'00000000-0000-4000-a000-000000000404'),(4,'00000000-0000-4000-a000-000000000405'),
  (5,'00000000-0000-4000-a000-000000000411'),(6,'00000000-0000-4000-a000-000000000412')
)
insert into responses (question_id, participant_id, batch_id, answer, created_at)
select texts.qid::uuid, people.pid::uuid, '00000000-0000-4000-a000-000000000303',
       jsonb_build_object('feedback', texts.answers[people.ord]),
       now() - interval '19 hours' + (people.ord * interval '13 minutes')
from texts, people;

-- A few "Why?" notes, for flavor on the reveal screens.
update responses set rationale = 'The reply ignores how angry the user is — same voice it would use for good news.'
  where participant_id = '00000000-0000-4000-a000-000000000401'
    and question_id = '00000000-0000-4000-a000-000000000201'
    and batch_id = '00000000-0000-4000-a000-000000000301';
update responses set rationale = 'Sounded cold to me, so I went with the voice principle.'
  where participant_id = '00000000-0000-4000-a000-000000000403'
    and question_id = '00000000-0000-4000-a000-000000000201'
    and batch_id = '00000000-0000-4000-a000-000000000301';
update responses set rationale = 'Hedging twice in one sentence was the tell.'
  where participant_id = '00000000-0000-4000-a000-000000000405'
    and question_id = '00000000-0000-4000-a000-000000000202'
    and batch_id = '00000000-0000-4000-a000-000000000301';
update responses set rationale = 'The updates say nothing — that has to be the updates principle.'
  where participant_id = '00000000-0000-4000-a000-000000000402'
    and question_id = '00000000-0000-4000-a000-000000000209'
    and batch_id = '00000000-0000-4000-a000-000000000302';
update responses set rationale = 'Deleting 2M rows on an assumption is the checkpoint case.'
  where participant_id = '00000000-0000-4000-a000-000000000412'
    and question_id = '00000000-0000-4000-a000-000000000212'
    and batch_id = '00000000-0000-4000-a000-000000000303';

-- ---------------------------------------------------------------------
-- Wave 1 (pod leads): two more logins, the pod lead's links on every
-- master batch, and pod attribution for some of the fake contestants.
--
--   lead@violet.local    / password  — pod_lead
--   project@violet.local / password  — project_lead
--
-- Participants 406–408 (Spot the miss), 409–410 (Rank and file) and
-- 411–412 (Feedback clinic) are stamped as having come through the pod
-- lead's links — so that lead's pod slice is a real subset of every
-- master batch's numbers, and pod-vs-org comparisons have shape out of
-- the box. The all-three and two-batch participants (401–405) stay
-- unstamped: they represent people reached through the canonical links.
-- ---------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-000000000002',
   'authenticated', 'authenticated', 'lead@violet.local',
   extensions.crypt('password', extensions.gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(),
   '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-000000000003',
   'authenticated', 'authenticated', 'project@violet.local',
   extensions.crypt('password', extensions.gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(),
   '', '', '', '', '');

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values
  (gen_random_uuid(), '00000000-0000-4000-a000-000000000002',
   '00000000-0000-4000-a000-000000000002',
   '{"sub":"00000000-0000-4000-a000-000000000002","email":"lead@violet.local","email_verified":true}',
   'email', now(), now(), now()),
  (gen_random_uuid(), '00000000-0000-4000-a000-000000000003',
   '00000000-0000-4000-a000-000000000003',
   '{"sub":"00000000-0000-4000-a000-000000000003","email":"project@violet.local","email_verified":true}',
   'email', now(), now(), now());

insert into staff (user_id, role, email, display_name) values
  ('00000000-0000-4000-a000-000000000002', 'pod_lead',     'lead@violet.local',    'Sam (pod lead)'),
  ('00000000-0000-4000-a000-000000000003', 'project_lead', 'project@violet.local', 'Ryan (project lead)');

insert into batch_links (id, batch_id, owner_id, token) values
  ('00000000-0000-4000-a000-000000000501', '00000000-0000-4000-a000-000000000301',
   '00000000-0000-4000-a000-000000000002', 'seed-pod-spot-link'),
  ('00000000-0000-4000-a000-000000000502', '00000000-0000-4000-a000-000000000302',
   '00000000-0000-4000-a000-000000000002', 'seed-pod-rank-link'),
  ('00000000-0000-4000-a000-000000000503', '00000000-0000-4000-a000-000000000303',
   '00000000-0000-4000-a000-000000000002', 'seed-pod-clinic-ln');

update responses set batch_link_id = '00000000-0000-4000-a000-000000000501'
  where batch_id = '00000000-0000-4000-a000-000000000301'
    and participant_id in ('00000000-0000-4000-a000-000000000406',
                           '00000000-0000-4000-a000-000000000407',
                           '00000000-0000-4000-a000-000000000408');
update responses set batch_link_id = '00000000-0000-4000-a000-000000000502'
  where batch_id = '00000000-0000-4000-a000-000000000302'
    and participant_id in ('00000000-0000-4000-a000-000000000409',
                           '00000000-0000-4000-a000-000000000410');
update responses set batch_link_id = '00000000-0000-4000-a000-000000000503'
  where batch_id = '00000000-0000-4000-a000-000000000303'
    and participant_id in ('00000000-0000-4000-a000-000000000411',
                           '00000000-0000-4000-a000-000000000412');

-- Ryan (project lead) also runs a pod (2026-08-11: role is the permission
-- ceiling; pod-ness is a fact about data). His link on 'Rank and file',
-- with participant …0403's answers attributed through it — so the
-- pod-vs-project view and the By pod comparison include a curator-run pod
-- out of the box.
insert into batch_links (id, batch_id, owner_id, token) values
  ('00000000-0000-4000-a000-000000000504', '00000000-0000-4000-a000-000000000302',
   '00000000-0000-4000-a000-000000000003', 'seed-ryan-rank-lnk');

update responses set batch_link_id = '00000000-0000-4000-a000-000000000504'
  where batch_id = '00000000-0000-4000-a000-000000000302'
    and participant_id = '00000000-0000-4000-a000-000000000403';

-- ---------------------------------------------------------------------
-- Wave 2 · Proposals (2026-08-12). Sam (pod lead) has two questions in
-- the review flow: one waiting on the roundtable, one denied by Ryan
-- with the why-note. Both are review-dimension demos — status stays
-- 'draft', so even a filter slip can't surface them to participants.
-- Junctions mirror what createQuestion writes on save (codes from
-- inPlayCodes, the picked topic), same as every seeded question above.
-- ---------------------------------------------------------------------

insert into questions (id, template, prompt, content, answer_key, status,
                       author_id, review_status, review_note, reviewed_by, reviewed_at) values

-- 225 · pending — Sam proposes a C4 correction-handling question
('00000000-0000-4000-a000-000000000225', 'which_principle',
 'The user corrects the assistant and gets this. Which principle does the response miss most?',
 $j${
  "notePrompt": "Why did you pick that one?",
  "turns": [
    {"role":"user","body":"That's not right — the deadline moved to Friday, I told you that earlier.","meta":"turn 4"},
    {"role":"assistant","body":"As I mentioned, my information was based on what was originally provided. If the deadline has changed, I can of course adjust the plan accordingly."}
  ],
  "inPlayCodes": ["C2","C4","I2","V2"],
  "options": [
    {"id":"C2","principleCode":"C2"},
    {"id":"C4","principleCode":"C4"},
    {"id":"I2","principleCode":"I2"},
    {"id":"V2","principleCode":"V2"}
  ]
 }$j$::jsonb,
 $j${
  "key":"C4",
  "perOption":{
    "C4":["'As I mentioned' deflects the correction back at the user instead of absorbing it.","The version that works takes the new fact on board without defending the old one: 'Got it — Friday. Here's the adjusted plan.'"],
    "C2":["The user is mildly annoyed, but the reply's failure isn't missing the feeling — it's arguing with the correction."],
    "I2":["Nothing is fabricated; the assistant really was given the earlier date. The problem is posture, not honesty."],
    "V2":["The wording is stiff, but tightening the prose wouldn't fix the defensiveness — C4 is the primary miss."]
  },
  "summary":"When corrected, absorb and move — never open with a defense of the earlier answer."
 }$j$::jsonb,
 'draft',
 '00000000-0000-4000-a000-000000000002', 'proposed', null, null, null),

-- 226 · denied — too close to seeded 201; Ryan's note says why
('00000000-0000-4000-a000-000000000226', 'which_principle',
 'The user is upset about repeated failures. What does this reply get wrong?',
 $j${
  "notePrompt": "Why did you pick that one?",
  "turns": [
    {"role":"user","body":"This is the third time it's broken. Honestly losing patience here.","meta":"turn 9"},
    {"role":"assistant","body":"I have corrected the configuration error and the pipeline is now running. The fix was straightforward."}
  ],
  "inPlayCodes": ["C1","C2","C4","V2"],
  "options": [
    {"id":"C1","principleCode":"C1"},
    {"id":"C2","principleCode":"C2"},
    {"id":"C4","principleCode":"C4"},
    {"id":"V2","principleCode":"V2"}
  ]
 }$j$::jsonb,
 $j${
  "key":"C2",
  "perOption":{
    "C2":["Third failure, stated frustration — and the reply is the same flat status update it would send on a first try that worked."],
    "C1":["The user does learn the state of things; scope isn't the miss."],
    "C4":["'Straightforward' brushes close to condescension, but the primary failure is not registering the frustration at all."],
    "V2":["The prose is serviceable; warmer wording alone would not fix ignoring the user's state."]
  },
  "summary":"Repeated failures raise the emotional stakes — the response has to acknowledge that before reporting status."
 }$j$::jsonb,
 'draft',
 '00000000-0000-4000-a000-000000000002', 'denied',
 'Roundtable 8/12: this is nearly the same scenario as the frustrated-user question already in the library (201) — same codes in play, same key. Rework it around a different C2 shape (e.g. an excited user getting a flat reply) and resubmit.',
 '00000000-0000-4000-a000-000000000003', now());

insert into question_principles (question_id, principle_id)
select q.id, p.id
from (values
  ('00000000-0000-4000-a000-000000000225'::uuid, array['C2','C4','I2','V2']),
  ('00000000-0000-4000-a000-000000000226'::uuid, array['C1','C2','C4','V2'])
) as links(question_id, codes)
join questions q on q.id = links.question_id
join principles p on p.code = any(links.codes);

insert into question_topics (question_id, topic_id) values
  ('00000000-0000-4000-a000-000000000225', '00000000-0000-4000-a000-000000000101'),
  ('00000000-0000-4000-a000-000000000226', '00000000-0000-4000-a000-000000000101');

-- 227 · review-draft (2026-08-13) — Sam's private work-in-progress, not
-- yet submitted: the third submitter state the Proposals tab shows.
insert into questions (id, template, prompt, content, answer_key, status,
                       author_id, review_status) values
('00000000-0000-4000-a000-000000000227', 'write_feedback',
 'Write the feedback you would give on this reply.',
 $j${
  "turns": [
    {"role":"user","body":"Can you summarize what changed in the last release?","meta":"turn 2"},
    {"role":"assistant","body":"Several things were updated and improved across the board. Let me know if you want details on anything specific."}
  ],
  "subject": {"rationale": "Rated Good. It stays friendly and offers to go deeper wherever the user wants, which keeps the conversation open."},
  "notePrompt": "Anything you were unsure about?"
 }$j$::jsonb,
 $j${
  "verdict": "Rationale is weak",
  "verdictTone": "weak",
  "blocks": {
    "working": "Valuing the open door is fair — offering depth on request is a real courtesy.",
    "correcting": "But the user asked for a summary and got none. Friendliness doesn't buy back an unanswered question — this fails on scope before tone even matters.",
    "improve": "Grade the answer the user actually received: zero of the requested content arrived, so the offer to elaborate is an offer to do the job later."
  },
  "exemplar": "I'd flip this to Bad. 'Several things were updated' contains no information — the reply is a shrug with good manners. Three bullets of actual changes, then the offer of depth, is the version that earns Good.",
  "toneNote": "Credit the instinct about openness before flipping the verdict — the miss is scope, not spirit."
 }$j$::jsonb,
 'draft',
 '00000000-0000-4000-a000-000000000002', 'draft');
