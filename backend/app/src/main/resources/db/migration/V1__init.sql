-- V1__init.sql
-- Базовая схема SportLink (локальная разработка)

-- Расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================
-- Пользователи
-- =========================
CREATE TABLE IF NOT EXISTS app_user (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         VARCHAR(255) NOT NULL,
    display_name  VARCHAR(120),
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(16)  NOT NULL DEFAULT 'USER',  -- USER | ADMIN (при необходимости)
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ
);

-- Уникальность email без учета регистра
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = 'public'
    AND    indexname  = 'ux_app_user_email_ci'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX ux_app_user_email_ci ON app_user ((lower(email)))';
  END IF;
END $$;

-- =========================
-- Клубы и членство
-- =========================
CREATE TABLE IF NOT EXISTS club (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       VARCHAR(120) NOT NULL,
    owner_id   UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_club_owner ON club(owner_id);

CREATE TABLE IF NOT EXISTS club_member (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id    UUID NOT NULL REFERENCES club(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    role       VARCHAR(16) NOT NULL,             -- OWNER | MEMBER
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ux_club_member UNIQUE (club_id, user_id)
);
CREATE INDEX IF NOT EXISTS ix_club_member_club ON club_member(club_id);

-- =========================
-- События
-- =========================
CREATE TABLE IF NOT EXISTS event (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kind                  VARCHAR(16)  NOT NULL,                    -- TRAINING | EVENT
    title                 VARCHAR(160) NOT NULL,
    sport                 VARCHAR(64)  NOT NULL,
    description           TEXT,
    starts_at             TIMESTAMPTZ  NOT NULL,
    duration_min          INT          NOT NULL,
    capacity              INT,
    waitlist_enabled      BOOLEAN      NOT NULL DEFAULT FALSE,
    access                VARCHAR(16)  NOT NULL,                    -- PUBLIC | CLUB_ONLY
    admission             VARCHAR(16)  NOT NULL,                    -- AUTO | MANUAL
    recurrence_rule       VARCHAR(255),
    registration_deadline TIMESTAMPTZ,
    organizer_id          UUID         NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    club_id               UUID,
    location_lat          DOUBLE PRECISION,
    location_lon          DOUBLE PRECISION,
    status                VARCHAR(16)  NOT NULL DEFAULT 'PUBLISHED', -- PUBLISHED | CANCELLED
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ,
    CONSTRAINT chk_event_kind     CHECK (kind     IN ('TRAINING','EVENT')),
    CONSTRAINT chk_event_access   CHECK (access   IN ('PUBLIC','CLUB_ONLY')),
    CONSTRAINT chk_event_admission CHECK (admission IN ('AUTO','MANUAL')),
    CONSTRAINT chk_event_status   CHECK (status   IN ('PUBLISHED','CANCELLED'))
);

-- FK на клуб (отложенно, чтобы гарантировать существование таблицы club)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_event_club'
  ) THEN
    ALTER TABLE event
      ADD CONSTRAINT fk_event_club
      FOREIGN KEY (club_id) REFERENCES club(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Индексы для ленты/поиска
CREATE INDEX IF NOT EXISTS ix_event_starts           ON event(starts_at);
CREATE INDEX IF NOT EXISTS ix_event_kind_starts      ON event(kind, starts_at);
CREATE INDEX IF NOT EXISTS ix_event_sport_starts     ON event(lower(sport), starts_at);
CREATE INDEX IF NOT EXISTS ix_event_access_starts    ON event(access, starts_at);
CREATE INDEX IF NOT EXISTS ix_event_admission_starts ON event(admission, starts_at);
CREATE INDEX IF NOT EXISTS ix_event_club_starts      ON event(club_id, starts_at);

-- =========================
-- Заявки на участие
-- =========================
CREATE TABLE IF NOT EXISTS application (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id   UUID NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    status     VARCHAR(16) NOT NULL,  -- PENDING | CONFIRMED | DECLINED | WAITLISTED
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ux_application_unique UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS ix_application_event                 ON application(event_id);
CREATE INDEX IF NOT EXISTS ix_application_user                  ON application(user_id);
CREATE INDEX IF NOT EXISTS ix_application_event_status          ON application(event_id, status);
CREATE INDEX IF NOT EXISTS ix_application_event_status_created  ON application(event_id, status, created_at);

-- =========================
-- Отзывы
-- =========================
CREATE TABLE IF NOT EXISTS review (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id   UUID NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    author_id  UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    rating     INT  NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ux_review_event_author UNIQUE (event_id, author_id)
);
CREATE INDEX IF NOT EXISTS ix_review_event ON review(event_id);

-- =========================
-- Refresh-токены (храним только ХЭШ)
-- =========================
CREATE TABLE IF NOT EXISTS refresh_token (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,

    token_hash  VARCHAR(64) NOT NULL,               -- sha256 в hex (64 символа)
    family_id   UUID        NOT NULL DEFAULT uuid_generate_v4(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    replaced_by UUID,                                -- self-FK на следующий токен
    ip          VARCHAR(64),
    user_agent  TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_refresh_token_hash      ON refresh_token(token_hash);
CREATE INDEX IF NOT EXISTS ix_refresh_token_user             ON refresh_token(user_id);
CREATE INDEX IF NOT EXISTS ix_refresh_token_expires          ON refresh_token(expires_at);
CREATE INDEX IF NOT EXISTS ix_refresh_token_family_id        ON refresh_token(family_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_refresh_token_replaced_by'
  ) THEN
    ALTER TABLE refresh_token
      ADD CONSTRAINT fk_refresh_token_replaced_by
      FOREIGN KEY (replaced_by) REFERENCES refresh_token(id)
      ON DELETE SET NULL;
  END IF;
END $$;
