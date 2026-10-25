create or replace function public.get_coach_quota()
returns table (allowed boolean, remaining integer, monthly_limit integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_limit integer;
  has_plan boolean := false;
  used_count integer := 0;
  current_month date := date_trunc('month', now())::date;
begin
  if auth.uid() is null then
    return query select false, 0, 0;
    return;
  end if;

  select plans.ai_message_limit, true into plan_limit, has_plan
  from public.entitlements
  join public.plans on plans.id = entitlements.plan_id
  where entitlements.user_id = auth.uid()
    and entitlements.status = 'active'
    and (entitlements.ends_at is null or entitlements.ends_at > now())
  order by entitlements.starts_at desc
  limit 1;

  select message_count into used_count
  from public.ai_usage_monthly
  where user_id = auth.uid() and month_start = current_month;

  if plan_limit is null then
    return query select has_plan, case when has_plan then null::integer else 0 end, case when has_plan then null::integer else 0 end;
  end if;

  return query select coalesce(plan_limit > coalesce(used_count, 0), false), greatest(plan_limit - coalesce(used_count, 0), 0), plan_limit;
end;
$$;

create or replace function public.consume_coach_message()
returns table (allowed boolean, remaining integer, monthly_limit integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_limit integer;
  has_plan boolean := false;
  new_count integer;
  current_month date := date_trunc('month', now())::date;
begin
  if auth.uid() is null then
    return query select false, 0, 0;
    return;
  end if;

  select plans.ai_message_limit, true into plan_limit, has_plan
  from public.entitlements
  join public.plans on plans.id = entitlements.plan_id
  where entitlements.user_id = auth.uid()
    and entitlements.status = 'active'
    and (entitlements.ends_at is null or entitlements.ends_at > now())
  order by entitlements.starts_at desc
  limit 1;

  if plan_limit is null then
    if not has_plan then
      return query select false, 0, 0;
      return;
    end if;
    insert into public.ai_usage_monthly (user_id, month_start, message_count)
    values (auth.uid(), current_month, 1)
    on conflict (user_id, month_start) do update set message_count = ai_usage_monthly.message_count + 1;
    return query select true, null::integer, null::integer;
    return;
  end if;

  if plan_limit <= 0 then
    return query select false, 0, plan_limit;
    return;
  end if;

  insert into public.ai_usage_monthly (user_id, month_start, message_count)
  values (auth.uid(), current_month, 0)
  on conflict (user_id, month_start) do nothing;

  update public.ai_usage_monthly
  set message_count = message_count + 1
  where user_id = auth.uid()
    and month_start = current_month
    and message_count < plan_limit
  returning message_count into new_count;

  if new_count is null then
    select message_count into new_count
    from public.ai_usage_monthly
    where user_id = auth.uid() and month_start = current_month;
    return query select false, greatest(plan_limit - coalesce(new_count, 0), 0), plan_limit;
    return;
  end if;

  return query select true, plan_limit - new_count, plan_limit;
end;
$$;

revoke all on function public.get_coach_quota() from public;
revoke all on function public.consume_coach_message() from public;
grant execute on function public.get_coach_quota() to authenticated;
grant execute on function public.consume_coach_message() to authenticated;
