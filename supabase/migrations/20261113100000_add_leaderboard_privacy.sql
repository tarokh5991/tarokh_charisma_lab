alter table public.profiles
  add column if not exists show_in_leaderboard boolean not null default true;

create or replace function public.weekly_leaderboard()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select profiles.id,
           profiles.username,
           profiles.created_at,
           profiles.show_in_leaderboard,
           activity.practice_count,
           row_number() over (
             order by activity.practice_count desc, profiles.created_at asc
           )::integer as rank
    from public.profiles
    join (
      select user_id, count(*)::integer as practice_count
      from public.lesson_progress
      where exercise_completed_at >= date_trunc('week', now())
      group by user_id
    ) activity on activity.user_id = profiles.id
    where profiles.role = 'learner'
      and profiles.is_banned = false
      and activity.practice_count > 0
  ),
  visible as (
    select * from ranked
    where public.is_admin()
       or (rank <= 20 and (show_in_leaderboard or id = auth.uid()))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', visible.id,
    'username', visible.username,
    'practice_count', visible.practice_count,
    'rank', visible.rank
  ) order by visible.rank), '[]'::jsonb)
  from visible;
$$;

revoke all on function public.weekly_leaderboard() from public;
grant execute on function public.weekly_leaderboard() to authenticated;
