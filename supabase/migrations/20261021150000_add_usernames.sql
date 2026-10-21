alter table public.profiles add column if not exists username text;

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username))
  where username is not null and username <> '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      ''
    )
  );
  return new;
end;
$$;
