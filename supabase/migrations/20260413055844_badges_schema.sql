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

-- FUNCTION: check_trigger_eligibility ---------------------------------------
-- Pure read-only eligibility check. Returns boolean. The `else raise` branch
-- is CRITICAL: without it, a missing case arm returns NULL, which would
-- silently fall through the `if not check_trigger_eligibility(...)` guard in
-- the orchestrator and award badges for every student on any unknown trigger.

create or replace function public.check_trigger_eligibility(
  p_student_id uuid,
  p_trigger_type badge_trigger_type,
  p_params jsonb
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return case p_trigger_type
    when 'total_sessions_completed' then
      (select count(*) from public.practice_sessions
       where student_id = p_student_id and completed_at is not null)
      >= (p_params->>'threshold')::int

    when 'total_xp_earned' then
      coalesce((select xp from public.student_profiles where id = p_student_id), 0)
      >= (p_params->>'threshold')::int

    when 'total_questions_answered' then
      (select count(*) from public.practice_answers where student_id = p_student_id)
      >= (p_params->>'threshold')::int

    when 'total_days_practiced' then
      (select count(*) from public.daily_statuses
       where student_id = p_student_id and has_practiced = true)
      >= (p_params->>'threshold')::int

    when 'current_streak' then
      (select current_streak from public.student_profiles where id = p_student_id)
      >= (p_params->>'threshold')::int

    when 'max_streak_ever' then
      (select max_streak from public.student_profiles where id = p_student_id)
      >= (p_params->>'threshold')::int

    when 'perfect_sessions_count' then
      (select count(*) from public.practice_sessions
       where student_id = p_student_id
         and completed_at is not null
         and correct_count is not null
         and correct_count = total_questions)
      >= (p_params->>'threshold')::int

    when 'subject_accuracy_threshold' then
      exists (
        select 1 from public.practice_sessions
        where student_id = p_student_id
          and completed_at is not null
          and correct_count is not null
          and (p_params->>'subject_id' = 'any'
               or subject_id = (p_params->>'subject_id')::uuid)
        group by 1
        having sum(total_questions) >= (p_params->>'min_questions')::int
           and (sum(correct_count)::numeric * 100 / nullif(sum(total_questions), 0))
               >= (p_params->>'min_percentage')::int
      )

    when 'unique_pets_owned' then
      (select count(distinct pet_id) from public.owned_pets where student_id = p_student_id)
      >= (p_params->>'threshold')::int

    when 'pet_max_tier_reached' then
      exists (select 1 from public.owned_pets
              where student_id = p_student_id and tier = 3)

    when 'pets_of_rarity_count' then
      (select count(*) from public.owned_pets op
       join public.pets p on p.id = op.pet_id
       where op.student_id = p_student_id
         and p.rarity = (p_params->>'rarity')::pet_rarity)
      >= (p_params->>'threshold')::int

    else
      raise exception 'check_trigger_eligibility: unknown trigger type %', p_trigger_type
        using errcode = 'data_exception'
  end;
end;
$$;
