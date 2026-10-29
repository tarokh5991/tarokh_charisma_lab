create or replace function public.weekly_leaderboard()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', profiles.id,
    'username', profiles.username,
    'practice_count', coalesce(activity.practice_count, 0)
  ) order by coalesce(activity.practice_count, 0) desc, profiles.created_at asc), '[]'::jsonb)
  from public.profiles
  left join (
    select user_id, count(*)::integer as practice_count
    from public.lesson_progress
    where exercise_completed_at >= date_trunc('week', now())
    group by user_id
  ) activity on activity.user_id = profiles.id
  where profiles.role = 'learner'
    and profiles.is_banned = false;
$$;

revoke all on function public.weekly_leaderboard() from public;
grant execute on function public.weekly_leaderboard() to authenticated;
