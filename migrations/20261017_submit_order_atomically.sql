-- Submit an order without exposing order rows to the public role. Capacity
-- reservation, order creation, and line-item insertion happen in one transaction.
create or replace function public.submit_order(
  p_customer_name text,
  p_phone text,
  p_delivery_type text,
  p_address text,
  p_notes text,
  p_slot_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pizza_count integer;
  v_line_count integer;
  v_available_line_count integer;
  v_updated integer;
  v_order_id uuid;
  v_tracking_id text;
  v_total numeric(10, 2);
begin
  if nullif(btrim(p_customer_name), '') is null
     or nullif(btrim(p_phone), '') is null
     or p_delivery_type is null
     or p_delivery_type not in ('pickup', 'delivery')
     or p_slot_id is null
     or p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
     or (p_delivery_type = 'delivery' and nullif(btrim(p_address), '') is null) then
    return jsonb_build_object('error', 'invalid_order');
  end if;

  select coalesce(sum(item.quantity), 0), count(*)
    into v_pizza_count, v_line_count
  from jsonb_to_recordset(p_items) as item(menu_item_id uuid, quantity integer);

  if v_pizza_count <= 0 or exists (
    select 1
    from jsonb_to_recordset(p_items) as item(menu_item_id uuid, quantity integer)
    where item.menu_item_id is null or item.quantity is null or item.quantity <= 0
  ) then
    return jsonb_build_object('error', 'invalid_items');
  end if;

  select count(*)
    into v_available_line_count
  from jsonb_to_recordset(p_items) as item(menu_item_id uuid, quantity integer)
  join public.menu_items as menu
    on menu.id = item.menu_item_id
   and menu.is_available = true;

  if v_available_line_count <> v_line_count then
    return jsonb_build_object('error', 'invalid_items');
  end if;

  update public.slots
  set reserved_pizzas = reserved_pizzas + v_pizza_count
  where id = p_slot_id
    and is_active = true
    and reserved_pizzas + v_pizza_count <= max_pizzas;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    return jsonb_build_object('error', 'slot_full');
  end if;

  select sum(menu.price * item.quantity)
    into v_total
  from jsonb_to_recordset(p_items) as item(menu_item_id uuid, quantity integer)
  join public.menu_items as menu
    on menu.id = item.menu_item_id
   and menu.is_available = true;

  insert into public.orders (
    customer_name, phone, delivery_type, address, notes, slot_id, total_amount
  )
  values (
    btrim(p_customer_name),
    btrim(p_phone),
    p_delivery_type,
    case when p_delivery_type = 'delivery' then nullif(btrim(p_address), '') else null end,
    nullif(btrim(p_notes), ''),
    p_slot_id,
    v_total
  )
  returning id, tracking_id into v_order_id, v_tracking_id;

  insert into public.order_items (order_id, menu_item_id, item_name, unit_price, quantity)
  select v_order_id, menu.id, menu.name, menu.price, item.quantity
  from jsonb_to_recordset(p_items) as item(menu_item_id uuid, quantity integer)
  join public.menu_items as menu
    on menu.id = item.menu_item_id
   and menu.is_available = true;

  return jsonb_build_object('tracking_id', v_tracking_id);
end;
$$;

revoke all on function public.submit_order(text, text, text, text, text, uuid, jsonb) from public;
grant execute on function public.submit_order(text, text, text, text, text, uuid, jsonb) to anon, authenticated;
