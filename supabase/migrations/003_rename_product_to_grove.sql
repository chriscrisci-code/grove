update public.pages
set title = 'Welcome to Grove'
where title = 'Welcome to StoryTree';

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
  values (new_workspace_id, 'Welcome to Grove', new.id);

  return new;
end;
$$;
