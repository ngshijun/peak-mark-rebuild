-- ============================================================================
-- Achievements and Badges System — schema, functions, RLS
-- Spec: docs/superpowers/specs/2026-04-13-achievements-badges-design.md
-- ============================================================================

-- ENUMS ---------------------------------------------------------------------

create type badge_trigger_type as enum (
  'total_sessions_completed',
  'total_xp_earned',
  'total_questions_answered',
  'total_days_practiced',
  'current_streak',
  'max_streak_ever',
  'perfect_sessions_count',
  'subject_accuracy_threshold',
  'unique_pets_owned',
  'pet_max_tier_reached',
  'pets_of_rarity_count'
);

create type badge_tier as enum (
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
  'master',
  'grandmaster'
);

-- COLUMN: student_profiles.max_streak ---------------------------------------

alter table public.student_profiles
  add column max_streak integer not null default 0;

-- Backfill from current_streak (floor value; historical peaks are unknowable)
update public.student_profiles
  set max_streak = current_streak
  where current_streak > 0;

-- TABLE: badges (catalog) ---------------------------------------------------

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  trigger_type badge_trigger_type not null,
  trigger_params jsonb not null default '{}',
  tier badge_tier not null,
  coin_reward integer not null default 0,
  required_tier subscription_tier not null default 'core',
  icon_path text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index badges_trigger_type_idx on public.badges(trigger_type) where is_active;
create index badges_required_tier_idx on public.badges(required_tier) where is_active;

-- TABLE: student_badges (unlocks) -------------------------------------------

create table public.student_badges (
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key (student_id, badge_id)
);

create index student_badges_student_unlocked_idx
  on public.student_badges(student_id, unlocked_at desc);

create index student_badges_unseen_idx
  on public.student_badges(student_id)
  where seen_at is null;
