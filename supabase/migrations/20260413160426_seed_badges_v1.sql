-- ============================================================================
-- v1 Badge Catalog Seed
-- Spec: docs/superpowers/specs/2026-04-13-achievements-badges-design.md
-- Distribution: 6 Bronze / 6 Silver / 5 Gold / 5 Platinum / 3 Diamond / 4 Master / 2 Grandmaster
-- Tier-gated: plus_explorer (plus), pro_scholar (pro) — both at Master tier
-- ============================================================================

insert into public.badges (slug, trigger_type, trigger_params, tier, coin_reward, icon_path, required_tier)
values
  -- Bronze (6)
  ('first_steps',       'total_sessions_completed', '{"threshold":1}',    'bronze', 15, 'badges/first_steps.png',       'core'),
  ('first_week',        'total_days_practiced',     '{"threshold":7}',    'bronze', 15, 'badges/first_week.png',        'core'),
  ('spark',             'current_streak',           '{"threshold":3}',    'bronze', 15, 'badges/spark.png',             'core'),
  ('perfectionist',     'perfect_sessions_count',   '{"threshold":5}',    'bronze', 15, 'badges/perfectionist.png',     'core'),
  ('xp_novice',         'total_xp_earned',          '{"threshold":500}',  'bronze', 15, 'badges/xp_novice.png',         'core'),
  ('curious_mind',      'total_questions_answered', '{"threshold":100}',  'bronze', 15, 'badges/curious_mind.png',      'core'),

  -- Silver (6)
  ('getting_started',   'total_sessions_completed', '{"threshold":10}',   'silver', 35, 'badges/getting_started.png',   'core'),
  ('first_month',       'total_days_practiced',     '{"threshold":30}',   'silver', 35, 'badges/first_month.png',       'core'),
  ('hot_streak',        'current_streak',           '{"threshold":7}',    'silver', 35, 'badges/hot_streak.png',        'core'),
  ('xp_adept',          'total_xp_earned',          '{"threshold":5000}', 'silver', 35, 'badges/xp_adept.png',          'core'),
  ('flawless',          'perfect_sessions_count',   '{"threshold":25}',   'silver', 35, 'badges/flawless.png',          'core'),
  ('pet_collector',     'unique_pets_owned',        '{"threshold":5}',    'silver', 35, 'badges/pet_collector.png',     'core'),

  -- Gold (5)
  ('dedicated_learner', 'total_sessions_completed', '{"threshold":50}',   'gold',   80, 'badges/dedicated_learner.png', 'core'),
  ('unstoppable',       'current_streak',           '{"threshold":30}',   'gold',   80, 'badges/unstoppable.png',       'core'),
  ('pet_enthusiast',    'unique_pets_owned',        '{"threshold":15}',   'gold',   80, 'badges/pet_enthusiast.png',    'core'),
  ('evolved',           'pet_max_tier_reached',     '{}',                 'gold',   80, 'badges/evolved.png',           'core'),
  ('prolific_thinker',  'total_questions_answered', '{"threshold":1000}', 'gold',   80, 'badges/prolific_thinker.png',  'core'),

  -- Platinum (5)
  ('serious_student',   'total_sessions_completed', '{"threshold":200}',  'platinum', 175, 'badges/serious_student.png',   'core'),
  ('centurion',         'total_days_practiced',     '{"threshold":100}',  'platinum', 175, 'badges/centurion.png',         'core'),
  ('xp_master',         'total_xp_earned',          '{"threshold":25000}','platinum', 175, 'badges/xp_master.png',         'core'),
  ('math_proficient',   'subject_accuracy_threshold','{"subject_id":"any","min_percentage":70,"min_questions":50}', 'platinum', 175, 'badges/math_proficient.png', 'core'),
  ('immaculate',        'perfect_sessions_count',   '{"threshold":100}',  'platinum', 175, 'badges/immaculate.png',        'core'),

  -- Diamond (3)
  ('devoted_scholar',   'total_sessions_completed', '{"threshold":500}',  'diamond', 400, 'badges/devoted_scholar.png',   'core'),
  ('legendary_streak',  'max_streak_ever',          '{"threshold":60}',   'diamond', 400, 'badges/legendary_streak.png',  'core'),
  ('legendary_tamer',   'pets_of_rarity_count',     '{"rarity":"legendary","threshold":1}', 'diamond', 400, 'badges/legendary_tamer.png', 'core'),

  -- Master (4) — includes the two tier-gated launch badges
  ('xp_legend',         'total_xp_earned',          '{"threshold":50000}','master', 900, 'badges/xp_legend.png',         'core'),
  ('summit_streak',     'max_streak_ever',          '{"threshold":100}',  'master', 900, 'badges/summit_streak.png',     'core'),
  ('plus_explorer',     'total_sessions_completed', '{"threshold":300}',  'master', 900, 'badges/plus_explorer.png',     'plus'),
  ('pro_scholar',       'total_days_practiced',     '{"threshold":200}',  'master', 900, 'badges/pro_scholar.png',       'pro'),

  -- Grandmaster (2) — free-earnable apex
  ('eternal_scholar',      'total_sessions_completed','{"threshold":2000}', 'grandmaster', 2000, 'badges/eternal_scholar.png',      'core'),
  ('grand_perfectionist',  'perfect_sessions_count', '{"threshold":500}',   'grandmaster', 2000, 'badges/grand_perfectionist.png',  'core')
;

-- Retroactive backfill: for every badge we just inserted, grant to all
-- already-eligible students and award coins. Silent (no celebration dialogs).
do $$
declare
  b_id uuid;
begin
  for b_id in
    select id from public.badges
    where slug in (
      'first_steps','first_week','spark','perfectionist','xp_novice','curious_mind',
      'getting_started','first_month','hot_streak','xp_adept','flawless','pet_collector',
      'dedicated_learner','unstoppable','pet_enthusiast','evolved','prolific_thinker',
      'serious_student','centurion','xp_master','math_proficient','immaculate',
      'devoted_scholar','legendary_streak','legendary_tamer',
      'xp_legend','summit_streak','plus_explorer','pro_scholar',
      'eternal_scholar','grand_perfectionist'
    )
  loop
    perform public.backfill_badge_for_all_eligible(b_id);
  end loop;
end $$;
