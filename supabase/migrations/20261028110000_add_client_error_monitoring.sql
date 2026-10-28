create table public.client_error_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  page text not null check (char_length(page) between 1 and 120),
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

create index client_error_events_created_at_idx on public.client_error_events (created_at desc);

alter table public.client_error_events enable row level security;

create or replace function public.log_client_error(error_page text, error_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if char_length(trim(error_page)) = 0 or char_length(trim(error_page)) > 120
    or char_length(trim(error_message)) = 0 or char_length(trim(error_message)) > 500 then
    raise exception 'invalid error event';
  end if;

  if (select count(*) from public.client_error_events where user_id = auth.uid() and created_at > now() - interval '1 minute') >= 10 then
    return;
  end if;

  insert into public.client_error_events (user_id, page, message)
  values (auth.uid(), trim(error_page), trim(error_message));
end;
$$;

create or replace function public.admin_recent_client_errors()
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
      'page', client_error_events.page,
      'message', client_error_events.message,
      'created_at', client_error_events.created_at
    ) order by client_error_events.created_at desc)
    from (
      select * from public.client_error_events order by created_at desc limit 30
    ) client_error_events
    join public.profiles on profiles.id = client_error_events.user_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.log_client_error(text, text) from public;
grant execute on function public.log_client_error(text, text) to authenticated;
revoke all on function public.admin_recent_client_errors() from public;
grant execute on function public.admin_recent_client_errors() to authenticated;
