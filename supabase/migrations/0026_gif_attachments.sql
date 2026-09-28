-- GIFs on comments (the last piece of "Content: text, photos, and GIFs").
-- Reuses comment_attachments/its existing is_chapter_unlocked()-gated RLS
-- rather than a new table: a GIF is exactly as spoiler-sensitive as a
-- photo attachment, and the same "hidden until the row is visible" rule
-- already does the right thing regardless of which kind of attachment it
-- is. The GIF itself is hosted on Giphy's CDN (not our storage bucket),
-- so there's no file to upload and no storage.objects policy involved --
-- just a URL column, gated by the same table RLS as storage_path already
-- is. That's sufficient: the security property that matters is "don't let
-- the client learn this URL before they're authorized to see the
-- comment," not "the URL itself must stay secret forever" (it's a public
-- CDN link once you're allowed to see it, same as Open Library cover URLs
-- or the public covers bucket -- see 0002).
alter table public.comment_attachments
  alter column storage_path drop not null,
  add column gif_url text,
  add constraint comment_attachments_exactly_one_kind
    check ((storage_path is not null) <> (gif_url is not null));
