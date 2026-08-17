alter table public.pages
add column if not exists page_type text not null default 'page',
add column if not exists fields jsonb not null default '{}'::jsonb;

alter table public.pages
drop constraint if exists pages_page_type_check;

alter table public.pages
add constraint pages_page_type_check
check (
  page_type in (
    'page',
    'chapter',
    'character',
    'location',
    'animal',
    'transport',
    'unique_object'
  )
);

create table if not exists public.page_relationships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  from_page_id uuid not null references public.pages(id) on delete cascade,
  to_page_id uuid not null references public.pages(id) on delete cascade,
  label text not null check (
    char_length(trim(label)) between 1 and 40
    and label = trim(label)
  ),
  created_at timestamptz not null default now(),
  constraint page_relationship_no_self_link check (from_page_id <> to_page_id)
);

create unique index if not exists page_relationships_pair_label_idx
  on public.page_relationships (from_page_id, to_page_id, lower(label));

create index if not exists page_relationships_workspace_idx
  on public.page_relationships (workspace_id);

alter table public.page_relationships enable row level security;

drop policy if exists "Members can view page relationships" on public.page_relationships;
create policy "Members can view page relationships"
on public.page_relationships for select
using (public.workspace_role_for(workspace_id) is not null);

drop policy if exists "Editors can create page relationships" on public.page_relationships;
create policy "Editors can create page relationships"
on public.page_relationships for insert
with check (
  public.workspace_role_for(workspace_id) in ('owner', 'editor')
  and exists (
    select 1 from public.pages
    where public.pages.id = from_page_id
      and public.pages.workspace_id = page_relationships.workspace_id
  )
  and exists (
    select 1 from public.pages
    where public.pages.id = to_page_id
      and public.pages.workspace_id = page_relationships.workspace_id
  )
);

drop policy if exists "Editors can delete page relationships" on public.page_relationships;
create policy "Editors can delete page relationships"
on public.page_relationships for delete
using (public.workspace_role_for(workspace_id) in ('owner', 'editor'));
