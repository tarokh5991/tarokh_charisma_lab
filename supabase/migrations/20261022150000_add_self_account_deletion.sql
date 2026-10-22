create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  delete from public.orders where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
