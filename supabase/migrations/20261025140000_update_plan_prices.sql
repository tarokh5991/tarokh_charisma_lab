update public.plans
set price_toman = case slug
  when 'bronze' then 2500000
  when 'silver' then 3500000
  when 'gold' then 6500000
  when 'diamond' then 10000000
end
where slug in ('bronze', 'silver', 'gold', 'diamond');
