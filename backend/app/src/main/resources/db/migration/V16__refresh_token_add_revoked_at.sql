-- V16__refresh_token_add_revoked_at.sql
ALTER TABLE refresh_token
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;  -- or TIMESTAMP if you use LocalDateTime
