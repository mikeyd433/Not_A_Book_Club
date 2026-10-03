-- Profile photos. Unlike covers (anyone in the group can contribute one)
-- or comment-attachments (visibility follows chapter-unlock), an avatar is
-- squarely one person's own thing: public bucket (so it loads with a plain
-- public URL everywhere a name is shown, same as covers), but INSERT/
-- UPDATE/DELETE are scoped to a user's own folder -- storage_path is
-- always "<user_id>/avatar.<ext>", and re-uploading overwrites it rather
-- than accumulating orphaned files.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

create policy "anyone can view avatars"
on storage.objects
for select
using (bucket_id = 'avatars');

create policy "users can upload their own avatar"
on storage.objects
for insert
with check (
  bucket_id = 'avatars'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can replace their own avatar"
on storage.objects
for update
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and owner = auth.uid()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can remove their own avatar"
on storage.objects
for delete
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
