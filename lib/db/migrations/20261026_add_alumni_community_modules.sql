CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  services text NOT NULL DEFAULT '',
  city text NOT NULL,
  contact_preference text NOT NULL DEFAULT 'message',
  website text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS businesses_status_city_idx ON businesses(status, city);

CREATE TABLE IF NOT EXISTS blood_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blood_group text NOT NULL,
  hospital text NOT NULL,
  city text NOT NULL,
  required_at timestamptz NOT NULL,
  urgency text NOT NULL DEFAULT 'normal',
  notes text NOT NULL DEFAULT '',
  response_method text NOT NULL DEFAULT 'message',
  status text NOT NULL DEFAULT 'open',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blood_requests_status_city_group_idx ON blood_requests(status, city, blood_group);

CREATE TABLE IF NOT EXISTS blood_request_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES blood_requests(id) ON DELETE CASCADE,
  responder_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message text NOT NULL DEFAULT '',
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(request_id, responder_id)
);
CREATE INDEX IF NOT EXISTS blood_request_responses_request_idx ON blood_request_responses(request_id, created_at);
