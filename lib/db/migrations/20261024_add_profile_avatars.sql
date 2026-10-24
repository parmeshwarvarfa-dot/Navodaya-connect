ALTER TABLE users ADD COLUMN IF NOT EXISTS uploaded_photo_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_config jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_thumbnail_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_type text;
