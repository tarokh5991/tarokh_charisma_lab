create table public.path_challenge_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  challenge_key text not null check (challenge_key in (
    'cl-1', 'cl-2', 'ce-1', 'ce-2', 'ca-1', 'ca-2', 'cr-1', 'cr-2',
    'le-1', 'le-2', 'la-1', 'la-2', 'lr-1', 'lr-2', 'ea-1', 'ea-2',
    'er-1', 'er-2', 'ar-1', 'ar-2'
  )),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, challenge_key)
);

alter table public.path_challenge_progress enable row level security;

create policy "Users can manage their path challenge progress"
on public.path_challenge_progress
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
