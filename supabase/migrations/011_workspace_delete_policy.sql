create policy "Owners can delete workspaces"
on public.workspaces for delete
to authenticated
using (owner_id = auth.uid());
