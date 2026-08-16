create extension if not exists "pgcrypto";

create type public.workspace_role as enum ('owner', 'editor', 'viewer');
create type public.ai_provider as enum ('openai', 'anthropic', 'google');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  parent_id uuid references public.pages(id) on delete cascade,
  title text not null default 'Untitled' check (char_length(title) <= 240),
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  position double precision not null default 0,
  version integer not null default 1,
  deleted_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint page_cannot_parent_itself check (parent_id is null or parent_id <> id)
);

create index pages_workspace_parent_position_idx
  on public.pages (workspace_id, parent_id, position)
  where deleted_at is null;

create table public.ai_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider public.ai_provider not null,
  model text not null check (char_length(model) between 1 and 120),
  key_ciphertext text not null,
  key_iv text not null,
  key_auth_tag text not null,
  key_version smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_touch_updated_at
before update on public.workspaces
for each row execute function public.touch_updated_at();

create trigger pages_touch_updated_at
before update on public.pages
for each row execute function public.touch_updated_at();

create trigger ai_settings_touch_updated_at
before update on public.ai_settings
for each row execute function public.touch_updated_at();

create or replace function public.create_personal_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
begin
  insert into public.workspaces (name, owner_id)
  values ('My Story', new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  insert into public.pages (workspace_id, title, created_by)
  values (new_workspace_id, 'Welcome to StoryTree', new.id);

  return new;
end;
$$;

create trigger create_workspace_after_signup
after insert on auth.users
for each row execute function public.create_personal_workspace();

create or replace function public.workspace_role_for(check_workspace_id uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.workspace_members
  where workspace_id = check_workspace_id and user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.workspace_role_for(uuid) from public;
grant execute on function public.workspace_role_for(uuid) to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.pages enable row level security;
alter table public.ai_settings enable row level security;

create policy "Members can view workspaces"
on public.workspaces for select
using (public.workspace_role_for(id) is not null);

create policy "Owners can update workspaces"
on public.workspaces for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Members can view memberships"
on public.workspace_members for select
using (public.workspace_role_for(workspace_id) is not null);

create policy "Owners can manage memberships"
on public.workspace_members for all
using (public.workspace_role_for(workspace_id) = 'owner')
with check (public.workspace_role_for(workspace_id) = 'owner');

create policy "Members can view pages"
on public.pages for select
using (public.workspace_role_for(workspace_id) is not null);

create policy "Editors can create pages"
on public.pages for insert
with check (
  created_by = auth.uid()
  and public.workspace_role_for(workspace_id) in ('owner', 'editor')
);

create policy "Editors can update pages"
on public.pages for update
using (
  public.workspace_role_for(workspace_id) in ('owner', 'editor')
)
with check (
  public.workspace_role_for(workspace_id) in ('owner', 'editor')
);

create policy "Editors can delete pages"
on public.pages for delete
using (
  public.workspace_role_for(workspace_id) in ('owner', 'editor')
);

create policy "Users can view their AI setting metadata"
on public.ai_settings for select
using (user_id = auth.uid());

-- Writes to ai_settings are intentionally service-role only. The application
-- server encrypts keys before storage and never returns encrypted key fields.
