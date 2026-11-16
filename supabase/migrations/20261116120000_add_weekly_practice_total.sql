create or replace function public.weekly_practice_total()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count(*), 0)::integer
  from public.lesson_progress progress
  join public.profiles profiles on profiles.id = progress.user_id
  where progress.exercise_completed_at >= date_trunc('week', now())
    and profiles.role = 'learner'
    and profiles.is_banned = false;
$$;

revoke all on function public.weekly_practice_total() from public;
grant execute on function public.weekly_practice_total() to authenticated;
