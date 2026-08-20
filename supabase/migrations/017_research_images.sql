alter table public.research_links
add column if not exists kind text not null default 'link'
  check (kind in ('link', 'image')),
add column if not exists storage_path text
  check (storage_path is null or char_length(storage_path) <= 500);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'research-images',
  'research-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Members can view research images"
on storage.objects for select
to authenticated
using (
  bucket_id = 'research-images'
  and public.workspace_role_for(
    ((storage.foldername(name))[1])::uuid
  ) is not null
);

create policy "Editors can upload research images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'research-images'
  and public.caller_can_write_workspace(
    ((storage.foldername(name))[1])::uuid
  )
);

create policy "Editors can replace research images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'research-images'
  and public.caller_can_write_workspace(
    ((storage.foldername(name))[1])::uuid
  )
)
with check (
  bucket_id = 'research-images'
  and public.caller_can_write_workspace(
    ((storage.foldername(name))[1])::uuid
  )
);

create policy "Editors can delete research images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'research-images'
  and (
    public.workspace_role_for(
      ((storage.foldername(name))[1])::uuid
    ) = 'owner'
    or public.caller_can_write_workspace(
      ((storage.foldername(name))[1])::uuid
    )
  )
);
