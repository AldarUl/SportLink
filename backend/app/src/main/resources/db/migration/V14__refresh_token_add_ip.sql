ALTER TABLE refresh_token
    ADD COLUMN IF NOT EXISTS ip VARCHAR(45);

ALTER TABLE refresh_token
    ADD COLUMN IF NOT EXISTS user_agent TEXT;

/* при необходимости поиска по ip можно добавить индекс: */
/* CREATE INDEX IF NOT EXISTS ix_refresh_token_ip ON refresh_token (ip); */
