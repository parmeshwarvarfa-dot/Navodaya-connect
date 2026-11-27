CREATE TABLE IF NOT EXISTS memory_bookmark_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS memory_bookmark_collections_user_name_uidx
  ON memory_bookmark_collections (user_id, name);
CREATE INDEX IF NOT EXISTS memory_bookmark_collections_user_created_idx
  ON memory_bookmark_collections (user_id, created_at);

CREATE TABLE IF NOT EXISTS memory_bookmark_collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES memory_bookmark_collections(id) ON DELETE CASCADE,
  memory_id uuid NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS memory_bookmark_collection_items_collection_memory_uidx
  ON memory_bookmark_collection_items (collection_id, memory_id);
CREATE INDEX IF NOT EXISTS memory_bookmark_collection_items_memory_idx
  ON memory_bookmark_collection_items (memory_id);
