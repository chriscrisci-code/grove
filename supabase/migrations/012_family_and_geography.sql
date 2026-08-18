alter table public.page_relationships
add column if not exists kind text;

alter table public.page_relationships
drop constraint if exists page_relationships_kind_check;

alter table public.page_relationships
add constraint page_relationships_kind_check
check (
  kind is null
  or kind in (
    'parent_of',
    'adoptive_parent_of',
    'partner',
    'former_partner'
  )
);

create unique index if not exists page_relationships_typed_pair_idx
  on public.page_relationships (from_page_id, to_page_id, kind)
  where kind is not null;

update public.pages
set fields = fields
  - 'role'
  - 'wants'
  - 'region'
  - 'species'
  - 'kind'
  - 'owner'
where fields ?| array['role', 'wants', 'region', 'species', 'kind', 'owner'];

alter table public.workspaces
add column if not exists geography jsonb not null
  default '{"version":1,"canvas":{"width":1200,"height":800},"layers":[]}'::jsonb,
add column if not exists geography_background_path text
  check (
    geography_background_path is null
    or char_length(geography_background_path) <= 500
  );

alter table public.workspaces
drop constraint if exists workspaces_geography_size_check;

alter table public.workspaces
add constraint workspaces_geography_size_check
check (octet_length(geography::text) <= 524288);

create or replace function public.save_workspace_geography(
  project_id uuid,
  map_document jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.workspace_role_for(project_id)::text, '')
    not in ('owner', 'editor') then
    raise exception 'Only project editors can save geography';
  end if;

  update public.workspaces
  set geography = map_document
  where id = project_id;

  if not found then
    raise exception 'Project not found';
  end if;
end;
$$;

revoke all on function public.save_workspace_geography(uuid, jsonb) from public;
grant execute on function public.save_workspace_geography(uuid, jsonb)
to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'workspace-geography',
  'workspace-geography',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members can view geography backgrounds"
on storage.objects;
create policy "Members can view geography backgrounds"
on storage.objects for select
to authenticated
using (
  bucket_id = 'workspace-geography'
  and public.workspace_role_for(
    ((storage.foldername(name))[1])::uuid
  ) is not null
);

drop policy if exists "Editors can upload geography backgrounds"
on storage.objects;
create policy "Editors can upload geography backgrounds"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'workspace-geography'
  and public.workspace_role_for(
    ((storage.foldername(name))[1])::uuid
  ) in ('owner', 'editor')
);

drop policy if exists "Editors can replace geography backgrounds"
on storage.objects;
create policy "Editors can replace geography backgrounds"
on storage.objects for update
to authenticated
using (
  bucket_id = 'workspace-geography'
  and public.workspace_role_for(
    ((storage.foldername(name))[1])::uuid
  ) in ('owner', 'editor')
)
with check (
  bucket_id = 'workspace-geography'
  and public.workspace_role_for(
    ((storage.foldername(name))[1])::uuid
  ) in ('owner', 'editor')
);

drop policy if exists "Editors can delete geography backgrounds"
on storage.objects;
create policy "Editors can delete geography backgrounds"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'workspace-geography'
  and public.workspace_role_for(
    ((storage.foldername(name))[1])::uuid
  ) in ('owner', 'editor')
);
