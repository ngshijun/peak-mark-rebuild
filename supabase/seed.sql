-- =============================================================================
-- CLAVIS STAGING SEED DATA
-- =============================================================================
-- Run against the staging database via:
--   Supabase Dashboard > SQL Editor > paste & run
--   OR: psql $DATABASE_URL -f supabase/seed.sql
--
-- This script is idempotent — safe to run multiple times (ON CONFLICT DO NOTHING).
-- It runs as postgres superuser, bypassing RLS.
--
-- Reference data (grade levels, subjects, topics, sub-topics, pets) uses the
-- same UUIDs as production so that staging mirrors the real curriculum.
-- Questions are a small representative sample — prod has 1,200+ questions.
-- =============================================================================

BEGIN;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. SUBSCRIPTION PLANS                                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Matches prod pricing and features. stripe_price_id is omitted (env-specific).

INSERT INTO public.subscription_plans (id, name, price_monthly, sessions_per_day, features, is_highlighted)
VALUES
  ('core', 'Core',  0.00,  3,  '["3 daily practice sessions", "All subjects & topics", "Track your learning progress", "Collect & evolve cute pets", "Compete on the weekly leaderboard"]'::jsonb, false),
  ('plus', 'Plus',  9.99,  10, '["10 daily practice sessions", "All subjects & topics", "Review mistakes with full explanations", "Track your learning progress", "Collect & evolve cute pets", "Compete on the weekly leaderboard"]'::jsonb, false),
  ('pro',  'Pro',   19.99, 20, '["20 daily practice sessions", "All subjects & topics", "Review mistakes with full explanations", "AI-powered feedback after every session", "Track your learning progress", "Collect & evolve cute pets", "Compete on the weekly leaderboard"]'::jsonb, true),
  ('max',  'Max',   29.99, 30, '["30 daily practice sessions", "All subjects & topics", "Review mistakes with full explanations", "Collect & evolve cute pets", "Compete on the weekly leaderboard", "AI-powered feedback after every session", "Priority email support"]'::jsonb, false)
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. TEST USERS                                                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- All test accounts use password: Test1234!
-- Admin:    admin@clavis.test
-- Student:  student@clavis.test
-- Student2: student2@clavis.test
-- Parent:   parent@clavis.test

-- auth.users
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated',
    'admin@clavis.test',
    crypt('Test1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Admin User"}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated',
    'student@clavis.test',
    crypt('Test1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Alice Tan"}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated',
    'student2@clavis.test',
    crypt('Test1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Ben Lim"}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000004',
    'authenticated', 'authenticated',
    'parent@clavis.test',
    crypt('Test1234!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Mrs Tan"}'::jsonb,
    now(), now(), '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

-- auth.identities (required for email login)
INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'email',
   jsonb_build_object('sub', '00000000-0000-0000-0000-000000000001', 'email', 'admin@clavis.test'), now(), now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'email',
   jsonb_build_object('sub', '00000000-0000-0000-0000-000000000002', 'email', 'student@clavis.test'), now(), now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'email',
   jsonb_build_object('sub', '00000000-0000-0000-0000-000000000003', 'email', 'student2@clavis.test'), now(), now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'email',
   jsonb_build_object('sub', '00000000-0000-0000-0000-000000000004', 'email', 'parent@clavis.test'), now(), now(), now())
ON CONFLICT DO NOTHING;

-- profiles
INSERT INTO public.profiles (id, name, email, user_type, has_completed_tour)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Admin User',  'admin@clavis.test',    'admin',   true),
  ('00000000-0000-0000-0000-000000000002', 'Alice Tan',   'student@clavis.test',  'student', true),
  ('00000000-0000-0000-0000-000000000003', 'Ben Lim',     'student2@clavis.test', 'student', true),
  ('00000000-0000-0000-0000-000000000004', 'Mrs Tan',     'parent@clavis.test',   'parent',  true)
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. GRADE LEVELS (matches prod — SJKC Year 1–6)                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO public.grade_levels (id, name, display_order)
VALUES
  ('54081b95-ee5f-43d0-8f95-d640d48bb734', '一年级 Year 1',  4),
  ('b4b60a7d-e2b9-49be-b2f9-6a5f54a59e3a', '二年级 Year 2',  6),
  ('9a557264-da34-4c15-912d-8b8c724b5fda', '三年级 Year 3',  7),
  ('7a2bbc12-4ef3-4436-b8a5-9a7bd07116c8', '四年级 Year 4',  8),
  ('e513937d-9509-43eb-b9f8-41f29436385d', '五年级 Year 5',  9),
  ('11b62311-f934-4d88-9bcb-0fa0f112ba27', '六年级 Year 6', 10)
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. STUDENT & PARENT PROFILES                                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO public.student_profiles (id, grade_level_id, xp, coins, food, current_streak, subscription_tier, preferred_language)
VALUES
  -- Alice: Year 1
  ('00000000-0000-0000-0000-000000000002', '54081b95-ee5f-43d0-8f95-d640d48bb734', 150, 50, 5, 2, 'core', 'en'),
  -- Ben: Year 2
  ('00000000-0000-0000-0000-000000000003', 'b4b60a7d-e2b9-49be-b2f9-6a5f54a59e3a', 80,  30, 2, 1, 'core', 'en')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.parent_profiles (id)
VALUES ('00000000-0000-0000-0000-000000000004')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. SUBJECTS (4 per grade × 6 grades = 24)                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO public.subjects (id, grade_level_id, name, display_order)
VALUES
  -- 一年级 Year 1
  ('9d077a3d-b673-4760-9c44-218f0f25b2b1', '54081b95-ee5f-43d0-8f95-d640d48bb734', '一年级数学 Year 1 Mathematics',    1),
  ('527e9417-4508-4320-bbcf-71137c503d9b', '54081b95-ee5f-43d0-8f95-d640d48bb734', '一年级科学 Year 1 Science',        2),
  ('2589b6b7-a0e1-488b-9d61-ba4aafd37cd1', '54081b95-ee5f-43d0-8f95-d640d48bb734', '一年级国文 Year 1 Bahasa Melayu',  3),
  ('2f692418-c881-4c00-a236-a6f3fabf12a8', '54081b95-ee5f-43d0-8f95-d640d48bb734', '一年级英文 Year 1 English',        4),
  -- 二年级 Year 2
  ('195106a3-6930-415e-8421-8460c97cbc50', 'b4b60a7d-e2b9-49be-b2f9-6a5f54a59e3a', '二年级数学 Year 2 Mathematics',    1),
  ('c3609ab7-af1b-4a87-b032-94db800cdf6a', 'b4b60a7d-e2b9-49be-b2f9-6a5f54a59e3a', '二年级科学 Year 2 Science',        2),
  ('8fb74fbd-cc5a-4ecf-a274-9639709c47ed', 'b4b60a7d-e2b9-49be-b2f9-6a5f54a59e3a', '二年级国文 Year 2 Bahasa Melayu',  3),
  ('f73988ca-1c4e-4b22-8455-eb32c5c1e1c8', 'b4b60a7d-e2b9-49be-b2f9-6a5f54a59e3a', '二年级英文 Year 2 English',        4),
  -- 三年级 Year 3
  ('3ac69c39-64d4-4d60-8c90-0dea1b2cd39a', '9a557264-da34-4c15-912d-8b8c724b5fda', '三年级数学 Year 3 Mathematics',    1),
  ('c3d0042c-9308-40b8-9b68-781f500a36df', '9a557264-da34-4c15-912d-8b8c724b5fda', '三年级科学 Year 3 Science',        2),
  ('282b813f-a131-4467-bee2-aa6a054250d0', '9a557264-da34-4c15-912d-8b8c724b5fda', '三年级国文 Year 3 Bahasa Melayu',  3),
  ('3e659c9e-b3fe-4046-a3d7-3f16d321e502', '9a557264-da34-4c15-912d-8b8c724b5fda', '三年级英文 Year 3 English',        4),
  -- 四年级 Year 4
  ('63882b88-5103-4bd0-830a-01a45c1fc692', '7a2bbc12-4ef3-4436-b8a5-9a7bd07116c8', '四年级数学 Year 4 Mathematics',    1),
  ('1129720c-0a04-4832-8bbd-a8ffabfd8bc6', '7a2bbc12-4ef3-4436-b8a5-9a7bd07116c8', '四年级科学 Year 4 Science',        2),
  ('ab9488e7-9e4d-4d5a-bb94-d845cf812a80', '7a2bbc12-4ef3-4436-b8a5-9a7bd07116c8', '四年级国文 Year 4 Bahasa Melayu',  3),
  ('b04d8778-7bc9-49b0-9695-30279098e93c', '7a2bbc12-4ef3-4436-b8a5-9a7bd07116c8', '四年级英文 Year 4 English',        4),
  -- 五年级 Year 5
  ('4cc03b8e-fabc-46fe-8e76-5acf91f0ea18', 'e513937d-9509-43eb-b9f8-41f29436385d', '五年级数学 Year 5 Mathematics',    1),
  ('8a3f82ce-c09d-4142-9b50-be8aff758327', 'e513937d-9509-43eb-b9f8-41f29436385d', '五年级科学 Year 5 Science',        2),
  ('870a3904-e38c-45de-819c-fc36bc71535a', 'e513937d-9509-43eb-b9f8-41f29436385d', '五年级国文 Year 5 Bahasa Melayu',  3),
  ('0ad73544-6c28-439a-85d9-534e50304363', 'e513937d-9509-43eb-b9f8-41f29436385d', '五年级英文 Year 5 English',        4),
  -- 六年级 Year 6
  ('e2151d12-9023-4e3b-bab9-a04171c94eed', '11b62311-f934-4d88-9bcb-0fa0f112ba27', '六年级数学 Year 6 Mathematics',    1),
  ('cce8098e-fc9e-4f9c-8455-58e5ed395d3f', '11b62311-f934-4d88-9bcb-0fa0f112ba27', '六年级科学 Year 6 Science',        2),
  ('cd1184a0-9c6a-414f-8f71-c7f5b40328a7', '11b62311-f934-4d88-9bcb-0fa0f112ba27', '六年级国文 Year 6 Bahasa Melayu',  3),
  ('44c895d6-a8e3-4fa3-b407-b7c9d49b70ff', '11b62311-f934-4d88-9bcb-0fa0f112ba27', '六年级英文 Year 6 English',        4)
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. TOPICS (2 per subject = 48)                                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO public.topics (id, subject_id, name, display_order)
VALUES
  -- Y1 Mathematics
  ('bc9fb793-5026-4241-94ac-54ab709f0518', '9d077a3d-b673-4760-9c44-218f0f25b2b1', '第一课 100 以内的整数 Chapter 1',                  1),
  ('f73c2614-9ce0-45eb-81ac-21f7c6575bb5', '9d077a3d-b673-4760-9c44-218f0f25b2b1', '第二课 基本运算 Chapter 2',                        2),
  -- Y1 Science
  ('9a3c031a-3e84-4fa2-bcf8-ea9fabd465b9', '527e9417-4508-4320-bbcf-71137c503d9b', '第一课 科学技能 Chapter 1',                        1),
  ('ac5596ff-df46-44a7-8c07-4ff7567659e4', '527e9417-4508-4320-bbcf-71137c503d9b', '第二课 科学室规则 Chapter 2',                      2),
  -- Y1 Bahasa Melayu
  ('8084e08f-bc38-4237-b246-ad8408a8d1c7', '2589b6b7-a0e1-488b-9d61-ba4aafd37cd1', '理解与应用 Kefahaman',                              1),
  ('8870ae63-523b-41b9-892d-968f00751941', '2589b6b7-a0e1-488b-9d61-ba4aafd37cd1', '语法 Tatabahasa',                                  2),
  -- Y1 English
  ('77aa0a6a-d81f-4be3-8182-eabdf4a8ed93', '2f692418-c881-4c00-a236-a6f3fabf12a8', '理解与词汇 Comprehension and Vocabulary',          1),
  ('89d50d90-f658-458a-9fa3-a61a8a7f32a0', '2f692418-c881-4c00-a236-a6f3fabf12a8', '语法 Grammar',                                    2),
  -- Y2 Mathematics
  ('78ea0dbf-5ba2-4d48-9582-35b24a02fc61', '195106a3-6930-415e-8421-8460c97cbc50', '第一课 1 000 以内的整数 Chapter 1',                1),
  ('53633514-3d1b-4638-888c-e38bcea5ba13', '195106a3-6930-415e-8421-8460c97cbc50', '第二课 基本运算 Chapter 2',                        2),
  -- Y2 Science
  ('ebb96cb5-e144-496c-b01d-44b1f7d18fa5', 'c3609ab7-af1b-4a87-b032-94db800cdf6a', '第一课 科学技能 Chapter 1',                        1),
  ('46f5ad21-e6d6-43e1-a278-7519c598643c', 'c3609ab7-af1b-4a87-b032-94db800cdf6a', '第二课 科学室规则 Chapter 2',                      2),
  -- Y2 Bahasa Melayu
  ('3d425961-bd2c-4b26-acbb-534b32269345', '8fb74fbd-cc5a-4ecf-a274-9639709c47ed', '理解 Pemahaman',                                    1),
  ('8b240570-75f3-4d84-bc8c-dade1672e206', '8fb74fbd-cc5a-4ecf-a274-9639709c47ed', '词汇 Kosa Kata',                                    2),
  ('51d046a7-d734-4c78-8d2c-f52aae6b9bf3', '8fb74fbd-cc5a-4ecf-a274-9639709c47ed', '语法 Tatabahasa',                                  3),
  -- Y2 English
  ('90b488c3-853d-415b-878c-9f40e2c2db2e', 'f73988ca-1c4e-4b22-8455-eb32c5c1e1c8', '理解与词汇 Comprehension and Vocabulary',          1),
  ('50da1a03-8668-4da5-bc88-086ca1cccd2b', 'f73988ca-1c4e-4b22-8455-eb32c5c1e1c8', '语法 Grammar',                                    2),
  -- Y3 Mathematics
  ('8a4e610f-7e19-4e48-9508-f50d59407d73', '3ac69c39-64d4-4d60-8c90-0dea1b2cd39a', '第一课 10 000 以内的整数 Chapter 1',               1),
  ('41834e81-7190-4454-9975-2995cb133f9d', '3ac69c39-64d4-4d60-8c90-0dea1b2cd39a', '第二课 基本运算 Chapter 2',                        2),
  -- Y3 Science
  ('0f4623ab-10d6-4a4d-bb28-b6babafec219', 'c3d0042c-9308-40b8-9b68-781f500a36df', '第一课 科学技能 Chapter 1',                        1),
  ('9562f586-8676-4400-ac66-a59f1fdc1d1a', 'c3d0042c-9308-40b8-9b68-781f500a36df', '第二课 科学室规则 Chapter 2',                      2),
  -- Y3 Bahasa Melayu
  ('90f09a52-1dfc-438d-816b-f06c96c685f5', '282b813f-a131-4467-bee2-aa6a054250d0', '理解与应用 Kefahaman',                              1),
  ('1d909542-6826-46f6-bc47-9ad1895969b2', '282b813f-a131-4467-bee2-aa6a054250d0', '语法 Tatabahasa',                                  2),
  -- Y3 English
  ('18140ecb-f258-40e9-b5e5-d4dfff5e500e', '3e659c9e-b3fe-4046-a3d7-3f16d321e502', '理解与词汇 Comprehension and Vocabulary',          1),
  ('52a7860a-c482-4c3b-b946-9206819670ad', '3e659c9e-b3fe-4046-a3d7-3f16d321e502', '语法 Grammar',                                    2),
  -- Y4 Mathematics
  ('2982daf2-130a-4a28-8789-75113fbddf27', '63882b88-5103-4bd0-830a-01a45c1fc692', '第一课 整数与运算 Chapter 1',                      1),
  ('df926034-7708-4e17-8f8f-83445a1b38ca', '63882b88-5103-4bd0-830a-01a45c1fc692', '第二课 分数、小数与百分比 Chapter 2',              2),
  -- Y4 Science
  ('f99902cc-d0d2-4358-8367-6f35448c2302', '1129720c-0a04-4832-8bbd-a8ffabfd8bc6', '第一课 科学技能 Chapter 1',                        1),
  ('d063b07a-059f-4c07-890d-9a4948e41507', '1129720c-0a04-4832-8bbd-a8ffabfd8bc6', '第二课 人类 Chapter 2',                            2),
  -- Y4 Bahasa Melayu
  ('7e2a794a-9688-4446-9d0b-5a55c2cb3434', 'ab9488e7-9e4d-4d5a-bb94-d845cf812a80', '理解与应用 Kefahaman',                              1),
  ('6da7dfd1-8785-4941-9fda-b2877441e5d8', 'ab9488e7-9e4d-4d5a-bb94-d845cf812a80', '语法 Tatabahasa',                                  2),
  -- Y4 English
  ('d96f611f-216e-48e5-a434-14cae4561ceb', 'b04d8778-7bc9-49b0-9695-30279098e93c', '理解与词汇 Comprehension and Vocabulary',          1),
  ('0bafab5e-cec8-4066-a9fa-c00b58808ef2', 'b04d8778-7bc9-49b0-9695-30279098e93c', '语法 Grammar',                                    2),
  -- Y5 Mathematics
  ('5da37b44-3d12-4935-a997-6c7238b54f9e', '4cc03b8e-fabc-46fe-8e76-5acf91f0ea18', '第一课 整数与运算 Chapter 1',                      1),
  ('f41d5b96-63a0-4315-8e93-34d66e6ade34', '4cc03b8e-fabc-46fe-8e76-5acf91f0ea18', '第二课 分数、小数与百分比 Chapter 2',              2),
  -- Y5 Science
  ('8046f9e7-62d2-4f2f-86ea-310b4013ca7c', '8a3f82ce-c09d-4142-9b50-be8aff758327', '第一课 科学技能 Chapter 1',                        1),
  ('7c833117-d92c-41e8-9ed2-fa01a8de4e70', '8a3f82ce-c09d-4142-9b50-be8aff758327', '第二课 人类 Chapter 2',                            2),
  -- Y5 Bahasa Melayu
  ('161ebf52-766e-42c7-9318-78eadab9d80e', '870a3904-e38c-45de-819c-fc36bc71535a', '理解与应用 Kefahaman',                              1),
  ('eab90da9-6fe7-403d-883c-03ea010f9c6f', '870a3904-e38c-45de-819c-fc36bc71535a', '语法 Tatabahasa',                                  2),
  -- Y5 English
  ('9adc0b44-7550-4631-9b12-ab2151de97ee', '0ad73544-6c28-439a-85d9-534e50304363', '理解与词汇 Comprehension and Vocabulary',          1),
  ('b3f89957-6f45-4a9c-a884-c1d5db355e1b', '0ad73544-6c28-439a-85d9-534e50304363', '语法 Grammar',                                    2),
  -- Y6 Mathematics
  ('2a9e0be2-7748-484d-8786-31cdd98aa768', 'e2151d12-9023-4e3b-bab9-a04171c94eed', '第一课 整数与运算 Chapter 1',                      1),
  ('5efe79c6-73c3-4fec-a316-f51beead0a09', 'e2151d12-9023-4e3b-bab9-a04171c94eed', '第二课 分数、小数与百分比 Chapter 2',              2),
  -- Y6 Science
  ('e38b4395-37bc-446d-b72f-37880ca61640', 'cce8098e-fc9e-4f9c-8455-58e5ed395d3f', '第一课 科学技能 Chapter 1',                        1),
  ('e3d47dce-be3d-476c-b464-2f475934f93c', 'cce8098e-fc9e-4f9c-8455-58e5ed395d3f', '第二课 人类 Chapter 2',                            2),
  -- Y6 Bahasa Melayu
  ('72f8a682-c4ac-4dee-894c-f10265379d77', 'cd1184a0-9c6a-414f-8f71-c7f5b40328a7', '理解与应用 Kefahaman',                              1),
  ('f74ed2f2-691c-4fb5-acb3-baf8cd120a77', 'cd1184a0-9c6a-414f-8f71-c7f5b40328a7', '语法 Tatabahasa',                                  2),
  -- Y6 English
  ('0cc55179-ccbe-4d31-bcbe-fd51461a7a16', '44c895d6-a8e3-4fa3-b407-b7c9d49b70ff', '理解与词汇 Comprehension and Vocabulary',          1),
  ('c475e6c5-34a8-4fbb-aadb-158e66b2a3da', '44c895d6-a8e3-4fa3-b407-b7c9d49b70ff', '语法 Grammar',                                    2)
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. SUB-TOPICS (matches prod)                                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO public.sub_topics (id, topic_id, name, display_order)
VALUES
  -- Y1 Math > Chapter 1
  ('4e61c11b-d12e-449f-bdd6-44cf5639a692', 'bc9fb793-5026-4241-94ac-54ab709f0518', '基础计算 Basic Calculation',         1),
  ('a5cf5c0e-a7d6-4009-97fe-d453445791ee', 'bc9fb793-5026-4241-94ac-54ab709f0518', '高阶思维 Higher-Order Thinking',      2),
  -- Y1 Math > Chapter 2
  ('ae3333dc-fc77-44e6-bd19-d8032ee310b5', 'f73c2614-9ce0-45eb-81ac-21f7c6575bb5', '基础计算 Basic Calculation',         1),
  ('d0c0da71-c5b9-4ebd-8f2a-df880f7994a9', 'f73c2614-9ce0-45eb-81ac-21f7c6575bb5', '高阶思维 Higher-Order Thinking',      2),
  -- Y1 Science > Chapter 1
  ('2d9bbfd1-4de1-4ad4-ac35-83751c7e9c66', '9a3c031a-3e84-4fa2-bcf8-ea9fabd465b9', '基础知识 Basic Knowledge',           1),
  ('28cda5b7-1854-4a14-9a6d-7be4ac800a96', '9a3c031a-3e84-4fa2-bcf8-ea9fabd465b9', '研究思维 Research Thinking',          2),
  -- Y1 Science > Chapter 2
  ('b9a15996-f927-4e95-88f8-d109d57260d2', 'ac5596ff-df46-44a7-8c07-4ff7567659e4', '基础知识 Basic Knowledge',           1),
  ('4bd4f7cc-e0d6-47b9-b024-a1a41408750e', 'ac5596ff-df46-44a7-8c07-4ff7567659e4', '研究思维 Research Thinking',          2),
  -- Y2 Math > Chapter 1
  ('a4f43deb-d4ac-4192-95e9-adf439ef7755', '78ea0dbf-5ba2-4d48-9582-35b24a02fc61', '基础计算 Basic Calculation',         1),
  ('09cb171d-c162-4375-bb67-bedf908aa406', '78ea0dbf-5ba2-4d48-9582-35b24a02fc61', '高阶思维 Higher-Order Thinking',      2),
  -- Y2 Math > Chapter 2
  ('812a3389-559d-4c93-b1e4-15b78df61046', '53633514-3d1b-4638-888c-e38bcea5ba13', '基础计算 Basic Calculation',         1),
  ('31a37ed5-4a4c-4612-ac34-4c14baca0678', '53633514-3d1b-4638-888c-e38bcea5ba13', '高阶思维 Higher-Order Thinking',      2),
  -- Y2 Science > Chapter 1
  ('09c18a98-faa9-469e-b370-169ac1a6e30b', 'ebb96cb5-e144-496c-b01d-44b1f7d18fa5', '基础知识 Basic Knowledge',           1),
  ('02845495-b195-428b-9192-4a83f721c741', 'ebb96cb5-e144-496c-b01d-44b1f7d18fa5', '研究思维 Research Thinking',          2),
  -- Y2 Science > Chapter 2
  ('29c35e5d-04ce-4bfa-b4d9-eb71c5b68651', '46f5ad21-e6d6-43e1-a278-7519c598643c', '基础知识 Basic Knowledge',           1),
  ('2f9ac97d-a338-4bd9-825d-537c5c0365c0', '46f5ad21-e6d6-43e1-a278-7519c598643c', '研究思维 Research Thinking',          2),
  -- Y2 BM > Pemahaman
  ('b5351699-47a6-4b17-9c62-57727a390167', '8b240570-75f3-4d84-bc8c-dade1672e206', 'Tema 1 & Tema 2',                     1),
  -- Y2 English > Comprehension and Vocabulary
  ('3e7aa63a-900f-42f1-af4d-774b42e6020f', '90b488c3-853d-415b-878c-9f40e2c2db2e', 'Unit 5 - Free Time',                  1),
  -- Y2 English > Grammar
  ('8e74125c-d629-4b0e-ab11-c5dfb57856aa', '50da1a03-8668-4da5-bc88-086ca1cccd2b', 'Verbs',                               1),
  -- Y3 Math > Chapter 1
  ('7c8010f8-7616-4ead-9431-1a9c2d6224d3', '8a4e610f-7e19-4e48-9508-f50d59407d73', '基础计算 Basic Calculation',         1),
  ('b8acac8d-064e-4ba3-b26f-5b0ccb2f0d35', '8a4e610f-7e19-4e48-9508-f50d59407d73', '高阶思维 Higher-Order Thinking',      2),
  -- Y3 Math > Chapter 2
  ('044060db-7c76-414a-b9ac-5f9cb25292f3', '41834e81-7190-4454-9975-2995cb133f9d', '基础计算 Basic Calculation',         1),
  ('5107fce5-94b1-4db9-8425-5739d12720ec', '41834e81-7190-4454-9975-2995cb133f9d', '高阶思维 Higher-Order Thinking',      2),
  -- Y3 Science > Chapter 1
  ('f529cc5c-a73e-4d05-992c-450584905193', '0f4623ab-10d6-4a4d-bb28-b6babafec219', '基础知识 Basic Knowledge',           1),
  ('0020b555-fb2d-47a2-9af0-d0a94df98d9f', '0f4623ab-10d6-4a4d-bb28-b6babafec219', '研究思维 Research Thinking',          2),
  -- Y3 Science > Chapter 2
  ('b3df363b-ce7f-47ea-9066-42ee923b4e0e', '9562f586-8676-4400-ac66-a59f1fdc1d1a', '基础知识 Basic Knowledge',           1),
  ('633f0234-096b-4ad4-bc94-2c8897d20de2', '9562f586-8676-4400-ac66-a59f1fdc1d1a', '研究思维 Research Thinking',          2),
  -- Y4 Math > Chapter 1
  ('67180109-a297-4dae-a1fa-76dcdfa0fdb1', '2982daf2-130a-4a28-8789-75113fbddf27', '基础计算 Basic Calculation',         3),
  ('a341734d-5084-490b-806e-3115b67766fe', '2982daf2-130a-4a28-8789-75113fbddf27', '高阶思维 Higher-Order Thinking',      4),
  -- Y4 Math > Chapter 2
  ('c31e0af6-55d8-43be-a30b-a07e91e82845', 'df926034-7708-4e17-8f8f-83445a1b38ca', '基础计算 Basic Calculation',         3),
  ('b0cf32e1-3758-4484-8189-357ec39645b6', 'df926034-7708-4e17-8f8f-83445a1b38ca', '高阶思维 Higher-Order Thinking',      4),
  -- Y4 Science > Chapter 1
  ('7d8028fe-a9c7-4b60-9a9b-102a07e984f4', 'f99902cc-d0d2-4358-8367-6f35448c2302', '基础知识 Basic Knowledge',           1),
  ('5394dfcc-4eb7-414c-b4aa-acde0b6ede5f', 'f99902cc-d0d2-4358-8367-6f35448c2302', '研究思维 Research Thinking',          2),
  -- Y4 Science > Chapter 2
  ('8fba7b3d-e192-496a-ad0e-39869f14b7f6', 'd063b07a-059f-4c07-890d-9a4948e41507', '基础知识 Basic Knowledge',           1),
  ('a29bde23-4548-440f-9b69-470eb90ad62a', 'd063b07a-059f-4c07-890d-9a4948e41507', '研究思维 Research Thinking',          2),
  -- Y5 Math > Chapter 1
  ('d5a066f2-9180-4044-8345-cbd8c4e4c0e5', '5da37b44-3d12-4935-a997-6c7238b54f9e', '基础计算 Basic Calculation',         3),
  ('7b3f9b87-a48d-4de8-8e66-847c8b167db2', '5da37b44-3d12-4935-a997-6c7238b54f9e', '高阶思维 Higher-Order Thinking',      4),
  -- Y5 Math > Chapter 2
  ('3a70f42f-572d-4b6b-bb3e-0a19aa5d475e', 'f41d5b96-63a0-4315-8e93-34d66e6ade34', '基础计算 Basic Calculation',         3),
  ('51fae49a-4c36-4348-9e5a-85b5a0589de8', 'f41d5b96-63a0-4315-8e93-34d66e6ade34', '高阶思维 Higher-Order Thinking',      4),
  -- Y5 Science > Chapter 1
  ('59e8a1db-f75c-40de-aa70-1944f0359126', '8046f9e7-62d2-4f2f-86ea-310b4013ca7c', '基础知识 Basic Knowledge',           1),
  ('643c7e4b-40bf-49d9-842e-d8787014ff03', '8046f9e7-62d2-4f2f-86ea-310b4013ca7c', '研究思维 Research Thinking',          2),
  -- Y5 Science > Chapter 2
  ('531ffee8-6541-4304-a198-9112a94680ff', '7c833117-d92c-41e8-9ed2-fa01a8de4e70', '基础知识 Basic Knowledge',           1),
  ('ed809fde-0ead-41ec-bbf9-562cba8426e0', '7c833117-d92c-41e8-9ed2-fa01a8de4e70', '研究思维 Research Thinking',          2),
  -- Y6 Math > Chapter 1
  ('ec9d3ac0-871a-458a-9011-316d272cfb5f', '2a9e0be2-7748-484d-8786-31cdd98aa768', '基础计算 Basic Calculation',         3),
  ('9af8121d-74bf-478d-b1c3-95597066f4f5', '2a9e0be2-7748-484d-8786-31cdd98aa768', '高阶思维 Higher-Order Thinking',      4),
  -- Y6 Math > Chapter 2
  ('360e8aee-7aab-459e-98a3-c4d4d09be2c0', '5efe79c6-73c3-4fec-a316-f51beead0a09', '基础计算 Basic Calculation',         3),
  ('dbcd3536-084e-40c1-985d-1712ba8a01a6', '5efe79c6-73c3-4fec-a316-f51beead0a09', '高阶思维 Higher-Order Thinking',      4),
  -- Y6 Science > Chapter 1
  ('e0865315-14fc-44e6-940f-02f9ca658ea4', 'e38b4395-37bc-446d-b72f-37880ca61640', '基础知识 Basic Knowledge',           1),
  ('a49119a8-ce76-4420-b0b6-83fb3dc9701d', 'e38b4395-37bc-446d-b72f-37880ca61640', '研究思维 Research Thinking',          2),
  -- Y6 Science > Chapter 2
  ('67df6469-72e9-4b16-990d-651ff4feabba', 'e3d47dce-be3d-476c-b464-2f475934f93c', '基础知识 Basic Knowledge',           1),
  ('eb401dbf-f4b5-4704-9625-14ca5d59a93c', 'e3d47dce-be3d-476c-b464-2f475934f93c', '研究思维 Research Thinking',          2),
  -- Y6 English > Comprehension and Vocabulary
  ('35e1aeeb-3ed5-4321-a808-a5ada0e2bfac', '0cc55179-ccbe-4d31-bcbe-fd51461a7a16', '语法 Grammar',                       1)
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 8. QUESTIONS (representative sample from prod — 15 questions)            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- grade_level_id and subject_id are auto-populated by the
-- populate_question_hierarchy_trigger from the sub-topic chain.
-- Prod has 1,200+ questions — this is a small sample for testing.

INSERT INTO public.questions (
  id, type, question, topic_id, explanation, answer,
  option_1_text, option_1_is_correct,
  option_2_text, option_2_is_correct,
  option_3_text, option_3_is_correct,
  option_4_text, option_4_is_correct
) VALUES

  -- ── Y1 Math > Chapter 1 > Basic Calculation (Chinese) ────────────────────

  ('073d50c7-22e1-43c1-be30-ba53e7b04e66', 'mcq',
   '在 15, 20, 25, 30 中，下一个数是多少？',
   '4e61c11b-d12e-449f-bdd6-44cf5639a692',
   '五个五个地增加。',
   NULL,
   '31', false, '35', true, '40', false, '45', false),

  ('0c97d45a-f8a1-4a3d-96d9-f7449ab81607', 'mcq',
   '在数字 7 中，个位数值是多少？',
   '4e61c11b-d12e-449f-bdd6-44cf5639a692',
   '7是个位数，数值是7。',
   NULL,
   '70', false, '7', true, '0', false, '1', false),

  ('11e08503-3ca0-409a-a46d-5bc1f2f5f50f', 'mcq',
   '哪个数字最大？',
   '4e61c11b-d12e-449f-bdd6-44cf5639a692',
   '91在选项中是最大的。',
   NULL,
   '19', false, '91', true, '49', false, '90', false),

  ('169f1572-c8e8-4e86-83ac-243ae5fc66de', 'mcq',
   '瓶子里装了 50 粒红豆。同样的瓶子装了半瓶绿豆。绿豆大约有多少粒？',
   '4e61c11b-d12e-449f-bdd6-44cf5639a692',
   '一半大约是25。',
   NULL,
   '50', false, '100', false, '25', true, '10', false),

  ('17c5258e-ca6f-4002-b4b7-d8b84db7d0eb', 'mcq',
   '一罐糖果大约有10颗，两罐同样的糖果大约有多少颗？',
   '4e61c11b-d12e-449f-bdd6-44cf5639a692',
   '10加10等于20。',
   NULL,
   '10', false, '20', true, '5', false, '50', false),

  -- ── Y3 Math > Chapter 1 > Basic Calculation (Chinese) ────────────────────

  ('0183618e-b41f-42c4-b838-c7caa9647fa6', 'mcq',
   '3 个千、14 个十和 5 个一组成的数是？',
   '7c8010f8-7616-4ead-9431-1a9c2d6224d3',
   '3000 + 140 + 5 = 3145。',
   NULL,
   '3145', true, '3415', false, '31405', false, '3195', false),

  ('0940714c-089a-4eea-ac07-b7df1a258ecc', 'mcq',
   '在 9014 中，数字 9 的数值是多少？',
   '7c8010f8-7616-4ead-9431-1a9c2d6224d3',
   '9在千位，所以它的数值是 9000。',
   NULL,
   '9', false, '90', false, '900', false, '9000', true),

  ('0a8812ce-bee0-499e-a023-c8c9273272d5', 'mcq',
   '从小到大排列：2310, 2130, 2031。',
   '7c8010f8-7616-4ead-9431-1a9c2d6224d3',
   '比较千位相同，看百位：0 < 1 < 3。',
   NULL,
   '2310, 2130, 2031', false, '2031, 2130, 2310', true, '2130, 2031, 2310', false, '2031, 2310, 2130', false),

  -- ── Y2 English > Grammar > Verbs ─────────────────────────────────────────

  ('49f16772-57a6-44a8-8d27-76d8f29eb8bc', 'mcq',
   'Choose the correct answer

I _______ my teeth.',
   '8e74125c-d629-4b0e-ab11-c5dfb57856aa',
   NULL,
   NULL,
   'comb', false, 'brush', true, 'ride', false, 'read', false),

  ('66ac16fb-0603-49b1-9974-6c4101f92c83', 'mcq',
   'Choose the correct answer

I _______ movies.',
   '8e74125c-d629-4b0e-ab11-c5dfb57856aa',
   NULL,
   NULL,
   'watch', true, 'comb', false, 'feed', false, 'paint', false),

  ('b7e8eeeb-ab8b-4062-9a6d-dfc255656558', 'mcq',
   'Choose the correct answer

I _______ chess.',
   '8e74125c-d629-4b0e-ab11-c5dfb57856aa',
   NULL,
   NULL,
   'comb', false, 'play', true, 'feed', false, 'read', false),

  ('bac84629-adc6-4527-bd5e-9183e3378323', 'mcq',
   'Choose the correct answer

I _______ my cat.',
   '8e74125c-d629-4b0e-ab11-c5dfb57856aa',
   NULL,
   NULL,
   'sing', false, 'read', false, 'feed', true, 'dance', false),

  ('bd94736c-87a9-45fb-98b7-b5dbf1da58e3', 'mcq',
   'Choose the correct answer

I _______ books.',
   '8e74125c-d629-4b0e-ab11-c5dfb57856aa',
   NULL,
   NULL,
   'read', true, 'watch', false, 'comb', false, 'feed', false),

  ('cc6ac816-fc6d-40d8-923c-11f20d4cec86', 'mcq',
   'Choose the correct answer

I _______ my hair.',
   '8e74125c-d629-4b0e-ab11-c5dfb57856aa',
   NULL,
   NULL,
   'comb', true, 'brush', false, 'watch', false, 'read', false),

  -- ── Y2 English > Comprehension > Unit 5 (days of the week) ───────────────

  ('05054756-a6c3-4074-80c4-a6dbb3f5ec00', 'mcq',
   'Which group of days is written in the correct order?',
   '3e7aa63a-900f-42f1-af4d-774b42e6020f',
   E'The correct order is:\n• Monday (星期一)\n• Tuesday (星期二)\n• Wednesday (星期三)\n• Thursday (星期四)\n• Friday (星期五)\n• Saturday (星期六)\n• Sunday (星期日)',
   NULL,
   'Wednesday, Thursday, Tuesday', false,
   'Monday, Tuesday, Wednesday', true,
   'Saturday, Sunday, Friday', false,
   'Tuesday, Thursday, Wednesday', false)

ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 9. PETS (all 34 from prod, with image paths)                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO public.pets (id, name, rarity, image_path, tier2_image_path, tier3_image_path)
VALUES
  -- Common (12)
  ('56280e79-c181-47e7-940b-fc78473648d6', 'Baby Dragon',      'common',    '1771608787300.png',                                     '1771608787882.png',                                     '1771608788179.png'),
  ('50aed2a3-8c82-499e-a0df-c8b09e5c8f4b', 'Cloud Bunny',      'common',    '50aed2a3-8c82-499e-a0df-c8b09e5c8f4b.png',              '50aed2a3-8c82-499e-a0df-c8b09e5c8f4b_tier2.png',        '50aed2a3-8c82-499e-a0df-c8b09e5c8f4b_tier3.png'),
  ('29eb7f2d-3a51-48d8-b1d9-e7db032b7968', 'Dust Hamster',     'common',    '29eb7f2d-3a51-48d8-b1d9-e7db032b7968.png',              '29eb7f2d-3a51-48d8-b1d9-e7db032b7968_tier2.png',        '29eb7f2d-3a51-48d8-b1d9-e7db032b7968_tier3.png'),
  ('c91a4a38-a227-4e79-8644-5cd7d90e19db', 'Earth Snake',      'common',    'c91a4a38-a227-4e79-8644-5cd7d90e19db.png',              'c91a4a38-a227-4e79-8644-5cd7d90e19db_tier2.png',        'c91a4a38-a227-4e79-8644-5cd7d90e19db_tier3.png'),
  ('ecf2abf1-f5f5-4457-ad12-cc518c0ac916', 'Electric Rat',     'common',    'ecf2abf1-f5f5-4457-ad12-cc518c0ac916.png',              'ecf2abf1-f5f5-4457-ad12-cc518c0ac916_tier2.png',        'ecf2abf1-f5f5-4457-ad12-cc518c0ac916_tier3.png'),
  ('7261d247-5e07-4973-a45f-abe854fd5c80', 'Giant Goldfish',   'common',    '1772262074140.png',                                     '1772262074416.png',                                     '1772262074710.png'),
  ('5d0a2926-0bcf-4765-9ce7-b13dc0215c96', 'Grass Monkey',     'common',    '1771167852658.png',                                     '1771167853196.png',                                     '1771167853437.png'),
  ('ec35ee71-907a-42c8-b1e0-39a81afd2d44', 'Leaf Gecko',       'common',    '1772261745910.png',                                     '1772261746611.png',                                     '1772261746906.png'),
  ('7c3a3988-25bc-4057-b8ce-9e8e5eea8af8', 'Ocean Starfish',   'common',    '1771608038698.png',                                     '1771608039069.png',                                     '1771608039436.png'),
  ('2d3cb724-7f87-4f3b-a858-207aba6cf947', 'Sea Nautilus',     'common',    '1771770222613.png',                                     '1771770223111.png',                                     '1771770223395.png'),
  ('e30eed4f-2bb6-474a-b98f-d9cb3e48427a', 'Spiky Pufflefish', 'common',    '1771608504697.png',                                     '1771608505253.png',                                     '1771608505868.png'),
  ('c90a8ab7-cbd6-4311-a838-bd7f4e500779', 'Thorny Sheep',     'common',    '1771770340207.png',                                     '1771770340739.png',                                     '1771770341019.png'),
  -- Rare (8)
  ('ae398076-afeb-4c11-8d9a-bb6228d06985', 'Aqua Kitten',      'rare',      'ae398076-afeb-4c11-8d9a-bb6228d06985.png',              'ae398076-afeb-4c11-8d9a-bb6228d06985_tier2.png',        'ae398076-afeb-4c11-8d9a-bb6228d06985_tier3.png'),
  ('56e0acd6-e324-4d82-ad68-ad3b82dcf2dc', 'Armor Bull',       'rare',      '1772007527773.png',                                     '1772007528372.png',                                     '1772007528863.png'),
  ('64999397-9d1f-4297-b1f4-76218d3f9cfc', 'Ember Puppy',      'rare',      '64999397-9d1f-4297-b1f4-76218d3f9cfc.png',              '64999397-9d1f-4297-b1f4-76218d3f9cfc_tier2.png',        '64999397-9d1f-4297-b1f4-76218d3f9cfc_tier3.png'),
  ('56dc0ecc-df37-45f0-ac35-e81d0e2f6bd4', 'Glacial Mammoth',  'rare',      '1772007637771.png',                                     '1772007638103.png',                                     '1772007638677.png'),
  ('143ef6fc-1824-47d6-a2c6-82baaad48961', 'Ice Rooster',      'rare',      '1772261513798.png',                                     '1772261514354.png',                                     '1772261514836.png'),
  ('09147875-8c4c-4785-8f26-2f9471ea576a', 'Metal Owl',        'rare',      '1771608278941.png',                                     '1771608279763.png',                                     '1771608280079.png'),
  ('5a53c4cc-4787-4aac-988d-9c74f0c7971a', 'Shadow Cat',       'rare',      '5a53c4cc-4787-4aac-988d-9c74f0c7971a.png',              '5a53c4cc-4787-4aac-988d-9c74f0c7971a_tier2.png',        '5a53c4cc-4787-4aac-988d-9c74f0c7971a_tier3.png'),
  ('a9115252-644c-4d86-a1a0-9105d62e2fe9', 'Void Penguin',     'rare',      'a9115252-644c-4d86-a1a0-9105d62e2fe9.png',              'a9115252-644c-4d86-a1a0-9105d62e2fe9_tier2.png',        'a9115252-644c-4d86-a1a0-9105d62e2fe9_tier3.png'),
  -- Epic (9)
  ('a94b28c9-d835-4290-be81-7497953af652', 'Celestial Fox',    'epic',      'a94b28c9-d835-4290-be81-7497953af652.png',              'a94b28c9-d835-4290-be81-7497953af652_tier2.png',        'a94b28c9-d835-4290-be81-7497953af652_tier3.png'),
  ('c119aa73-7491-4bf5-a971-2c991c3e758a', 'Crystal Pterosaur','epic',      'c119aa73-7491-4bf5-a971-2c991c3e758a.png',              'c119aa73-7491-4bf5-a971-2c991c3e758a_tier2.png',        'c119aa73-7491-4bf5-a971-2c991c3e758a_tier3.png'),
  ('344a6f89-9086-4d02-9627-3a5cccb39d55', 'Frost Dragon',     'epic',      '344a6f89-9086-4d02-9627-3a5cccb39d55.png',              '344a6f89-9086-4d02-9627-3a5cccb39d55_tier2.png',        '344a6f89-9086-4d02-9627-3a5cccb39d55_tier3.png'),
  ('7b27f354-86d5-4e0b-8cb3-a9dce5df7d4c', 'Pyro Fox',         'epic',      '7b27f354-86d5-4e0b-8cb3-a9dce5df7d4c.png',              '7b27f354-86d5-4e0b-8cb3-a9dce5df7d4c_tier2.png',        '7b27f354-86d5-4e0b-8cb3-a9dce5df7d4c_tier3.png'),
  ('316e6dbc-8ce1-4057-8c49-71726e76ebd5', 'Radiant Pony',     'epic',      '1771609211379.png',                                     '1771609211740.png',                                     '1771609212086.png'),
  ('268b3a01-a037-4e7b-8049-4a4b9fb7e3f5', 'Star Wolf',        'epic',      '268b3a01-a037-4e7b-8049-4a4b9fb7e3f5.png',              '268b3a01-a037-4e7b-8049-4a4b9fb7e3f5_tier2.png',        '268b3a01-a037-4e7b-8049-4a4b9fb7e3f5_tier3.png'),
  ('2f418d33-9181-4e53-948d-1128f96163c1', 'Stone Bear',       'epic',      '2f418d33-9181-4e53-948d-1128f96163c1.png',              '2f418d33-9181-4e53-948d-1128f96163c1_tier2.png',        '2f418d33-9181-4e53-948d-1128f96163c1_tier3.png'),
  ('97c2a29f-e199-436b-831a-a1aa3046b404', 'Wind Dragon',      'epic',      '1772261932268.png',                                     '1772261932582.png',                                     '1772261932903.png'),
  ('66c32043-5098-4f01-8f8d-d75baeecae79', 'Woodland Bear',    'epic',      '1772262332274.png',                                     '1772262332913.png',                                     '1772262333297.png'),
  -- Legendary (5)
  ('bdcc1781-6127-4919-8d6c-cf0a70bffe58', 'Lightning Snake',  'legendary', 'bdcc1781-6127-4919-8d6c-cf0a70bffe58.png',              'bdcc1781-6127-4919-8d6c-cf0a70bffe58_tier2.png',        'bdcc1781-6127-4919-8d6c-cf0a70bffe58_tier3.png'),
  ('a1f6ef51-5e6e-4abd-a8e8-f7813000b897', 'Poison Cockroach', 'legendary', '1771177424526.png',                                     '1771177425210.png',                                     '1771177425501.png'),
  ('cd242b09-c444-421d-9efd-20df2905531c', 'Rainbow Unicorn',  'legendary', '1771176923316.png',                                     '1771176924171.png',                                     '1771176924443.png'),
  ('43bfd295-e55f-43ce-b729-dea00e6728ee', 'Ruby Python',      'legendary', '1771770477216.png',                                     '1771770477769.png',                                     '1771770478089.png'),
  ('1f7d40be-8da9-4670-a697-17983d3558d0', 'Sky Dragon',       'legendary', '1769605038446.png',                                     '1769605038829.png',                                     '1769605039184.png'),
  ('e3cddae4-c3a5-47fa-9d39-fc0b7ddc7073', 'Solar Phoenix',    'legendary', '1770992222467.png',                                     'e3cddae4-c3a5-47fa-9d39-fc0b7ddc7073_tier2.png',        '1770992223872.png')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 10. OWNED PETS (for test students)                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO public.owned_pets (id, student_id, pet_id, count, tier, food_fed)
VALUES
  -- Alice owns: Grass Monkey (tier 2), Cloud Bunny, Aqua Kitten
  ('61000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '5d0a2926-0bcf-4765-9ce7-b13dc0215c96', 1, 2, 12),
  ('61000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '50aed2a3-8c82-499e-a0df-c8b09e5c8f4b', 1, 1, 3),
  ('61000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'ae398076-afeb-4c11-8d9a-bb6228d06985', 1, 1, 0),
  -- Ben owns: Baby Dragon, Ember Puppy
  ('61000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', '56280e79-c181-47e7-940b-fc78473648d6', 1, 1, 2),
  ('61000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', '64999397-9d1f-4297-b1f4-76218d3f9cfc', 1, 1, 0)
ON CONFLICT (id) DO NOTHING;

-- Set selected pets (references pets.id, not owned_pets.id)
UPDATE public.student_profiles
SET selected_pet_id = '5d0a2926-0bcf-4765-9ce7-b13dc0215c96'  -- Grass Monkey
WHERE id = '00000000-0000-0000-0000-000000000002' AND selected_pet_id IS NULL;

UPDATE public.student_profiles
SET selected_pet_id = '56280e79-c181-47e7-940b-fc78473648d6'  -- Baby Dragon
WHERE id = '00000000-0000-0000-0000-000000000003' AND selected_pet_id IS NULL;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 11. PARENT–STUDENT LINK                                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Mrs Tan is linked to Alice
INSERT INTO public.parent_student_links (id, parent_id, student_id)
VALUES ('62000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 12. DAILY STATUSES                                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO public.daily_statuses (id, student_id, date, mood, has_spun, has_practiced)
VALUES
  -- Alice: last 3 days
  ('63000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', CURRENT_DATE - 2, 'happy',   true,  true),
  ('63000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', CURRENT_DATE - 1, 'happy',   true,  true),
  ('63000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', CURRENT_DATE,     'neutral', false, false),
  -- Ben: today only
  ('63000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', CURRENT_DATE,     'happy',   true,  true)
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 13. PRACTICE SESSION (completed, for Alice)                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Session hierarchy trigger auto-populates grade_level_id and subject_id.

INSERT INTO public.practice_sessions (
  id, student_id, topic_id, total_questions, current_question_index,
  completed_at, correct_count, xp_earned, coins_earned, total_time_seconds
) VALUES (
  '70000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '4e61c11b-d12e-449f-bdd6-44cf5639a692',  -- Y1 Math > Ch1 > Basic Calculation
  3, 3,
  now() - interval '1 day',
  0, 20, 5, 145
)
ON CONFLICT (id) DO NOTHING;

-- Session questions
INSERT INTO public.session_questions (id, session_id, question_id, question_order)
VALUES
  ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '073d50c7-22e1-43c1-be30-ba53e7b04e66', 1),
  ('71000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '0c97d45a-f8a1-4a3d-96d9-f7449ab81607', 2),
  ('71000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001', '11e08503-3ca0-409a-a46d-5bc1f2f5f50f', 3)
ON CONFLICT (id) DO NOTHING;

-- Practice answers
INSERT INTO public.practice_answers (id, session_id, question_id, is_correct, time_spent_seconds, answered_at, selected_options, text_answer)
VALUES
  -- Q1: MCQ correct (option 2 = "35")
  ('72000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '073d50c7-22e1-43c1-be30-ba53e7b04e66',
   true, 28, now() - interval '1 day', '{2}', NULL),
  -- Q2: MCQ wrong (picked option 1 instead of 2)
  ('72000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '0c97d45a-f8a1-4a3d-96d9-f7449ab81607',
   false, 52, now() - interval '1 day', '{1}', NULL),
  -- Q3: MCQ correct (option 2 = "91")
  ('72000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001', '11e08503-3ca0-409a-a46d-5bc1f2f5f50f',
   true, 65, now() - interval '1 day', '{2}', NULL)
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 14. ANNOUNCEMENT                                                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO public.announcements (id, title, content, target_audience, created_by, is_pinned)
VALUES (
  '80000000-0000-0000-0000-000000000001',
  'Welcome to Clavis!',
  'We are excited to have you here. Start practising to earn XP and climb the leaderboard!',
  'all',
  '00000000-0000-0000-0000-000000000001',
  true
)
ON CONFLICT (id) DO NOTHING;


COMMIT;
