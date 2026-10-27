create or replace function public.admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'totals', jsonb_build_object(
      'users', (select count(*) from public.profiles),
      'learners', (select count(*) from public.profiles where role = 'learner'),
      'active_entitlements', (select count(*) from public.entitlements where status = 'active' and ends_at > now()),
      'paid_orders', (select count(*) from public.orders where status = 'paid'),
      'revenue_toman', coalesce((select sum(amount_toman) from public.orders where status = 'paid'), 0),
      'ai_messages_today', coalesce((select sum(message_count) from public.ai_usage_daily where usage_date = current_date), 0),
      'ai_messages_all_time', coalesce((select sum(message_count) from public.ai_usage_daily), 0),
      'lesson_completions', (select count(*) from public.lesson_progress where completed_at is not null),
      'exercise_completions', (select count(*) from public.lesson_progress where exercise_completed_at is not null),
      'lessons_published', (select count(*) from public.lessons where is_published)
    ),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object('name', plan_name, 'count', plan_count) order by plan_count desc)
      from (
        select plans.name as plan_name, count(*) as plan_count
        from public.entitlements
        join public.plans on plans.id = entitlements.plan_id
        where entitlements.status = 'active' and entitlements.ends_at > now()
        group by plans.name
      ) active_plans
    ), '[]'::jsonb),
    'usage', coalesce((
      select jsonb_agg(jsonb_build_object('date', usage_date, 'count', total) order by usage_date desc)
      from (
        select usage_date, sum(message_count)::integer as total
        from public.ai_usage_daily
        where usage_date > current_date - interval '13 days'
        group by usage_date
      ) recent_usage
    ), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', recent_orders.id,
        'customer_name', recent_orders.customer_name,
        'username', recent_orders.username,
        'plan', recent_orders.plan_name,
        'amount_toman', recent_orders.amount_toman,
        'status', recent_orders.status,
        'created_at', recent_orders.created_at
      ) order by recent_orders.created_at desc)
      from (
        select orders.id, orders.customer_name, profiles.username, plans.name as plan_name,
               orders.amount_toman, orders.status, orders.created_at
        from public.orders
        join public.profiles on profiles.id = orders.user_id
        join public.plans on plans.id = orders.plan_id
        order by orders.created_at desc
        limit 30
      ) recent_orders
    ), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', recent_users.id,
        'username', recent_users.username,
        'display_name', recent_users.display_name,
        'role', recent_users.role,
        'created_at', recent_users.created_at,
        'plan', recent_users.plan_name,
        'plan_ends_at', recent_users.ends_at,
        'completed_lessons', recent_users.completed_lessons,
        'ai_messages', recent_users.ai_messages
      ) order by recent_users.created_at desc)
      from (
        select profiles.id, profiles.username, profiles.display_name, profiles.role, profiles.created_at,
               active_plan.plan_name, active_plan.ends_at,
               (select count(*) from public.lesson_progress where lesson_progress.user_id = profiles.id and completed_at is not null) as completed_lessons,
               coalesce((select sum(message_count) from public.ai_usage_daily where ai_usage_daily.user_id = profiles.id), 0) as ai_messages
        from public.profiles
        left join lateral (
          select plans.name as plan_name, entitlements.ends_at
          from public.entitlements
          join public.plans on plans.id = entitlements.plan_id
          where entitlements.user_id = profiles.id
            and entitlements.status = 'active'
            and entitlements.ends_at > now()
          order by entitlements.starts_at desc
          limit 1
        ) active_plan on true
        order by profiles.created_at desc
        limit 100
      ) recent_users
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_overview() from public;
grant execute on function public.admin_overview() to authenticated;

create or replace function public.admin_set_lesson_published(target_lesson_id uuid, published boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  update public.lessons set is_published = published where id = target_lesson_id;
end;
$$;

revoke all on function public.admin_set_lesson_published(uuid, boolean) from public;
grant execute on function public.admin_set_lesson_published(uuid, boolean) to authenticated;
