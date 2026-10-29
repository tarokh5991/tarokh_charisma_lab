alter table public.beta_feedback
  add column plan_name text;

update public.beta_feedback as feedback
set plan_name = active_plan.name
from (
  select distinct on (entitlements.user_id)
    entitlements.user_id,
    plans.name
  from public.entitlements
  join public.plans on plans.id = entitlements.plan_id
  where entitlements.status = 'active'
    and entitlements.ends_at > now()
  order by entitlements.user_id, entitlements.starts_at desc
) as active_plan
where feedback.user_id = active_plan.user_id
  and feedback.plan_name is null;

create or replace function public.set_beta_feedback_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select plans.name
  into new.plan_name
  from public.entitlements
  join public.plans on plans.id = entitlements.plan_id
  where entitlements.user_id = new.user_id
    and entitlements.status = 'active'
    and entitlements.ends_at > now()
  order by entitlements.starts_at desc
  limit 1;

  return new;
end;
$$;

create trigger beta_feedback_plan_snapshot
before insert on public.beta_feedback
for each row execute function public.set_beta_feedback_plan();

revoke all on function public.set_beta_feedback_plan() from public;

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
      'plan_name', beta_feedback.plan_name,
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

create or replace function public.featured_beta_feedback()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'username', profiles.username,
    'plan_name', beta_feedback.plan_name,
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
