-- Apply to an existing VIPizza Supabase database.
-- Only customer-facing promotional copy is editable; checkout/system text stays in code.

create table if not exists public.site_content (
  content_key text not null check (content_key in (
    'hero.eyebrow', 'hero.title', 'hero.sub', 'hero.cta',
    'menu.eyebrow', 'menu.title', 'info.eyebrow', 'info.title',
    'info.choose.title', 'info.choose.desc', 'info.order.title', 'info.order.desc',
    'info.enjoy.title', 'info.enjoy.desc', 'footer.tagline'
  )),
  language    text not null check (language in ('en', 'it', 'es')),
  content     text not null check (char_length(content) <= 500),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null,
  primary key (content_key, language)
);

alter table public.site_content enable row level security;

drop policy if exists "Public can read site content" on public.site_content;
create policy "Public can read site content"
  on public.site_content for select
  to anon, authenticated
  using (true);

drop policy if exists "Staff can manage site content" on public.site_content;
create policy "Staff can manage site content"
  on public.site_content for all
  to authenticated
  using (true)
  with check (true);

grant select on public.site_content to anon, authenticated;
grant insert, update, delete on public.site_content to authenticated;

create or replace function public.save_site_content(p_entries jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'Content entries must be an array';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_entries) as entry(value)
    where value->>'content_key' not in (
      'hero.eyebrow', 'hero.title', 'hero.sub', 'hero.cta',
      'menu.eyebrow', 'menu.title', 'info.eyebrow', 'info.title',
      'info.choose.title', 'info.choose.desc', 'info.order.title', 'info.order.desc',
      'info.enjoy.title', 'info.enjoy.desc', 'footer.tagline'
    )
      or value->>'language' not in ('en', 'it', 'es')
      or char_length(coalesce(value->>'content', '')) > 500
      or coalesce(value->>'content', '') = ''
  ) then
    raise exception 'Invalid site content entry';
  end if;

  delete from public.site_content;
  insert into public.site_content (content_key, language, content, updated_at, updated_by)
  select value->>'content_key', value->>'language', value->>'content', now(), auth.uid()
  from jsonb_array_elements(p_entries) as entry(value);
end;
$$;

revoke all on function public.save_site_content(jsonb) from public;
grant execute on function public.save_site_content(jsonb) to authenticated;
