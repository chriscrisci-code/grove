create policy "Users can create their own AI settings"
on public.ai_settings for insert
with check (user_id = auth.uid());

create policy "Users can update their own AI settings"
on public.ai_settings for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete their own AI settings"
on public.ai_settings for delete
using (user_id = auth.uid());
