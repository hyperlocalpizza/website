-- Apply to an existing VIPizza Supabase database.
-- Existing menu_items are retained; recipe lines start empty until staff add them.

create table if not exists public.menu_item_ingredients (
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  inventory_id uuid not null references public.inventory(id) on delete restrict,
  quantity     numeric(10, 3) not null check (quantity > 0),
  primary key (menu_item_id, inventory_id)
);

alter table public.inventory
  alter column quantity type numeric(11, 3) using quantity::numeric(11, 3),
  alter column low_threshold type numeric(11, 3) using low_threshold::numeric(11, 3);

alter table public.menu_item_ingredients enable row level security;

drop policy if exists "Staff can manage menu item ingredients" on public.menu_item_ingredients;
create policy "Staff can manage menu item ingredients"
  on public.menu_item_ingredients for all
  to authenticated
  using (true)
  with check (true);

create or replace function public.decrement_inventory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.inventory as stock
  set quantity = greatest(stock.quantity - recipe.quantity * new.quantity, 0),
      updated_at = now()
  from public.menu_item_ingredients as recipe
  where recipe.menu_item_id = new.menu_item_id
    and stock.id = recipe.inventory_id;
  return new;
end;
$$;

drop trigger if exists order_items_decrement_inventory on public.order_items;
create trigger order_items_decrement_inventory
  after insert on public.order_items
  for each row execute function public.decrement_inventory();

create or replace function public.save_menu_item(
  p_item_id uuid,
  p_name text,
  p_category_id uuid,
  p_description text,
  p_price numeric,
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
begin
  if p_name is null or btrim(p_name) = '' or p_price is null or p_price < 0 then
    raise exception 'Invalid menu item details';
  end if;
  if p_ingredients is null or jsonb_typeof(p_ingredients) <> 'array' then
    raise exception 'Ingredients must be an array';
  end if;

  insert into public.menu_items (id, name, category_id, description, price, is_available, image_url)
  values (coalesce(p_item_id, gen_random_uuid()), btrim(p_name), p_category_id,
          nullif(btrim(p_description), ''), p_price, coalesce(p_is_available, true), p_image_url)
  on conflict (id) do update set
    name = excluded.name,
    category_id = excluded.category_id,
    description = excluded.description,
    price = excluded.price,
    is_available = excluded.is_available,
    image_url = excluded.image_url
  returning id into v_item_id;

  delete from public.menu_item_ingredients where menu_item_id = v_item_id;

  insert into public.menu_item_ingredients (menu_item_id, inventory_id, quantity)
  select v_item_id, (line->>'inventory_id')::uuid, (line->>'quantity')::numeric
  from jsonb_array_elements(p_ingredients) as ingredient(line);

  return v_item_id;
end;
$$;

revoke all on function public.save_menu_item(uuid, text, uuid, text, numeric, boolean, text, jsonb) from public;
grant execute on function public.save_menu_item(uuid, text, uuid, text, numeric, boolean, text, jsonb)
  to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-photos', 'menu-photos', true, 5242880, array['image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view menu photos" on storage.objects;
create policy "Public can view menu photos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'menu-photos');

drop policy if exists "Staff can upload menu photos" on storage.objects;
create policy "Staff can upload menu photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'menu-photos');

drop policy if exists "Staff can update menu photos" on storage.objects;
create policy "Staff can update menu photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'menu-photos')
  with check (bucket_id = 'menu-photos');

drop policy if exists "Staff can delete menu photos" on storage.objects;
create policy "Staff can delete menu photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'menu-photos');