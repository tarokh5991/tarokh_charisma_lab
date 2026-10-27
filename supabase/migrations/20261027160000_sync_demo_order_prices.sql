update public.orders
set amount_toman = plans.price_toman
from public.plans
where plans.id = orders.plan_id
  and orders.amount_toman <> plans.price_toman;
