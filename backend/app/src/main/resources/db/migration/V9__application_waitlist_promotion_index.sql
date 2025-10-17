CREATE INDEX IF NOT EXISTS ix_application_event_status_created
  ON application(event_id, status, created_at);
