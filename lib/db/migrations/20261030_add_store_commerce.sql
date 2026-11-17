ALTER TABLE store_products ADD COLUMN IF NOT EXISTS original_price_paise integer;
ALTER TABLE store_products ADD COLUMN IF NOT EXISTS sku text UNIQUE;
ALTER TABLE store_products ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE store_products ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS store_cart_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 product_id uuid NOT NULL REFERENCES store_products(id) ON DELETE CASCADE, quantity integer NOT NULL DEFAULT 1 CHECK(quantity BETWEEN 1 AND 99),
 variant_selection text NOT NULL DEFAULT '', created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), UNIQUE(user_id,product_id,variant_selection)
);
CREATE INDEX IF NOT EXISTS store_cart_user_idx ON store_cart_items(user_id);
ALTER TABLE store_cart_items ADD COLUMN IF NOT EXISTS variant_selection text NOT NULL DEFAULT '';
ALTER TABLE store_cart_items DROP CONSTRAINT IF EXISTS store_cart_items_user_id_product_id_key;
DROP INDEX IF EXISTS store_cart_user_product_uq;
CREATE UNIQUE INDEX IF NOT EXISTS store_cart_user_product_variant_uq ON store_cart_items(user_id,product_id,variant_selection);

CREATE TABLE IF NOT EXISTS store_addresses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 recipient_name text NOT NULL, phone text NOT NULL, type text NOT NULL DEFAULT 'home' CHECK(type IN ('home','hostel','school','other')),
 line1 text NOT NULL, line2 text, city text NOT NULL, district text NOT NULL, state text NOT NULL, pincode text NOT NULL CHECK(pincode ~ '^[0-9]{6}$'), instructions text,
 is_default boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_addresses_user_idx ON store_addresses(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS store_addresses_one_default_idx ON store_addresses(user_id) WHERE is_default;

CREATE TABLE IF NOT EXISTS store_wishlists (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 product_id uuid NOT NULL REFERENCES store_products(id) ON DELETE CASCADE, created_at timestamp NOT NULL DEFAULT now(), UNIQUE(user_id,product_id)
);
CREATE INDEX IF NOT EXISTS store_wishlist_user_idx ON store_wishlists(user_id);

CREATE TABLE IF NOT EXISTS store_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_number text NOT NULL UNIQUE, user_id uuid NOT NULL REFERENCES users(id), address_snapshot jsonb NOT NULL,
 subtotal_paise integer NOT NULL CHECK(subtotal_paise >= 0), shipping_paise integer NOT NULL DEFAULT 0 CHECK(shipping_paise >= 0), discount_paise integer NOT NULL DEFAULT 0 CHECK(discount_paise >= 0), total_paise integer NOT NULL CHECK(total_paise >= 0),
 status text NOT NULL DEFAULT 'payment_pending', payment_status text NOT NULL DEFAULT 'not_configured', payment_method text NOT NULL DEFAULT 'unselected',
 idempotency_key text NOT NULL, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), UNIQUE(user_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS store_orders_user_created_idx ON store_orders(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS store_order_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE, product_id uuid REFERENCES store_products(id) ON DELETE SET NULL,
 product_name text NOT NULL, image_url text, unit_price_paise integer NOT NULL CHECK(unit_price_paise >= 0), quantity integer NOT NULL CHECK(quantity > 0), variant_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS store_order_items_order_idx ON store_order_items(order_id);
CREATE TABLE IF NOT EXISTS store_order_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE, actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
 status text NOT NULL, note text, created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_order_events_order_idx ON store_order_events(order_id);

CREATE TABLE IF NOT EXISTS store_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, product_id uuid NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
 rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5), body text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'published', created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), UNIQUE(user_id,product_id)
);
CREATE INDEX IF NOT EXISTS store_reviews_product_idx ON store_reviews(product_id);

CREATE TABLE IF NOT EXISTS store_sellers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, display_name text NOT NULL,
 description text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','suspended')), created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_sellers_status_idx ON store_sellers(status);

CREATE TABLE IF NOT EXISTS store_coupons (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, discount_type text NOT NULL CHECK(discount_type IN ('percent','fixed')),
 discount_value integer NOT NULL CHECK(discount_value > 0), minimum_subtotal_paise integer NOT NULL DEFAULT 0, maximum_discount_paise integer,
 usage_limit integer, used_count integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT false, starts_at timestamp, expires_at timestamp, created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_coupons_active_idx ON store_coupons(active);

CREATE TABLE IF NOT EXISTS store_returns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES store_orders(id), user_id uuid NOT NULL REFERENCES users(id), reason text NOT NULL,
 status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','rejected','received','refunded')), created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_returns_order_idx ON store_returns(order_id);

-- Checkout remains in payment_pending until a server-verified payment provider is configured.
