CREATE TABLE IF NOT EXISTS "yearbook_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "memory_id" uuid NOT NULL REFERENCES "memories"("id") ON DELETE CASCADE,
  "submitted_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "jnv_name" text NOT NULL,
  "jnv_state" text NOT NULL,
  "cohort_year" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "reviewed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" timestamp,
  "review_note" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "yearbook_entries_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected', 'withdrawn')),
  CONSTRAINT "yearbook_entries_cohort_year_check" CHECK ("cohort_year" ~ '^(19|20|21)[0-9]{2}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS "yearbook_entries_memory_uidx" ON "yearbook_entries" ("memory_id");
CREATE INDEX IF NOT EXISTS "yearbook_entries_school_year_status_idx" ON "yearbook_entries" ("jnv_state", "jnv_name", "cohort_year", "status");
CREATE INDEX IF NOT EXISTS "yearbook_entries_submitter_created_idx" ON "yearbook_entries" ("submitted_by", "created_at");
