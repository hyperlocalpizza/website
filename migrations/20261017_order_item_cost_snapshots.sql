-- Preserve menu ingredient cost and gain on each newly placed order line.
-- Existing rows remain NULL and analytics estimates their values from the current menu.

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
