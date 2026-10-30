alter table public.profiles
  add column email_hash text;

update public.profiles
set email_hash = encode(digest(lower(trim(auth.users.email)), 'sha256'), 'hex')
from auth.users
where auth.users.id = profiles.id
  and auth.users.email is not null;

create unique index profiles_email_hash_idx
  on public.profiles (email_hash)
  where email_hash is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, email_hash)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      ''
    ),
    case
      when new.email is null then null
      else encode(digest(lower(trim(new.email)), 'sha256'), 'hex')
    end
  );
  return new;
end;
$$;

create or replace function public.registration_email_exists(input_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where email_hash = encode(digest(lower(trim(input_email)), 'sha256'), 'hex')
  );
$$;

revoke all on function public.registration_email_exists(text) from public;
grant execute on function public.registration_email_exists(text) to anon, authenticated;
