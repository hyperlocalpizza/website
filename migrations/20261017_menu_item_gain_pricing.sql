-- Add calculated recipe costs and editable gains to menu items.
-- Run after 20261017_recipe_aware_menu_items.sql. The unit_cost addition is
-- repeated safely so this migration also works if its separate migration is pending.

alter table public.inventory
  add column if not exists unit_cost numeric(10, 2) not null default 0
  check (unit_cost >= 0);

alter table public.menu_items
  add column if not exists ingredient_cost numeric(10, 2) not null default 0
    check (ingredient_cost >= 0),
  add column if not exists gain numeric(10, 2) not null default 0
    check (gain >= 0);

-- Preserve existing prices where possible; raise any price below current recipe cost.
with recipe_costs as (
  select recipe.menu_item_id,
         round(sum(recipe.quantity * stock.unit_cost), 2) as ingredient_cost
  from public.menu_item_ingredients as recipe
  join public.inventory as stock on stock.id = recipe.inventory_id
  group by recipe.menu_item_id
)
update public.menu_items as menu
set ingredient_cost = coalesce(costs.ingredient_cost, 0),
    gain = greatest(menu.price - coalesce(costs.ingredient_cost, 0), 0),
    price = greatest(menu.price, coalesce(costs.ingredient_cost, 0))
from (select menu_item.id, costs.ingredient_cost
      from public.menu_items as menu_item
      left join recipe_costs as costs on costs.menu_item_id = menu_item.id) as costs
where menu.id = costs.id;

-- The price argument is replaced by p_gain; drop the prior signature first so
-- PostgREST exposes the new named parameter.
drop function if exists public.save_menu_item(uuid, text, uuid, text, numeric, boolean, text, jsonb);

create function public.save_menu_item(
  p_item_id uuid,
  p_name text,
  p_category_id uuid,
  p_description text,
  p_gain numeric,
  p_is_available boolean,
  p_image_url text,
  p_ingredients jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item_id uuid;
  v_ingredient_cost numeric(10, 2);
begin
  if p_name is null or btrim(p_name) = '' or p_gain is null or p_gain < 0 then
    raise exception 'Invalid menu item details';
  end if;
  if p_ingredients is null or jsonb_typeof(p_ingredients) <> 'array' then
    raise exception 'Ingredients must be an array';
  end if;

  insert into public.menu_items (id, name, category_id, description, price, ingredient_cost, gain, is_available, image_url)
  values (coalesce(p_item_id, gen_random_uuid()), btrim(p_name), p_category_id,
          nullif(btrim(p_description), ''), p_gain, 0, p_gain, coalesce(p_is_available, true), p_image_url)
  on conflict (id) do update set
    name = excluded.name,
    category_id = excluded.category_id,
    description = excluded.description,
    gain = excluded.gain,
    is_available = excluded.is_available,
    image_url = excluded.image_url
  returning id into v_item_id;

  delete from public.menu_item_ingredients where menu_item_id = v_item_id;

  insert into public.menu_item_ingredients (menu_item_id, inventory_id, quantity)
  select v_item_id, (line->>'inventory_id')::uuid, (line->>'quantity')::numeric
  from jsonb_array_elements(p_ingredients) as ingredient(line);

  select coalesce(round(sum(recipe.quantity * stock.unit_cost), 2), 0)
  into v_ingredient_cost
  from public.menu_item_ingredients as recipe
  join public.inventory as stock on stock.id = recipe.inventory_id
  where recipe.menu_item_id = v_item_id;

  update public.menu_items
  set ingredient_cost = v_ingredient_cost,
      price = round(v_ingredient_cost + gain, 2)
  where id = v_item_id;

  return v_item_id;
end;
$$;

revoke all on function public.save_menu_item(uuid, text, uuid, text, numeric, boolean, text, jsonb) from public;
grant execute on function public.save_menu_item(uuid, text, uuid, text, numeric, boolean, text, jsonb)
  to authenticated;

create or replace function public.reprice_menu_items_for_inventory_cost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.menu_items as menu
  set ingredient_cost = costs.ingredient_cost,
      price = round(costs.ingredient_cost + menu.gain, 2)
  from (
    select recipe.menu_item_id,
           round(sum(recipe.quantity * stock.unit_cost), 2) as ingredient_cost
    from public.menu_item_ingredients as recipe
    join public.inventory as stock on stock.id = recipe.inventory_id
    where recipe.menu_item_id in (
      select affected.menu_item_id
      from public.menu_item_ingredients as affected
      where affected.inventory_id = new.id
    )
    group by recipe.menu_item_id
  ) as costs
  where menu.id = costs.menu_item_id;
  return new;
end;
$$;

drop trigger if exists inventory_unit_cost_reprice_menu on public.inventory;
create trigger inventory_unit_cost_reprice_menu
  after update of unit_cost on public.inventory
  for each row
  when (old.unit_cost is distinct from new.unit_cost)
  execute function public.reprice_menu_items_for_inventory_cost();

-- Snapshot current recipe cost and gain for accurate weekly sales reporting.
alter table public.order_items
  add column if not exists ingredient_cost numeric(10, 2) check (ingredient_cost >= 0),
  add column if not exists gain numeric(10, 2) check (gain >= 0);

create or replace function public.snapshot_order_item_menu_costs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.menu_item_id is not null then
    select menu.ingredient_cost, menu.gain
    into new.ingredient_cost, new.gain
    from public.menu_items as menu
    where menu.id = new.menu_item_id;
  end if;
  return new;
end;
$$;

drop trigger if exists order_items_snapshot_menu_costs on public.order_items;
create trigger order_items_snapshot_menu_costs
  before insert on public.order_items
  for each row execute function public.snapshot_order_item_menu_costs();
