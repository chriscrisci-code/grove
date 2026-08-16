create table public.research_links (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  url text not null check (char_length(url) <= 2048),
  title text not null check (char_length(title) <= 500),
  description text check (char_length(description) <= 2000),
  image_url text,
  favicon_url text,
  created_at timestamptz not null default now()
);

create index research_links_page_created_idx
on public.research_links (page_id, created_at desc);

alter table public.research_links enable row level security;

create policy "Members can view page research"
on public.research_links for select
using (
  exists (
    select 1
    from public.pages
    where pages.id = research_links.page_id
      and public.workspace_role_for(pages.workspace_id) is not null
  )
);

create policy "Editors can save page research"
on public.research_links for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.pages
    where pages.id = research_links.page_id
      and public.workspace_role_for(pages.workspace_id) in ('owner', 'editor')
  )
);

create policy "Editors can delete page research"
on public.research_links for delete
using (
  exists (
    select 1
    from public.pages
    where pages.id = research_links.page_id
      and public.workspace_role_for(pages.workspace_id) in ('owner', 'editor')
  )
);
