alter table public.tags
  add column color text not null default '#5a9a62'
  check (color ~ '^#[0-9a-fA-F]{6}$');
