ALTER TABLE public.clients
  ADD COLUMN photo_path text,
  ADD CONSTRAINT clients_photo_path_unique UNIQUE (photo_path),
  ADD CONSTRAINT clients_photo_company_path CHECK (
    photo_path IS NULL OR (
      split_part(photo_path, '/', 1) = company_id::text
      AND split_part(photo_path, '/', 2) ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$'
      AND array_length(string_to_array(photo_path, '/'), 1) = 2
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('client-photos', 'client-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']);

CREATE POLICY client_photos_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'client-photos' AND (storage.foldername(name))[1] = (SELECT public.current_user_company_id())::text);

CREATE POLICY client_photos_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'client-photos'
  AND storage.foldername(name) = ARRAY[(SELECT public.current_user_company_id())::text]
  AND storage.filename(name) ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$'
);

CREATE POLICY client_photos_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'client-photos' AND (storage.foldername(name))[1] = (SELECT public.current_user_company_id())::text);
