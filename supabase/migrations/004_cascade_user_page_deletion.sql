alter table public.pages
drop constraint if exists pages_created_by_fkey;

alter table public.pages
add constraint pages_created_by_fkey
foreign key (created_by)
references auth.users(id)
on delete cascade;
