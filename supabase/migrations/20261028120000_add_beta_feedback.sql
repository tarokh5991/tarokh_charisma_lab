create table public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.beta_feedback enable row level security;

create policy "Users can submit beta feedback" on public.beta_feedback
  for insert to authenticated
  with check (user_id = auth.uid());

create or replace function public.admin_recent_beta_feedback()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'username', profiles.username,
      'rating', beta_feedback.rating,
      'message', beta_feedback.message,
      'created_at', beta_feedback.created_at
    ) order by beta_feedback.created_at desc)
    from (
      select * from public.beta_feedback order by created_at desc limit 30
    ) beta_feedback
    join public.profiles on profiles.id = beta_feedback.user_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_recent_beta_feedback() from public;
grant execute on function public.admin_recent_beta_feedback() to authenticated;
