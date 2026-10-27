update public.plans
set price_toman = case slug
  when 'bronze' then 2500000
  when 'silver' then 3500000
  when 'gold' then 6500000
  when 'diamond' then 10000000
end
where slug in ('bronze', 'silver', 'gold', 'diamond');

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
      'phone', users.phone
    ),
    'assessment', coalesce((
      select jsonb_build_object(
        'recommended_dimensions', assessments.recommended_dimensions,
        'created_at', assessments.created_at
      )
      from public.assessments
      where assessments.user_id = target_user_id
      order by assessments.created_at desc
      limit 1
    ), '{}'::jsonb),
    'entitlements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'plan', plans.name,
        'status', entitlements.status,
        'starts_at', entitlements.starts_at,
        'ends_at', entitlements.ends_at
      ) order by entitlements.starts_at desc)
      from public.entitlements
      join public.plans on plans.id = entitlements.plan_id
      where entitlements.user_id = target_user_id
    ), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'plan', plans.name,
        'amount_toman', orders.amount_toman,
        'status', orders.status,
        'customer_name', orders.customer_name,
        'created_at', orders.created_at,
        'paid_at', orders.paid_at
      ) order by orders.created_at desc)
      from public.orders
      join public.plans on plans.id = orders.plan_id
      where orders.user_id = target_user_id
    ), '[]'::jsonb),
    'lessons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', lessons.title,
        'path', learning_paths.title,
        'completed_at', lesson_progress.completed_at,
        'exercise_completed_at', lesson_progress.exercise_completed_at
      ) order by learning_paths.position, lessons.position)
      from public.lesson_progress
      join public.lessons on lessons.id = lesson_progress.lesson_id
      join public.course_modules on course_modules.id = lessons.module_id
      join public.learning_paths on learning_paths.id = course_modules.path_id
      where lesson_progress.user_id = target_user_id
    ), '[]'::jsonb),
    'challenges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', challenge_key,
        'month_start', month_start,
        'completed_at', completed_at
      ) order by month_start desc)
      from public.monthly_challenge_progress
      where user_id = target_user_id
    ), '[]'::jsonb),
    'ai_usage', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', usage_date,
        'message_count', message_count
      ) order by usage_date desc)
      from public.ai_usage_daily
      where user_id = target_user_id
    ), '[]'::jsonb),
    'conversations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', conversations.title,
        'scenario_key', conversations.scenario_key,
        'created_at', conversations.created_at,
        'updated_at', conversations.updated_at,
        'messages', coalesce((
          select jsonb_agg(jsonb_build_object(
            'role', messages.role,
            'content', messages.content,
            'feedback', messages.feedback,
            'created_at', messages.created_at
          ) order by messages.created_at)
          from public.ai_messages messages
          where messages.conversation_id = conversations.id
        ), '[]'::jsonb)
      ) order by conversations.updated_at desc)
      from public.ai_conversations conversations
      where conversations.user_id = target_user_id
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

revoke all on function public.admin_user_detail(uuid) from public;
grant execute on function public.admin_user_detail(uuid) to authenticated;
