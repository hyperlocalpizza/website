-- Allow public checkout to reserve active-slot capacity while keeping direct
-- updates to slots restricted to authenticated staff.
create or replace function public.check_and_reserve_slot(
  p_slot_id uuid,
  p_requested_quantity integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
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
    and reserved_pizzas + p_requested_quantity <= max_pizzas;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.check_and_reserve_slot(uuid, integer) from public;
grant execute on function public.check_and_reserve_slot(uuid, integer) to anon, authenticated;
