create table public.monthly_challenge_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  month_start date not null check (month_start = date_trunc('month', month_start)::date),
  challenge_key public.clear_dimension not null,
  completed_at timestamptz,
  primary key (user_id, month_start, challenge_key)
);

alter table public.monthly_challenge_progress enable row level security;

create policy "Eligible users can manage their monthly challenge progress"
on public.monthly_challenge_progress
for all
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.entitlements
    join public.plans on plans.id = entitlements.plan_id
    where entitlements.user_id = auth.uid()
      and entitlements.status = 'active'
      and entitlements.ends_at > now()
      and plans.slug in ('silver', 'gold', 'diamond')
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.entitlements
    join public.plans on plans.id = entitlements.plan_id
    where entitlements.user_id = auth.uid()
      and entitlements.status = 'active'
      and entitlements.ends_at > now()
      and plans.slug in ('silver', 'gold', 'diamond')
  )
);
