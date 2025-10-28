ALTER TABLE refresh_token
    ADD COLUMN IF NOT EXISTS replaced_by UUID;

-- (опционально) если хочешь FK на саму себя:
-- ALTER TABLE refresh_token
--   ADD CONSTRAINT fk_refresh_token_replaced_by
--   FOREIGN KEY (replaced_by) REFERENCES refresh_token(id);
