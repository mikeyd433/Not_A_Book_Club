-- Restore the plain author-edit policy dropped during debugging of the
-- flag-visibility issue fixed in 0014. This one is safe as a normal RLS
-- policy (not RPC-only) because the author always retains SELECT-policy
-- visibility of their own comment regardless of flagged state, so it never
-- hits the "actor must retain visibility" constraint that broke flagging.
create policy "authors can edit their own comments"
  on public.comments for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
