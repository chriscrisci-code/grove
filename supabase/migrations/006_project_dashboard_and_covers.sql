alter table public.workspaces
add column if not exists description text
  check (description is null or char_length(description) <= 2000),
add column if not exists genre text
  check (genre is null or char_length(genre) <= 120),
add column if not exists cover_path text
  check (cover_path is null or char_length(cover_path) <= 500);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'workspace-covers',
  'workspace-covers',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.create_workspace(
  project_name text,
  project_description text default null,
  project_genre text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
  clean_name text := trim(project_name);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if clean_name = '' or char_length(clean_name) > 120 then
    raise exception 'Project name must contain 1 to 120 characters';
  end if;

  insert into public.workspaces (
    name,
    description,
    genre,
    owner_id
  )
  values (
    clean_name,
    nullif(trim(project_description), ''),
    nullif(trim(project_genre), ''),
    auth.uid()
  )
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');

  insert into public.pages (workspace_id, title, content, created_by)
  values (
    new_workspace_id,
    'Start Here',
    '{"html":"<p>Begin writing your story…</p>"}'::jsonb,
    auth.uid()
  );

  return new_workspace_id;
end;
$$;

revoke all on function public.create_workspace(text, text, text) from public;
grant execute on function public.create_workspace(text, text, text) to authenticated;

create policy "Members can view workspace covers"
on storage.objects for select
to authenticated
using (
  bucket_id = 'workspace-covers'
  and public.workspace_role_for(
    ((storage.foldername(name))[1])::uuid
  ) is not null
);

create policy "Editors can upload workspace covers"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'workspace-covers'
  and public.workspace_role_for(
    ((storage.foldername(name))[1])::uuid
  ) in ('owner', 'editor')
);

create policy "Editors can replace workspace covers"
on storage.objects for update
to authenticated
using (
  bucket_id = 'workspace-covers'
  and public.workspace_role_for(
    ((storage.foldername(name))[1])::uuid
  ) in ('owner', 'editor')
)
with check (
  bucket_id = 'workspace-covers'
  and public.workspace_role_for(
    ((storage.foldername(name))[1])::uuid
  ) in ('owner', 'editor')
);

create policy "Editors can delete workspace covers"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'workspace-covers'
  and public.workspace_role_for(
    ((storage.foldername(name))[1])::uuid
  ) in ('owner', 'editor')
);
