ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_name text NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS district text NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS pincode text NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS facebook text NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS linkedin text NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS instagram text NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS x_profile text NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS media text NOT NULL DEFAULT '[]';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS price_min integer;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS price_max integer;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS navodayans_discount integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS business_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating integer NOT NULL,
  review text NOT NULL DEFAULT '',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT business_reviews_rating_check CHECK (rating BETWEEN 1 AND 5)
);
CREATE INDEX IF NOT EXISTS business_reviews_business_created_idx ON business_reviews(business_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS business_reviews_business_reviewer_idx ON business_reviews(business_id, reviewer_id);
