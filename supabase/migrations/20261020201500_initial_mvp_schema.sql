create extension if not exists "pgcrypto";

create type public.user_role as enum ('learner', 'mentor', 'admin');
create type public.clear_dimension as enum ('confidence', 'listening', 'expression', 'awareness', 'rapport');
create type public.entitlement_status as enum ('active', 'cancelled', 'expired');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.ai_message_role as enum ('user', 'assistant');
create type public.booking_status as enum ('booked', 'completed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'learner',
  display_name text,
  avatar_url text,
  timezone text not null default 'Asia/Tehran',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  price_toman integer not null check (price_toman >= 0),
  ai_message_limit integer,
  includes_group boolean not null default false,
  includes_mentoring boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  dimension public.clear_dimension not null unique,
  title text not null,
  description text not null,
  position smallint not null unique check (position > 0)
);

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.learning_paths(id) on delete cascade,
  title text not null,
  description text,
  position smallint not null check (position > 0),
  unique (path_id, position)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  slug text not null unique,
  title text not null,
  summary text not null,
  body jsonb not null default '{}'::jsonb,
  video_url text,
  duration_minutes smallint not null check (duration_minutes > 0),
  position smallint not null check (position > 0),
  is_published boolean not null default false,
  unique (module_id, position)
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null,
  recommended_dimensions public.clear_dimension[] not null,
  created_at timestamptz not null default now()
);

create table public.lesson_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz,
  exercise_completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status public.entitlement_status not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  plan_id uuid not null references public.plans(id),
  amount_toman integer not null check (amount_toman >= 0),
  status public.payment_status not null default 'pending',
  gateway text,
  gateway_reference text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  scenario_key text not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role public.ai_message_role not null,
  content text not null,
  feedback jsonb,
  created_at timestamptz not null default now()
);

create table public.ai_usage_monthly (
  user_id uuid not null references public.profiles(id) on delete cascade,
  month_start date not null,
  message_count integer not null default 0 check (message_count >= 0),
  primary key (user_id, month_start)
);

create table public.mentoring_sessions (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  capacity smallint not null check (capacity > 0),
  meeting_url text,
  is_published boolean not null default false
);

create table public.mentoring_bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mentoring_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.booking_status not null default 'booked',
  practice_submission_url text,
  mentor_feedback text,
  created_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create index assessments_user_id_created_at_idx on public.assessments (user_id, created_at desc);
create index lesson_progress_user_id_idx on public.lesson_progress (user_id);
create index entitlements_user_id_status_idx on public.entitlements (user_id, status);
create index orders_user_id_created_at_idx on public.orders (user_id, created_at desc);
create index ai_conversations_user_id_updated_at_idx on public.ai_conversations (user_id, updated_at desc);
create index ai_messages_conversation_id_created_at_idx on public.ai_messages (conversation_id, created_at);
create index mentoring_sessions_starts_at_idx on public.mentoring_sessions (starts_at);

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.touch_updated_at();

create trigger lesson_progress_updated_at
  before update on public.lesson_progress
  for each row execute procedure public.touch_updated_at();

create trigger ai_conversations_updated_at
  before update on public.ai_conversations
  for each row execute procedure public.touch_updated_at();

insert into public.plans (slug, name, price_toman, ai_message_limit, includes_group, includes_mentoring)
values
  ('bronze', 'برنز', 1200000, 0, false, false),
  ('silver', 'نقره', 1900000, 30, true, false),
  ('gold', 'طلا', 3000000, 150, true, true),
  ('diamond', 'الماس', 8000000, null, true, true);

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.learning_paths enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.assessments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.entitlements enable row level security;
alter table public.orders enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_usage_monthly enable row level security;
alter table public.mentoring_sessions enable row level security;
alter table public.mentoring_bookings enable row level security;

create policy "Users can read their profile" on public.profiles for select using (id = auth.uid());
create policy "Users can update their profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "Everyone can read active plans" on public.plans for select using (is_active);
create policy "Everyone can read published paths" on public.learning_paths for select using (true);
create policy "Everyone can read course modules" on public.course_modules for select using (true);
create policy "Everyone can read published lessons" on public.lessons for select using (is_published);
create policy "Users can manage their assessments" on public.assessments for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can manage their lesson progress" on public.lesson_progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can read their entitlements" on public.entitlements for select using (user_id = auth.uid());
create policy "Users can read their orders" on public.orders for select using (user_id = auth.uid());
create policy "Users can manage their conversations" on public.ai_conversations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can manage messages in their conversations" on public.ai_messages for all using (
  exists (select 1 from public.ai_conversations where id = conversation_id and user_id = auth.uid())
) with check (
  exists (select 1 from public.ai_conversations where id = conversation_id and user_id = auth.uid())
);
create policy "Users can read their AI usage" on public.ai_usage_monthly for select using (user_id = auth.uid());
create policy "Users can read published mentoring sessions" on public.mentoring_sessions for select using (is_published);
create policy "Users can manage their bookings" on public.mentoring_bookings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
