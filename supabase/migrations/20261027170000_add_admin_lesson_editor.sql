create or replace function public.admin_update_lesson(
  target_lesson_id uuid,
  next_title text,
  next_summary text,
  next_duration_minutes smallint,
  next_body jsonb
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

  if length(trim(next_title)) = 0 or length(trim(next_summary)) = 0 or next_duration_minutes < 1 then
    raise exception 'invalid lesson data';
  end if;

  update public.lessons
  set title = trim(next_title),
      summary = trim(next_summary),
      duration_minutes = next_duration_minutes,
      body = next_body
  where id = target_lesson_id;
end;
$$;

revoke all on function public.admin_update_lesson(uuid, text, text, smallint, jsonb) from public;
grant execute on function public.admin_update_lesson(uuid, text, text, smallint, jsonb) to authenticated;
