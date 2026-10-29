alter table public.beta_feedback
  add column is_featured boolean not null default false;

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
      'id', beta_feedback.id,
      'username', profiles.username,
      'rating', beta_feedback.rating,
      'message', beta_feedback.message,
      'is_featured', beta_feedback.is_featured,
      'created_at', beta_feedback.created_at
    ) order by beta_feedback.created_at desc)
    from (
      select * from public.beta_feedback order by created_at desc limit 30
    ) beta_feedback
    join public.profiles on profiles.id = beta_feedback.user_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_set_beta_feedback_featured(
  feedback_id uuid,
  featured boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  perform pg_advisory_xact_lock(hashtext('beta_feedback_featured_limit'));

  if featured and (
    select count(*) from public.beta_feedback where is_featured
  ) >= 3 then
    raise exception 'حداکثر سه بازخورد می‌تواند در صفحهٔ خانه نمایش داده شود.';
  end if;

  update public.beta_feedback
  set is_featured = featured
  where id = feedback_id;
end;
$$;

create or replace function public.featured_beta_feedback()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'username', profiles.username,
    'rating', beta_feedback.rating,
    'message', beta_feedback.message,
    'created_at', beta_feedback.created_at
  ) order by beta_feedback.created_at desc), '[]'::jsonb)
  from (
    select * from public.beta_feedback
    where is_featured
    order by created_at desc
    limit 3
  ) beta_feedback
  join public.profiles on profiles.id = beta_feedback.user_id;
$$;

revoke all on function public.admin_set_beta_feedback_featured(uuid, boolean) from public;
grant execute on function public.admin_set_beta_feedback_featured(uuid, boolean) to authenticated;
revoke all on function public.featured_beta_feedback() from public;
grant execute on function public.featured_beta_feedback() to anon, authenticated;
