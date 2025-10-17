DO $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'fk_event_club'
  ) THEN
    ALTER TABLE event
      ADD CONSTRAINT fk_event_club
      FOREIGN KEY (club_id)
      REFERENCES club(id)
      ON DELETE SET NULL;
  END IF;
END $$;
