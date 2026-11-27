ALTER TABLE store_categories
  ADD COLUMN IF NOT EXISTS parent_id uuid,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

ALTER TABLE store_sellers
  ADD COLUMN IF NOT EXISTS seller_type text NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS business_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS bank_account_holder text,
  ADD COLUMN IF NOT EXISTS bank_account_last4 text,
  ADD COLUMN IF NOT EXISTS bank_ifsc text,
  ADD COLUMN IF NOT EXISTS payout_account_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cod_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS intended_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS agreement_accepted_at timestamp,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp;

ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS subcategory_id uuid,
  ADD COLUMN IF NOT EXISTS ownership_type text NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS seller_id uuid,
  ADD COLUMN IF NOT EXISTS fulfillment_model text NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS weight_grams integer NOT NULL DEFAULT 250,
  ADD COLUMN IF NOT EXISTS dimensions_cm jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reserved_stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sold_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS cod_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS return_policy_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS approval_feedback text,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamp,
  ADD COLUMN IF NOT EXISTS published_at timestamp;

CREATE INDEX IF NOT EXISTS store_products_status_idx ON store_products (status);
CREATE INDEX IF NOT EXISTS store_products_seller_idx ON store_products (seller_id);
CREATE INDEX IF NOT EXISTS store_products_category_idx ON store_products (category_id);

ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS fulfillment_status text NOT NULL DEFAULT 'not_started';

ALTER TABLE store_order_items
  ADD COLUMN IF NOT EXISTS sub_order_id uuid,
  ADD COLUMN IF NOT EXISTS seller_id uuid,
  ADD COLUMN IF NOT EXISTS ownership_type text NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS commission_paise integer NOT NULL DEFAULT 0;

ALTER TABLE store_returns
  ADD COLUMN IF NOT EXISTS sub_order_id uuid,
  ADD COLUMN IF NOT EXISTS order_item_id uuid,
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS return_type text NOT NULL DEFAULT 'refund',
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS evidence_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS inspection_outcome text,
  ADD COLUMN IF NOT EXISTS restock_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refund_amount_paise integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_reference text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

CREATE TABLE IF NOT EXISTS store_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  variant_key text NOT NULL DEFAULT '',
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  movement_type text NOT NULL,
  quantity_delta integer NOT NULL,
  available_after integer NOT NULL,
  reference_type text,
  reference_id text,
  note text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_stock_movements_product_idx ON store_stock_movements (product_id, created_at);

CREATE TABLE IF NOT EXISTS store_sub_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES store_sellers(id) ON DELETE SET NULL,
  ownership_type text NOT NULL DEFAULT 'platform',
  fulfillment_model text NOT NULL DEFAULT 'platform',
  subtotal_paise integer NOT NULL,
  shipping_paise integer NOT NULL DEFAULT 0,
  discount_paise integer NOT NULL DEFAULT 0,
  commission_rate_bps integer NOT NULL DEFAULT 0,
  commission_paise integer NOT NULL DEFAULT 0,
  seller_payable_paise integer NOT NULL DEFAULT 0,
  payout_id uuid,
  fulfillment_status text NOT NULL DEFAULT 'not_started',
  tracking_number text,
  carrier text,
  dispatched_at timestamp,
  delivered_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_sub_orders_order_idx ON store_sub_orders (order_id);
CREATE INDEX IF NOT EXISTS store_sub_orders_seller_idx ON store_sub_orders (seller_id, created_at);

CREATE TABLE IF NOT EXISTS store_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  gateway text NOT NULL DEFAULT 'razorpay',
  gateway_order_id text,
  gateway_payment_id text,
  amount_paise integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending',
  method text NOT NULL DEFAULT 'online',
  signature_verified boolean NOT NULL DEFAULT false,
  idempotency_key text NOT NULL,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS store_payments_idempotency_uq ON store_payments (idempotency_key);
CREATE INDEX IF NOT EXISTS store_payments_order_idx ON store_payments (order_id);

CREATE TABLE IF NOT EXISTS store_commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES store_categories(id) ON DELETE CASCADE,
  rate_bps integer NOT NULL,
  version integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  effective_from timestamp NOT NULL DEFAULT now(),
  effective_to timestamp,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_commission_rules_cat_idx ON store_commission_rules (category_id, active);

CREATE TABLE IF NOT EXISTS store_payout_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number text NOT NULL UNIQUE,
  period_start timestamp NOT NULL,
  period_end timestamp NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  total_amount_paise integer NOT NULL DEFAULT 0,
  prepared_by uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  executed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES store_payout_batches(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES store_sellers(id) ON DELETE CASCADE,
  gross_paise integer NOT NULL,
  commission_paise integer NOT NULL,
  refund_adjustment_paise integer NOT NULL DEFAULT 0,
  net_payable_paise integer NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  idempotency_key text NOT NULL UNIQUE,
  payment_reference text,
  failure_reason text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_payouts_seller_idx ON store_payouts (seller_id, created_at);

CREATE TABLE IF NOT EXISTS store_shipping_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  min_weight_grams integer NOT NULL DEFAULT 0,
  max_weight_grams integer NOT NULL DEFAULT 50000,
  base_rate_paise integer NOT NULL,
  per_kg_paise integer NOT NULL DEFAULT 0,
  free_above_paise integer,
  cod_allowed boolean NOT NULL DEFAULT false,
  cod_fee_paise integer NOT NULL DEFAULT 0,
  estimated_days_min integer NOT NULL DEFAULT 3,
  estimated_days_max integer NOT NULL DEFAULT 7,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);
