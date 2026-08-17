create table public.tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (
    char_length(trim(name)) between 1 and 40
    and name = trim(name)
  ),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index tags_workspace_normalized_name_idx
  on public.tags (workspace_id, lower(name));

create table public.page_tags (
  page_id uuid not null references public.pages(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (page_id, tag_id)
);

alter table public.tags enable row level security;
alter table public.page_tags enable row level security;

create policy "Members can view tags"
on public.tags for select
using (public.workspace_role_for(workspace_id) is not null);

create policy "Editors can create tags"
on public.tags for insert
with check (
  created_by = auth.uid()
  and public.workspace_role_for(workspace_id) in ('owner', 'editor')
);

create policy "Editors can update tags"
on public.tags for update
using (public.workspace_role_for(workspace_id) in ('owner', 'editor'))
with check (public.workspace_role_for(workspace_id) in ('owner', 'editor'));

create policy "Editors can delete tags"
on public.tags for delete
using (public.workspace_role_for(workspace_id) in ('owner', 'editor'));

create policy "Members can view page tags"
on public.page_tags for select
using (
  exists (
    select 1
    from public.pages
    join public.tags
      on public.tags.id = page_tags.tag_id
      and public.tags.workspace_id = public.pages.workspace_id
    where public.pages.id = page_tags.page_id
      and public.workspace_role_for(public.pages.workspace_id) is not null
  )
);

create policy "Editors can assign page tags"
on public.page_tags for insert
with check (
  exists (
    select 1
    from public.pages
    join public.tags
      on public.tags.id = page_tags.tag_id
      and public.tags.workspace_id = public.pages.workspace_id
    where public.pages.id = page_tags.page_id
      and public.workspace_role_for(public.pages.workspace_id)
        in ('owner', 'editor')
  )
);

create policy "Editors can remove page tags"
on public.page_tags for delete
using (
  exists (
    select 1
    from public.pages
    join public.tags
      on public.tags.id = page_tags.tag_id
      and public.tags.workspace_id = public.pages.workspace_id
    where public.pages.id = page_tags.page_id
      and public.workspace_role_for(public.pages.workspace_id)
        in ('owner', 'editor')
  )
);
