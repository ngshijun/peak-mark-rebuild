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
      (select count(*)
       from public.practice_answers pa
       join public.practice_sessions ps on ps.id = pa.session_id
       where ps.student_id = p_student_id)
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

-- FUNCTION: check_and_award_badges ------------------------------------------
-- The orchestrator. Called from hot-path RPCs. Iterates active badges, skips
-- already-owned and tier-gated, checks eligibility, atomically inserts unlock
-- + awards coins, returns the newly-unlocked badge rows.

create or replace function public.check_and_award_badges(p_student_id uuid)
returns setof public.badges
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.badges%rowtype;
  student_tier public.subscription_tier;
begin
  select subscription_tier into student_tier
  from public.student_profiles where id = p_student_id;

  if student_tier is null then
    return;  -- student not found; no-op
  end if;

  for b in
    select * from public.badges
    where is_active
    order by created_at
  loop
    -- skip already-owned
    if exists (
      select 1 from public.student_badges
      where student_id = p_student_id and badge_id = b.id
    ) then
      continue;
    end if;

    -- skip tier-gated (direct enum comparison: core < plus < pro < max)
    if student_tier < b.required_tier then
      continue;
    end if;

    -- check eligibility
    if not public.check_trigger_eligibility(p_student_id, b.trigger_type, b.trigger_params) then
      continue;
    end if;

    -- award: insert unlock (idempotent) + credit coins + yield the row
    insert into public.student_badges (student_id, badge_id)
    values (p_student_id, b.id)
    on conflict do nothing;

    if b.coin_reward > 0 then
      update public.student_profiles
      set coins = coalesce(coins, 0) + b.coin_reward
      where id = p_student_id;
    end if;

    return next b;
  end loop;
  return;
end;
$$;

-- FUNCTION: check_and_award_badges_client_facing ----------------------------
-- Thin wrapper for the 1x gacha_pull flow which is client-assembled. Uses
-- auth.uid() internally so clients cannot pass arbitrary student IDs. Returns
-- setof badges for the client to enqueue as celebrations.

create or replace function public.check_and_award_badges_client_facing()
returns setof public.badges
language plpgsql
security definer
set search_path = public
as $$
begin
  return query select * from public.check_and_award_badges((select auth.uid()));
end;
$$;

-- FUNCTION: get_student_badge_progress --------------------------------------
-- Returns (badge_id, current_value, target_value, progress_pct) for all
-- unearned, non-tier-gated badges. Called on AchievementsPage mount. Client
-- sorts client-side and takes top 3 for ClosestToUnlockSection.

create or replace function public.get_student_badge_progress(p_student_id uuid)
returns table (
  badge_id uuid,
  current_value numeric,
  target_value numeric,
  progress_pct numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  b public.badges%rowtype;
  student_tier public.subscription_tier;
  cur numeric;
  tgt numeric;
begin
  select subscription_tier into student_tier
  from public.student_profiles where id = p_student_id;

  if student_tier is null then
    return;
  end if;

  for b in
    select * from public.badges where is_active
  loop
    -- skip already-owned
    if exists (
      select 1 from public.student_badges
      where student_id = p_student_id and badge_id = b.id
    ) then
      continue;
    end if;

    -- skip tier-gated (the widget hides these from free users)
    if student_tier < b.required_tier then
      continue;
    end if;

    -- compute current / target per trigger_type
    case b.trigger_type
      when 'total_sessions_completed' then
        cur := (select count(*) from public.practice_sessions
                where student_id = p_student_id and completed_at is not null);
        tgt := (b.trigger_params->>'threshold')::numeric;

      when 'total_xp_earned' then
        cur := coalesce((select xp from public.student_profiles
                         where id = p_student_id), 0);
        tgt := (b.trigger_params->>'threshold')::numeric;

      when 'total_questions_answered' then
        cur := (select count(*)
                from public.practice_answers pa
                join public.practice_sessions ps on ps.id = pa.session_id
                where ps.student_id = p_student_id);
        tgt := (b.trigger_params->>'threshold')::numeric;

      when 'total_days_practiced' then
        cur := (select count(*) from public.daily_statuses
                where student_id = p_student_id and has_practiced = true);
        tgt := (b.trigger_params->>'threshold')::numeric;

      when 'current_streak' then
        cur := (select current_streak from public.student_profiles
                where id = p_student_id);
        tgt := (b.trigger_params->>'threshold')::numeric;

      when 'max_streak_ever' then
        cur := (select max_streak from public.student_profiles
                where id = p_student_id);
        tgt := (b.trigger_params->>'threshold')::numeric;

      when 'perfect_sessions_count' then
        cur := (select count(*) from public.practice_sessions
                where student_id = p_student_id
                  and completed_at is not null
                  and correct_count is not null
                  and correct_count = total_questions);
        tgt := (b.trigger_params->>'threshold')::numeric;

      when 'unique_pets_owned' then
        cur := (select count(distinct pet_id) from public.owned_pets
                where student_id = p_student_id);
        tgt := (b.trigger_params->>'threshold')::numeric;

      when 'pet_max_tier_reached' then
        cur := case when exists (
          select 1 from public.owned_pets
          where student_id = p_student_id and tier = 3
        ) then 1 else 0 end;
        tgt := 1;

      when 'pets_of_rarity_count' then
        cur := (select count(*) from public.owned_pets op
                join public.pets p on p.id = op.pet_id
                where op.student_id = p_student_id
                  and p.rarity = (b.trigger_params->>'rarity')::pet_rarity);
        tgt := (b.trigger_params->>'threshold')::numeric;

      -- subject_accuracy_threshold: omitted from progress widget because
      -- it's not a simple 1D threshold (two axes: sample size + percentage).
      -- Clients won't see these in the Closest-to-unlock section.
      else
        continue;
    end case;

    badge_id := b.id;
    current_value := cur;
    target_value := tgt;
    progress_pct := case
      when tgt > 0 then least(100, (cur * 100.0 / tgt))
      else 0
    end;
    return next;
  end loop;
  return;
end;
$$;

-- FUNCTION: backfill_badge_for_all_eligible ---------------------------------
-- Called from seed migrations after inserting new badges. Iterates all
-- students, checks eligibility, inserts unlocks + awards coins. Silent
-- (no celebration events). Idempotent via on conflict do nothing.
-- Returns the number of students newly unlocked.

create or replace function public.backfill_badge_for_all_eligible(p_badge_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.badges%rowtype;
  sp record;
  awarded int := 0;
  student_tier public.subscription_tier;
begin
  select * into b from public.badges where id = p_badge_id and is_active;
  if not found then
    return 0;
  end if;

  for sp in select id from public.student_profiles loop
    -- skip already-owned
    if exists (
      select 1 from public.student_badges
      where student_id = sp.id and badge_id = b.id
    ) then
      continue;
    end if;

    -- skip tier-gated
    select subscription_tier into student_tier
    from public.student_profiles where id = sp.id;
    if student_tier < b.required_tier then
      continue;
    end if;

    -- eligibility
    if not public.check_trigger_eligibility(sp.id, b.trigger_type, b.trigger_params) then
      continue;
    end if;

    insert into public.student_badges (student_id, badge_id)
    values (sp.id, b.id)
    on conflict do nothing;

    if b.coin_reward > 0 then
      update public.student_profiles
      set coins = coalesce(coins, 0) + b.coin_reward
      where id = sp.id;
    end if;

    awarded := awarded + 1;
  end loop;

  return awarded;
end;
$$;

-- FUNCTION: get_child_badge_summary -----------------------------------------
-- Returns (lifetime, this_week) badge counts for a given child. Used by the
-- parent StatisticsPage card. RLS is enforced at the student_badges read
-- policy level (parent can read badges of linked children).

create or replace function public.get_child_badge_summary(p_child_id uuid)
returns table (
  lifetime integer,
  this_week integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.student_badges
     where student_id = p_child_id) as lifetime,
    (select count(*)::int from public.student_badges
     where student_id = p_child_id
       and unlocked_at >= date_trunc('week', now())) as this_week;
$$;

-- ============================================================================
-- Updated existing RPCs with badge check hook
-- ============================================================================

-- complete_practice_session: also updates max_streak and returns newly_unlocked_badges
create or replace function public.complete_practice_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid;
  v_completed_at timestamptz;
  v_correct_count integer;
  v_total_time_seconds integer;
  v_base_xp constant integer := 25;
  v_bonus_xp_per_correct constant integer := 15;
  v_base_coins constant integer := 10;
  v_bonus_coins_per_correct constant integer := 5;
  v_total_xp integer;
  v_total_coins integer;
  v_new_badges jsonb;
begin
  -- Check if session exists and is not already completed
  select student_id, completed_at
  into v_student_id, v_completed_at
  from practice_sessions
  where id = p_session_id;

  if v_student_id is null then
    raise exception 'Session not found: %', p_session_id;
  end if;

  if v_completed_at is not null then
    raise exception 'Session already completed: %', p_session_id;
  end if;

  -- Count correct answers from actual answer records (not client-supplied)
  select
    count(*) filter (where is_correct = true),
    coalesce(sum(time_spent_seconds), 0)
  into v_correct_count, v_total_time_seconds
  from practice_answers
  where session_id = p_session_id;

  -- Calculate rewards server-side
  v_total_xp := v_base_xp + (v_correct_count * v_bonus_xp_per_correct);
  v_total_coins := v_base_coins + (v_correct_count * v_bonus_coins_per_correct);

  -- Update the practice session with completion data
  -- Setting completed_at fires the auto_mark_practiced_on_complete trigger,
  -- which upserts daily_statuses with the correct local timezone date
  -- and cascades to update the student's streak
  update practice_sessions
  set
    completed_at = now(),
    total_time_seconds = v_total_time_seconds,
    correct_count = v_correct_count,
    xp_earned = v_total_xp,
    coins_earned = v_total_coins
  where id = p_session_id;

  -- Award XP and coins to the student
  update student_profiles
  set
    xp = xp + v_total_xp,
    coins = coins + v_total_coins
  where id = v_student_id;

  -- NEW: update max_streak (for max_streak_ever badge trigger)
  update public.student_profiles
  set max_streak = greatest(max_streak, current_streak)
  where id = v_student_id;

  -- NEW: defensive badge check
  begin
    select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) into v_new_badges
    from public.check_and_award_badges(v_student_id) b;
  exception when others then
    raise warning 'badge check failed for student %: %', v_student_id, sqlerrm;
    v_new_badges := '[]'::jsonb;
  end;

  return jsonb_build_object(
    'xp_earned', v_total_xp,
    'coins_earned', v_total_coins,
    'correct_count', v_correct_count,
    'newly_unlocked_badges', v_new_badges
  );
end;
$$;
