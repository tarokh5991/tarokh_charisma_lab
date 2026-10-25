update public.entitlements
set ends_at = starts_at + interval '1 month'
where ends_at is null;

alter table public.entitlements
  alter column ends_at set not null;

drop function if exists public.activate_demo_plan(text, text);

create or replace function public.activate_demo_plan(requested_plan_slug text, customer_full_name text)
returns table (order_id uuid, plan_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_plan public.plans%rowtype;
  created_order_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  if customer_full_name is null or length(trim(customer_full_name)) < 3 then
    raise exception 'customer_name_required';
  end if;

  select * into selected_plan
  from public.plans
  where slug = requested_plan_slug and is_active
  limit 1;

  if selected_plan.id is null then
    raise exception 'plan_not_found';
  end if;

  update public.entitlements
  set status = 'expired', ends_at = now()
  where user_id = auth.uid() and status = 'active';

  insert into public.orders (user_id, plan_id, amount_toman, status, gateway, gateway_reference, customer_name)
  values (auth.uid(), selected_plan.id, selected_plan.price_toman, 'paid', 'demo', 'demo-' || gen_random_uuid()::text, trim(customer_full_name))
  returning id into created_order_id;

  insert into public.entitlements (user_id, plan_id, status, starts_at, ends_at)
  values (auth.uid(), selected_plan.id, 'active', now(), now() + interval '1 month');

  return query select created_order_id, selected_plan.name;
end;
$$;

revoke all on function public.activate_demo_plan(text, text) from public;
grant execute on function public.activate_demo_plan(text, text) to authenticated;
