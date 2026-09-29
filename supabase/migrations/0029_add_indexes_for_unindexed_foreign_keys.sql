-- Performance advisor (unindexed_foreign_keys): covering indexes for FK
-- columns that lacked one, so joins/lookups through these relationships
-- don't force a sequential scan as the tables grow.
create index if not exists idx_achievements_earned_achievement_key on public.achievements_earned (achievement_key);
create index if not exists idx_achievements_earned_book_id on public.achievements_earned (book_id);
create index if not exists idx_books_added_by on public.books (added_by);
create index if not exists idx_books_default_cover_id on public.books (default_cover_id);
create index if not exists idx_books_group_id on public.books (group_id);
create index if not exists idx_chapter_edits_book_id on public.chapter_edits (book_id);
create index if not exists idx_chapter_edits_user_id on public.chapter_edits (user_id);
create index if not exists idx_comment_attachments_book_id on public.comment_attachments (book_id);
create index if not exists idx_comment_attachments_chapter_id on public.comment_attachments (chapter_id);
create index if not exists idx_comments_chapter_id on public.comments (chapter_id);
create index if not exists idx_comments_user_id on public.comments (user_id);
create index if not exists idx_covers_book_id on public.covers (book_id);
create index if not exists idx_covers_uploaded_by on public.covers (uploaded_by);
create index if not exists idx_group_members_user_id on public.group_members (user_id);
create index if not exists idx_groups_created_by on public.groups (created_by);
create index if not exists idx_notification_outbox_book_id on public.notification_outbox (book_id);
create index if not exists idx_notification_outbox_user_id on public.notification_outbox (user_id);
create index if not exists idx_predictions_chapter_id on public.predictions (chapter_id);
create index if not exists idx_predictions_user_id on public.predictions (user_id);
create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions (user_id);
create index if not exists idx_ratings_user_id on public.ratings (user_id);
create index if not exists idx_reactions_user_id on public.reactions (user_id);
create index if not exists idx_shelf_entries_book_id on public.shelf_entries (book_id);
create index if not exists idx_shelf_entries_current_chapter_id on public.shelf_entries (current_chapter_id);
create index if not exists idx_shelf_entries_personal_cover_id on public.shelf_entries (personal_cover_id);
create index if not exists idx_spoiler_blocks_book_id on public.spoiler_blocks (book_id);
create index if not exists idx_spoiler_blocks_chapter_id on public.spoiler_blocks (chapter_id);
