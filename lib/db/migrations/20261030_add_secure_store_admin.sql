CREATE TABLE IF NOT EXISTS store_admin_staff (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('super_admin','store_manager','product_manager','order_manager','inventory_manager','seller_manager','finance_manager','customer_support')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  image_url text,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  specifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  price_paise integer NOT NULL CHECK (price_paise >= 0),
  discount_percent integer NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  category_id uuid REFERENCES store_categories(id) ON DELETE SET NULL,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_approval','approved','published','rejected','out_of_stock','archived')),
  featured boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES users(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_products_status_idx ON store_products(status);
CREATE INDEX IF NOT EXISTS store_products_category_idx ON store_products(category_id);

CREATE TABLE IF NOT EXISTS store_admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_role text,
  action text NOT NULL,
  target_type text,
  target_id text,
  outcome text NOT NULL CHECK (outcome IN ('success','denied','failure')),
  request_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_admin_audit_actor_idx ON store_admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS store_admin_audit_created_idx ON store_admin_audit_logs(created_at);

-- The application deliberately provides no public staff-promotion endpoint.
-- Provision the first super admin only through a trusted database operator action:
-- INSERT INTO store_admin_staff(user_id, role) SELECT id, 'super_admin' FROM users WHERE email = lower('admin@example.org');
