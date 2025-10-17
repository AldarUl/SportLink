-- created_at: обязателен и по умолчанию now()
ALTER TABLE event
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- updated_at: хранит время последнего обновления; Hibernate @UpdateTimestamp запишет значение
ALTER TABLE event
    ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- бэкофил для уже существующих строк (чтобы не было NULL сразу после добавления)
UPDATE event
SET updated_at = created_at
WHERE updated_at IS NULL;
