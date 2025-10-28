-- 1) Добавляем колонку для хеша токена (SHA-256 в hex = 64 символа)
ALTER TABLE refresh_token
    ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64);

-- 2) Для чистой БД в тестах можно сразу делать NOT NULL.
-- Если у вас уже есть прод-данные, сначала оставьте NULL, заполните, затем SET NOT NULL.
ALTER TABLE refresh_token
    ALTER COLUMN token_hash SET NOT NULL;

-- 3) Индекс/уникальность по хешу (опционально, но желательно)
CREATE UNIQUE INDEX IF NOT EXISTS ux_refresh_token_token_hash
    ON refresh_token(token_hash);

-- Если вы мигрируете с "token" на "token_hash" и хотите бэкфилл прямо в БД:
-- (Понадобится расширение pgcrypto: CREATE EXTENSION IF NOT EXISTS pgcrypto;)
-- UPDATE refresh_token SET token_hash = encode(digest(token, 'sha256'), 'hex')
-- WHERE token IS NOT NULL AND token_hash IS NULL;
