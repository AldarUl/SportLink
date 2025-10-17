DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_event_kind') THEN
    ALTER TABLE event ADD CONSTRAINT chk_event_kind
      CHECK (kind IN ('TRAINING','EVENT'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_event_access') THEN
    ALTER TABLE event ADD CONSTRAINT chk_event_access
      CHECK (access IN ('PUBLIC','CLUB_ONLY'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_event_admission') THEN
    ALTER TABLE event ADD CONSTRAINT chk_event_admission
      CHECK (admission IN ('AUTO','MANUAL'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_event_status') THEN
    ALTER TABLE event ADD CONSTRAINT chk_event_status
      CHECK (status IN ('PUBLISHED','CANCELLED'));
  END IF;
END $$;
