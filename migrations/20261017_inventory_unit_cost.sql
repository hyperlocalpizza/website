-- Add per-unit ingredient cost without changing existing inventory amounts.
alter table public.inventory
  add column if not exists unit_cost numeric(10, 2) not null default 0
  check (unit_cost >= 0);
