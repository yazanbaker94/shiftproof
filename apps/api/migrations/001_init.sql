CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS timesheets (
  id uuid PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES employees(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  period_label text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'needs_attention', 'approved', 'returned')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  receipt_id text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_pay_period CHECK (period_end >= period_start)
);

CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY,
  client_id uuid NOT NULL,
  timesheet_id uuid NOT NULL REFERENCES timesheets(id),
  employee_id uuid NOT NULL REFERENCES employees(id),
  entry_date date NOT NULL,
  regular_hours numeric(5, 2) NOT NULL CHECK (regular_hours >= 0),
  overtime_hours numeric(5, 2) NOT NULL CHECK (overtime_hours >= 0),
  note text,
  status text NOT NULL CHECK (status IN ('synced', 'needs_attention', 'confirmed')),
  requires_review boolean NOT NULL DEFAULT false,
  review_reason text,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_entry_per_timesheet_day UNIQUE (timesheet_id, entry_date),
  CONSTRAINT one_entry_per_client_id UNIQUE (employee_id, client_id),
  CONSTRAINT valid_daily_total CHECK (regular_hours + overtime_hours > 0 AND regular_hours + overtime_hours <= 24)
);

CREATE TABLE IF NOT EXISTS time_entry_revisions (
  id uuid PRIMARY KEY,
  time_entry_id uuid NOT NULL REFERENCES time_entries(id),
  revision integer NOT NULL CHECK (revision > 0),
  regular_hours numeric(5, 2) NOT NULL,
  overtime_hours numeric(5, 2) NOT NULL,
  note text,
  status text NOT NULL,
  requires_review boolean NOT NULL,
  review_reason text,
  actor_id uuid REFERENCES employees(id),
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (time_entry_id, revision)
);

CREATE TABLE IF NOT EXISTS timesheet_events (
  id uuid PRIMARY KEY,
  timesheet_id uuid NOT NULL REFERENCES timesheets(id),
  sequence integer NOT NULL CHECK (sequence > 0),
  event_type text NOT NULL,
  actor_id uuid REFERENCES employees(id),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (timesheet_id, sequence)
);

CREATE TABLE IF NOT EXISTS timesheet_revisions (
  id uuid PRIMARY KEY,
  timesheet_id uuid NOT NULL REFERENCES timesheets(id),
  revision integer NOT NULL CHECK (revision > 0),
  status text NOT NULL,
  action text NOT NULL,
  actor_id uuid REFERENCES employees(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (timesheet_id, revision)
);

CREATE TABLE IF NOT EXISTS idempotency_operations (
  operation_key text PRIMARY KEY,
  request_hash char(64) NOT NULL,
  operation_type text NOT NULL CHECK (operation_type = 'CREATE_TIME_ENTRY'),
  status text NOT NULL CHECK (status IN ('pending', 'succeeded')),
  response_status integer,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS time_entries_timesheet_idx ON time_entries(timesheet_id, entry_date);
CREATE INDEX IF NOT EXISTS timesheet_events_timesheet_idx ON timesheet_events(timesheet_id, sequence);
CREATE INDEX IF NOT EXISTS timesheet_revisions_timesheet_idx ON timesheet_revisions(timesheet_id, revision);

CREATE OR REPLACE FUNCTION reject_append_only_change()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS time_entry_revisions_append_only ON time_entry_revisions;
CREATE TRIGGER time_entry_revisions_append_only
BEFORE UPDATE OR DELETE ON time_entry_revisions
FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();

DROP TRIGGER IF EXISTS timesheet_events_append_only ON timesheet_events;
CREATE TRIGGER timesheet_events_append_only
BEFORE UPDATE OR DELETE ON timesheet_events
FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();

DROP TRIGGER IF EXISTS timesheet_revisions_append_only ON timesheet_revisions;
CREATE TRIGGER timesheet_revisions_append_only
BEFORE UPDATE OR DELETE ON timesheet_revisions
FOR EACH ROW EXECUTE FUNCTION reject_append_only_change();
