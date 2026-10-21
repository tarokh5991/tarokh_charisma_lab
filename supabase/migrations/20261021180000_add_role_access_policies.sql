revoke update on public.profiles from authenticated;
grant update (username, display_name, avatar_url, timezone) on public.profiles to authenticated;

create policy "Admins can read all profiles" on public.profiles
  for select using (public.is_admin());

create policy "Admins can manage profiles" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins can manage plans" on public.plans
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins can manage learning paths" on public.learning_paths
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins can manage course modules" on public.course_modules
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins can manage lessons" on public.lessons
  for all using (public.is_admin()) with check (public.is_admin());

create policy "Admins can manage mentoring sessions" on public.mentoring_sessions
  for all using (public.is_admin()) with check (public.is_admin());
