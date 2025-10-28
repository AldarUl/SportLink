-- V10__refresh_tokens.sql

CREATE TABLE IF NOT EXISTS refresh_token (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    token       TEXT NOT NULL,                     -- или VARCHAR(512) если хочешь ограничить длину
    issued_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_refresh_token_user ON refresh_token(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_refresh_token_token ON refresh_token(token);
