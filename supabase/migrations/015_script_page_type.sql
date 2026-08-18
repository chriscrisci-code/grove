alter table public.pages
drop constraint if exists pages_page_type_check;

alter table public.pages
add constraint pages_page_type_check
check (
  page_type in (
    'page',
    'chapter',
    'event',
    'script',
    'character',
    'location',
    'animal',
    'transport',
    'unique_object'
  )
);
