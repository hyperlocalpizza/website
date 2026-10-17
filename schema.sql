-- ============================================================================
-- VIPizza — Database Schema & Security Setup
-- ----------------------------------------------------------------------------
-- Run this script in the Supabase SQL Editor (Dashboard > SQL > New query),
-- or apply it locally with:  supabase db reset
--
-- It creates:
--   * categories, menu_items, orders, order_items, profiles
--   * Row Level Security (RLS) policies for public (anon) and admin (auth)
--   * Foreign keys, indexes, and sample seed data
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
-- Order lifecycle used by the kitchen dashboard.
do $$
begin
  create type public.order_status as enum (
    'pending',        -- received, waiting for kitchen
    'preparing',      -- being made
    'in_oven',        -- in the oven
    'out_for_delivery', -- on the way / ready for pickup
    'completed',      -- delivered / picked up
    'cancelled'       -- cancelled
  );
exception
  when duplicate_object then null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

-- Menu categories (e.g. "Classiche", "Speciali", "Dolci").
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Menu items (pizzas and extras).
create table if not exists public.menu_items (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid references public.categories(id) on delete set null,
  name          text not null,
  description   text,
  price         numeric(10, 2) not null check (price >= 0),
  image_url     text,
  is_available  boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Pickup / delivery time slots with capacity management.
create table if not exists public.slots (
  id               uuid primary key default gen_random_uuid(),
  start_time       time without time zone not null,
  max_pizzas       integer not null default 10 check (max_pizzas > 0),
  reserved_pizzas  integer not null default 0 check (reserved_pizzas >= 0),
  is_active        boolean not null default true
);

-- Customer orders.
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  tracking_id     text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  customer_name   text not null,
  phone           text not null,
  delivery_type   text not null default 'pickup' check (delivery_type in ('delivery', 'pickup')),
  address         text,
  notes           text,
  slot_id         uuid references public.slots(id) on delete set null,
  status          public.order_status not null default 'pending',
  total_amount    numeric(10, 2) not null default 0 check (total_amount >= 0),
  created_at      timestamptz not null default now()
);

-- Ingredient / stock inventory.
create table if not exists public.inventory (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  unit          text not null default 'pz' check (unit in ('pz', 'kg', 'g', 'l', 'ml')),
  quantity      numeric(11, 3) not null default 0 check (quantity >= 0),
  low_threshold numeric(11, 3) not null default 0 check (low_threshold >= 0),
  updated_at    timestamptz not null default now()
);

-- Recipe quantities are measured in the linked inventory item's unit.
create table if not exists public.menu_item_ingredients (
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  inventory_id uuid not null references public.inventory(id) on delete restrict,
  quantity     numeric(10, 3) not null check (quantity > 0),
  primary key (menu_item_id, inventory_id)
);

-- Line items belonging to an order.
create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name   text not null,          -- snapshot of the name at order time
  unit_price  numeric(10, 2) not null check (unit_price >= 0),
  quantity    integer not null check (quantity > 0),
  notes       text
);

-- User profiles for admin role handling.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        text not null default 'staff' check (role in ('staff', 'admin')),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Indexes (query performance)
-- ---------------------------------------------------------------------------
create index if not exists menu_items_category_id_idx   on public.menu_items(category_id);
create index if not exists menu_items_available_idx     on public.menu_items(is_available);
create index if not exists orders_created_at_idx        on public.orders(created_at desc);
create index if not exists orders_status_idx            on public.orders(status);
create index if not exists orders_tracking_id_idx       on public.orders(tracking_id);
create index if not exists order_items_order_id_idx     on public.order_items(order_id);
create index if not exists order_items_menu_item_id_idx on public.order_items(menu_item_id);
create index if not exists orders_slot_id_idx           on public.orders(slot_id);
create index if not exists slots_start_time_idx         on public.slots(start_time);
create index if not exists inventory_low_idx            on public.inventory(quantity);

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.categories  enable row level security;
alter table public.menu_items  enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.profiles    enable row level security;
alter table public.slots       enable row level security;
alter table public.inventory   enable row level security;
alter table public.menu_item_ingredients enable row level security;

-- --- PUBLIC (anon) policies ------------------------------------------------
-- Anyone can read active menu data.
create policy "Public can view active categories"
  on public.categories for select
  to anon, authenticated
  using (is_active = true);

create policy "Public can view available menu items"
  on public.menu_items for select
  to anon, authenticated
  using (is_available = true);

-- Anyone can place an order.
create policy "Public can insert orders"
  on public.orders for insert
  to anon, authenticated
  with check (true);

-- Anyone can insert line items for their order.
create policy "Public can insert order items"
  on public.order_items for insert
  to anon, authenticated
  with check (true);

-- Anyone can view active pickup slots (to pick a time at checkout).
create policy "Public can view active slots"
  on public.slots for select
  to anon, authenticated
  using (is_active = true);

-- --- ADMIN (authenticated staff) policies ----------------------------------
-- Staff can read all orders and their items.
create policy "Staff can view all orders"
  on public.orders for select
  to authenticated
  using (true);

create policy "Staff can view all order items"
  on public.order_items for select
  to authenticated
  using (true);

-- Staff can update orders (e.g. change status).
create policy "Staff can update orders"
  on public.orders for update
  to authenticated
  using (true)
  with check (true);

-- Staff can delete orders.
create policy "Staff can delete orders"
  on public.orders for delete
  to authenticated
  using (true);

-- Staff can manage menu data.
create policy "Staff can manage categories"
  on public.categories for all
  to authenticated
  using (true)
  with check (true);

create policy "Staff can manage menu items"
  on public.menu_items for all
  to authenticated
  using (true)
  with check (true);

-- Staff can manage pickup slots.
create policy "Staff can manage slots"
  on public.slots for all
  to authenticated
  using (true)
  with check (true);

-- Staff can manage inventory.
create policy "Staff can manage inventory"
  on public.inventory for all
  to authenticated
  using (true)
  with check (true);

create policy "Staff can manage menu item ingredients"
  on public.menu_item_ingredients for all
  to authenticated
  using (true)
  with check (true);

-- Staff can read profiles.
create policy "Staff can view profiles"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can update their own profile.
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 5. Helper: promote the first authenticated user to admin
-- ---------------------------------------------------------------------------
-- Run this once after creating your staff account in the admin dashboard:
--   update public.profiles set role = 'admin' where id = auth.uid();
-- (Or use the SQL Editor with the user's auth.uid().)

-- ---------------------------------------------------------------------------
-- 5b. Slot reservation function
-- ---------------------------------------------------------------------------
-- Atomically reserves capacity on a slot. Returns true if the reservation
-- succeeded, false if the slot is full/inactive or the quantity is invalid.
create or replace function public.check_and_reserve_slot(
  p_slot_id uuid,
  p_requested_quantity integer
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_requested_quantity is null or p_requested_quantity <= 0 then
    return false;
  end if;

  update public.slots
  set reserved_pizzas = reserved_pizzas + p_requested_quantity
  where id = p_slot_id
    and is_active = true
    and reserved_pizzas + p_requested_quantity <= max_pizzas
  returning 1 into v_updated;

  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5c. Inventory decrement on order placement
-- ---------------------------------------------------------------------------
-- When an order is placed, decrement stock for each ordered menu item.
-- This is a best-effort stock tracker: it does not block orders when stock
-- runs out (the kitchen can restock or mark items unavailable).
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

-- Save item details and all recipe lines as one database transaction.
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

-- Product photos are public; uploads and management require staff authentication.
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

-- ---------------------------------------------------------------------------
-- 6. Seed data
-- ---------------------------------------------------------------------------
insert into public.categories (id, name, slug, sort_order, is_active) values
  ('00000000-0000-0000-0000-000000000001', 'Classiche', 'classiche', 1, true),
  ('00000000-0000-0000-0000-000000000002', 'Speciali',   'speciali',   2, true),
  ('00000000-0000-0000-0000-000000000003', 'Dolci',      'dolci',      3, true)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

insert into public.menu_items (id, category_id, name, description, price, is_available) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Margherita',          'Pomodoro, fiordilatte, basilico', 8.50,  true),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Diavola',             'Pomodoro, fiordilatte, salame piccante', 10.50, true),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Ortolana',            'Verdure di stagione, mozzarella, olio al basilico', 11.00, true),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', 'Bufalina',            'Pomodoro, mozzarella di bufala, basilico', 12.00, true),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000001', 'Quattro formaggi',    'Fiordilatte, gorgonzola, fontina, parmigiano', 12.50, true),
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000001', 'Prosciutto e funghi', 'Pomodoro, fiordilatte, prosciutto cotto, funghi', 11.50, true),
  ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000001', 'Capricciosa',         'Pomodoro, fiordilatte, prosciutto cotto, funghi, carciofi, olive', 12.00, true),
  ('00000000-0000-0000-0000-000000000108', '00000000-0000-0000-0000-000000000001', 'Marinara',            'Pomodoro, aglio, origano, olio extravergine', 7.50,  true),
  ('00000000-0000-0000-0000-000000000109', '00000000-0000-0000-0000-000000000001', 'Napoli',              'Pomodoro, fiordilatte, alici, capperi, origano', 10.00, true),
  ('00000000-0000-0000-0000-000000000110', '00000000-0000-0000-0000-000000000001', 'Romana',              'Pomodoro, fiordilatte, mozzarella di bufala, basilico', 11.50, true),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000002', 'Pizza del Contadino','Pomodoro, mozzarella, salsiccia, patate, rosmarino', 12.00, true),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000002', 'Tartufo',             'Crema di tartufo, mozzarella, funghi porcini', 13.50, true),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000002', 'Quattro stagioni',    'Pomodoro, fiordilatte, prosciutto, funghi, carciofi, olive', 12.50, true),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000002', 'Pesto e burrata',     'Pesto di basilico, burrata, pomodorini, pinoli', 13.00, true),
  ('00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000002', 'Salsiccia e friarielli', 'Pomodoro, mozzarella, salsiccia, friarielli', 12.50, true),
  ('00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000002', 'Crudo e rucola',      'Mozzarella, prosciutto crudo, rucola, scaglie di grana', 13.50, true),
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000003', 'Nutella',             'Pizza dolce con crema alla nocciola', 7.00, true),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000003', 'Nutella e fragole',   'Crema alla nocciola e fragole fresche', 8.00, true),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000003', 'Banana e cioccolato', 'Crema alla nocciola, banana e gocce di cioccolato', 8.50, true)
on conflict (id) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  is_available = excluded.is_available;

-- Pickup slots (evening service).
insert into public.slots (id, start_time, max_pizzas, reserved_pizzas, is_active) values
  ('10000000-0000-0000-0000-000000000001', '17:00', 10, 0, true),
  ('10000000-0000-0000-0000-000000000002', '18:00', 10, 0, true),
  ('10000000-0000-0000-0000-000000000003', '19:00', 10, 0, true),
  ('10000000-0000-0000-0000-000000000004', '20:00', 10, 0, true),
  ('10000000-0000-0000-0000-000000000005', '21:00', 10, 0, true)
on conflict (id) do update set
  start_time = excluded.start_time,
  max_pizzas = excluded.max_pizzas,
  is_active = excluded.is_active;

-- Inventory (ingredients / stock).
insert into public.inventory (id, name, unit, quantity, low_threshold) values
  ('20000000-0000-0000-0000-000000000001', 'Farina',            'kg', 25.0, 5.0),
  ('20000000-0000-0000-0000-000000000002', 'Mozzarella',        'kg', 8.0,  2.0),
  ('20000000-0000-0000-0000-000000000003', 'Pomodoro',          'kg', 10.0, 3.0),
  ('20000000-0000-0000-0000-000000000004', 'Basilico',          'pz', 40,   10),
  ('20000000-0000-0000-0000-000000000005', 'Salame piccante',   'kg', 3.0,  1.0),
  ('20000000-0000-0000-0000-000000000006', 'Prosciutto cotto',  'kg', 4.0,  1.0),
  ('20000000-0000-0000-0000-000000000007', 'Funghi',            'kg', 3.0,  1.0),
  ('20000000-0000-0000-0000-000000000008', 'Gorgonzola',        'kg', 2.0,  0.5)
on conflict (id) do update set
  name = excluded.name,
  unit = excluded.unit,
  quantity = excluded.quantity,
  low_threshold = excluded.low_threshold;

-- ---------------------------------------------------------------------------
-- 7. Realtime
-- ---------------------------------------------------------------------------
-- Enable realtime for the orders, slots, and inventory tables so the kitchen
-- dashboard updates live.
-- (In the Supabase Dashboard: Database > Replication > enable the tables.)
-- Equivalent SQL:
--   alter publication supabase_realtime add table public.orders;
--   alter publication supabase_realtime add table public.slots;
--   alter publication supabase_realtime add table public.inventory;