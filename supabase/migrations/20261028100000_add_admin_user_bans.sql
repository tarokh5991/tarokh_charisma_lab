alter table public.profiles
  add column is_banned boolean not null default false,
  add column banned_until timestamptz;

create or replace function public.admin_set_user_ban(target_user_id uuid, ban_period text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  next_banned_until timestamptz;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'user not found';
  end if;

  if exists (select 1 from public.profiles where id = target_user_id and role = 'admin') then
    raise exception 'administrators cannot be banned';
  end if;

  case ban_period
    when 'three_days' then next_banned_until := now() + interval '3 days';
    when 'seven_days' then next_banned_until := now() + interval '7 days';
    when 'fourteen_days' then next_banned_until := now() + interval '14 days';
    when 'permanent' then next_banned_until := now() + interval '100 years';
    when 'remove' then next_banned_until := null;
    else raise exception 'invalid ban period';
  end case;

  update public.profiles
  set is_banned = ban_period <> 'remove',
      banned_until = case when ban_period = 'permanent' then null else next_banned_until end
  where id = target_user_id;

  update auth.users
  set banned_until = next_banned_until
  where id = target_user_id;
end;
$$;

revoke all on function public.admin_set_user_ban(uuid, text) from public;
grant execute on function public.admin_set_user_ban(uuid, text) to authenticated;

create or replace function public.admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
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
        'ai_messages', recent_users.ai_messages,
        'is_banned', recent_users.is_banned,
        'banned_until', recent_users.banned_until
      ) order by recent_users.created_at desc)
      from (
        select profiles.id, profiles.username, profiles.display_name, profiles.role, profiles.created_at,
               active_plan.plan_name, active_plan.ends_at,
               profiles.is_banned, profiles.banned_until,
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

create or replace function public.admin_user_detail(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', profiles.id,
      'username', profiles.username,
      'display_name', profiles.display_name,
      'role', profiles.role,
      'created_at', profiles.created_at,
      'email', users.email,
      'phone', users.phone,
      'is_banned', profiles.is_banned,
      'banned_until', profiles.banned_until
    ),
    'assessment', coalesce((
      select jsonb_build_object('recommended_dimensions', assessments.recommended_dimensions, 'created_at', assessments.created_at)
      from public.assessments where assessments.user_id = target_user_id order by assessments.created_at desc limit 1
    ), '{}'::jsonb),
    'entitlements', coalesce((
      select jsonb_agg(jsonb_build_object('plan', plans.name, 'status', entitlements.status, 'starts_at', entitlements.starts_at, 'ends_at', entitlements.ends_at) order by entitlements.starts_at desc)
      from public.entitlements join public.plans on plans.id = entitlements.plan_id where entitlements.user_id = target_user_id
    ), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object('plan', plans.name, 'amount_toman', orders.amount_toman, 'status', orders.status, 'customer_name', orders.customer_name, 'created_at', orders.created_at, 'paid_at', orders.paid_at) order by orders.created_at desc)
      from public.orders join public.plans on plans.id = orders.plan_id where orders.user_id = target_user_id
    ), '[]'::jsonb),
    'lessons', coalesce((
      select jsonb_agg(jsonb_build_object('title', lessons.title, 'path', learning_paths.title, 'completed_at', lesson_progress.completed_at, 'exercise_completed_at', lesson_progress.exercise_completed_at) order by learning_paths.position, lessons.position)
      from public.lesson_progress join public.lessons on lessons.id = lesson_progress.lesson_id join public.course_modules on course_modules.id = lessons.module_id join public.learning_paths on learning_paths.id = course_modules.path_id where lesson_progress.user_id = target_user_id
    ), '[]'::jsonb),
    'challenges', coalesce((
      select jsonb_agg(jsonb_build_object('key', challenge_key, 'month_start', month_start, 'completed_at', completed_at) order by month_start desc)
      from public.monthly_challenge_progress where user_id = target_user_id
    ), '[]'::jsonb),
    'ai_usage', coalesce((
      select jsonb_agg(jsonb_build_object('date', usage_date, 'message_count', message_count) order by usage_date desc)
      from public.ai_usage_daily where user_id = target_user_id
    ), '[]'::jsonb),
    'conversations', coalesce((
      select jsonb_agg(jsonb_build_object('title', conversations.title, 'scenario_key', conversations.scenario_key, 'created_at', conversations.created_at, 'updated_at', conversations.updated_at, 'messages', coalesce((
        select jsonb_agg(jsonb_build_object('role', messages.role, 'content', messages.content, 'feedback', messages.feedback, 'created_at', messages.created_at) order by messages.created_at)
        from public.ai_messages messages where messages.conversation_id = conversations.id
      ), '[]'::jsonb)) order by conversations.updated_at desc)
      from public.ai_conversations conversations where conversations.user_id = target_user_id
    ), '[]'::jsonb)
  ) into result
  from public.profiles profiles
  left join auth.users users on users.id = profiles.id
  where profiles.id = target_user_id;

  if result is null then
    raise exception 'user not found';
  end if;

  return result;
end;
$$;
