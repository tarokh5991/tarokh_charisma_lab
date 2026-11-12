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
           coalesce(activity.practice_count, 0) as practice_count,
           row_number() over (
             order by coalesce(activity.practice_count, 0) desc, profiles.created_at asc
           )::integer as rank
    from public.profiles
    left join (
      select user_id, count(*)::integer as practice_count
      from public.lesson_progress
      where exercise_completed_at >= date_trunc('week', now())
      group by user_id
    ) activity on activity.user_id = profiles.id
    where profiles.role = 'learner'
      and profiles.is_banned = false
  ),
  visible as (
    select * from ranked
    where public.is_admin()
       or rank <= 20
       or id = auth.uid()
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
