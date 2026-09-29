-- Performance advisor (auth_rls_initplan): auth.uid() in a policy is
-- re-evaluated once per row; wrapping it as (select auth.uid()) lets
-- Postgres evaluate it once per query as an InitPlan instead. Pure
-- performance change -- auth.uid() is STABLE within a query, so the
-- wrapped and unwrapped forms return identical values; no policy's
-- actual access logic changes.

alter policy "users can update their own profile" on public.profiles
  using ((id = (select auth.uid())));

alter policy "members can add books" on public.books
  with check ((is_group_member(group_id) AND (added_by = (select auth.uid()))));

alter policy "members can upload covers" on public.covers
  with check (((uploaded_by = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM books
  WHERE ((books.id = covers.book_id) AND is_group_member(books.group_id))))));

alter policy "uploaders can delete their own non-default covers" on public.covers
  using (((uploaded_by = (select auth.uid())) AND (NOT (EXISTS ( SELECT 1
   FROM books
  WHERE (books.default_cover_id = covers.id))))));

alter policy "members can log their own chapter edits" on public.chapter_edits
  with check (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM books
  WHERE ((books.id = chapter_edits.book_id) AND is_group_member(books.group_id))))));

alter policy "users manage their own shelf entry" on public.shelf_entries
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

alter policy "authors can delete their own comments" on public.comments
  using ((user_id = (select auth.uid())));

alter policy "reactions are readable when their comment is" on public.reactions
  using ((EXISTS ( SELECT 1
   FROM (comments c
     JOIN books b ON ((b.id = c.book_id)))
  WHERE ((c.id = reactions.comment_id) AND is_group_member(b.group_id) AND ((c.user_id = (select auth.uid())) OR ((NOT c.flagged) AND is_chapter_unlocked((select auth.uid()), c.book_id, c.chapter_id)))))));

alter policy "members can react to a comment they can see" on public.reactions
  with check (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM (comments c
     JOIN books b ON ((b.id = c.book_id)))
  WHERE ((c.id = reactions.comment_id) AND is_group_member(b.group_id) AND ((c.user_id = (select auth.uid())) OR ((NOT c.flagged) AND is_chapter_unlocked((select auth.uid()), c.book_id, c.chapter_id))))))));

alter policy "members can remove their own reaction" on public.reactions
  using ((user_id = (select auth.uid())));

alter policy "unlocked spoiler blocks are readable" on public.spoiler_blocks
  using (((EXISTS ( SELECT 1
   FROM comments c
  WHERE ((c.id = spoiler_blocks.comment_id) AND (c.user_id = (select auth.uid()))))) OR is_chapter_unlocked((select auth.uid()), book_id, chapter_id)));

alter policy "comment authors can add spoiler blocks to their own comment" on public.spoiler_blocks
  with check (((EXISTS ( SELECT 1
   FROM comments c
  WHERE ((c.id = spoiler_blocks.comment_id) AND (c.user_id = (select auth.uid())) AND (c.book_id = spoiler_blocks.book_id)))) AND is_chapter_unlocked((select auth.uid()), book_id, chapter_id)));

alter policy "authors can delete their own spoiler blocks" on public.spoiler_blocks
  using ((EXISTS ( SELECT 1
   FROM comments c
  WHERE ((c.id = spoiler_blocks.comment_id) AND (c.user_id = (select auth.uid()))))));

alter policy "users manage their own push subscriptions" on public.push_subscriptions
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

alter policy "members can post comments up to their own position" on public.comments
  with check (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM books
  WHERE ((books.id = comments.book_id) AND is_group_member(books.group_id)))) AND is_chapter_unlocked((select auth.uid()), book_id, chapter_id)));

alter policy "unlocked comments are readable" on public.comments
  using (((EXISTS ( SELECT 1
   FROM books
  WHERE ((books.id = comments.book_id) AND is_group_member(books.group_id)))) AND ((user_id = (select auth.uid())) OR ((NOT flagged) AND is_chapter_unlocked((select auth.uid()), book_id, chapter_id)) OR (flagged AND (EXISTS ( SELECT 1
   FROM books
  WHERE ((books.id = comments.book_id) AND is_group_admin(books.group_id))))))));

alter policy "authors can edit their own comments" on public.comments
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

alter policy "predictions are visible to their author, or once resolved and u" on public.predictions
  using (((EXISTS ( SELECT 1
   FROM books
  WHERE ((books.id = predictions.book_id) AND is_group_member(books.group_id)))) AND ((user_id = (select auth.uid())) OR ((verdict IS NOT NULL) AND is_chapter_unlocked((select auth.uid()), book_id, chapter_id)))));

alter policy "members can update their own membership row" on public.group_members
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

alter policy "unlocked comment attachments are readable" on public.comment_attachments
  using (((EXISTS ( SELECT 1
   FROM comments c
  WHERE ((c.id = comment_attachments.comment_id) AND (c.user_id = (select auth.uid()))))) OR is_chapter_unlocked((select auth.uid()), book_id, chapter_id)));

alter policy "comment authors can add attachments to their own comment" on public.comment_attachments
  with check (((EXISTS ( SELECT 1
   FROM comments c
  WHERE ((c.id = comment_attachments.comment_id) AND (c.user_id = (select auth.uid())) AND (c.book_id = comment_attachments.book_id)))) AND is_chapter_unlocked((select auth.uid()), book_id, chapter_id)));

alter policy "members can post a prediction up to their position, not while r" on public.predictions
  with check (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM books
  WHERE ((books.id = predictions.book_id) AND is_group_member(books.group_id)))) AND is_chapter_unlocked((select auth.uid()), book_id, chapter_id) AND (NOT (EXISTS ( SELECT 1
   FROM shelf_entries se
  WHERE ((se.book_id = predictions.book_id) AND (se.user_id = (select auth.uid())) AND se.is_rereading))))));

alter policy "authors can self-resolve their own prediction" on public.predictions
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

alter policy "authors can delete their own unresolved prediction" on public.predictions
  using (((user_id = (select auth.uid())) AND (verdict IS NULL)));

alter policy "ratings are visible once you've finished, or to their author" on public.ratings
  using (((EXISTS ( SELECT 1
   FROM books
  WHERE ((books.id = ratings.book_id) AND is_group_member(books.group_id)))) AND ((user_id = (select auth.uid())) OR has_full_access((select auth.uid()), book_id))));

alter policy "members can rate a book once they have full access to it" on public.ratings
  with check (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM books
  WHERE ((books.id = ratings.book_id) AND is_group_member(books.group_id)))) AND has_full_access((select auth.uid()), book_id)));

alter policy "authors can edit their own rating" on public.ratings
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

alter policy "authors can delete their own rating" on public.ratings
  using ((user_id = (select auth.uid())));

alter policy "authors can delete their own comment attachments" on public.comment_attachments
  using ((EXISTS ( SELECT 1
   FROM comments c
  WHERE ((c.id = comment_attachments.comment_id) AND (c.user_id = (select auth.uid()))))));
