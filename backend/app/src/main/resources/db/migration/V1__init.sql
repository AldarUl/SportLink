-- V1__init.sql
-- Базовая схема SportLink (локальная разработка)

-- Расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========
-- helper: IMMUTABLE lower() для индексов/уникальных ограничений
-- =========
CREATE OR REPLACE FUNCTION immutable_lower(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$ SELECT lower(t); $$;

-- =========================
-- Пользователи
-- =========================
CREATE TABLE IF NOT EXISTS app_user (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         VARCHAR(255) NOT NULL,
    display_name  VARCHAR(120),
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(16)  NOT NULL DEFAULT 'USER',  -- USER | ADMIN
    avatar_url   TEXT,
    about        VARCHAR(400),
    city         VARCHAR(64),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ
);

-- Уникальность email без учета регистра (через IMMUTABLE-обёртку)
CREATE UNIQUE INDEX IF NOT EXISTS ux_app_user_email_ci
    ON app_user (immutable_lower(email));

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
    CONSTRAINT chk_event_kind        CHECK (kind     IN ('TRAINING','EVENT')),
    CONSTRAINT chk_event_access      CHECK (access   IN ('PUBLIC','CLUB_ONLY')),
    CONSTRAINT chk_event_admission   CHECK (admission IN ('AUTO','MANUAL')),
    CONSTRAINT chk_event_status      CHECK (status   IN ('PUBLISHED','CANCELLED')),
    -- capacity: либо NULL (безлимит), либо >= 1
    CONSTRAINT chk_event_capacity_pos CHECK (capacity IS NULL OR capacity >= 1),
    -- координаты допускают NULL; если заданы, то в допустимых диапазонах
    CONSTRAINT chk_event_lat_range   CHECK (location_lat IS NULL OR (location_lat BETWEEN -90  AND 90)),
    CONSTRAINT chk_event_lon_range   CHECK (location_lon IS NULL OR (location_lon BETWEEN -180 AND 180))
);

-- FK на клуб (SET NULL)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_event_club') THEN
    ALTER TABLE event
      ADD CONSTRAINT fk_event_club
      FOREIGN KEY (club_id) REFERENCES club(id)
      ON DELETE SET NULL;
  END IF;
END $$ LANGUAGE plpgsql;

-- Индексы для ленты/поиска
CREATE INDEX IF NOT EXISTS ix_event_starts            ON event(starts_at);
CREATE INDEX IF NOT EXISTS ix_event_kind_starts       ON event(kind, starts_at);
-- Было: lower(sport). Столкнулись с IMMUTABLE — используем обёртку.
CREATE INDEX IF NOT EXISTS ix_event_sport_starts      ON event(immutable_lower(sport), starts_at);
CREATE INDEX IF NOT EXISTS ix_event_access_starts     ON event(access, starts_at);
CREATE INDEX IF NOT EXISTS ix_event_admission_starts  ON event(admission, starts_at);
CREATE INDEX IF NOT EXISTS ix_event_club_starts       ON event(club_id, starts_at);
CREATE INDEX IF NOT EXISTS ix_event_status_starts     ON event(status, starts_at);

-- GEO-индексы под BBOX (BETWEEN по lat/lon)
CREATE INDEX IF NOT EXISTS ix_event_location_lat      ON event(location_lat);
CREATE INDEX IF NOT EXISTS ix_event_location_lon      ON event(location_lon);
CREATE INDEX IF NOT EXISTS ix_event_location_lat_lon  ON event(location_lat, location_lon);
CREATE INDEX IF NOT EXISTS ix_event_location_present
    ON event(location_lat, location_lon)
    WHERE location_lat IS NOT NULL AND location_lon IS NOT NULL;

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

    token_hash  VARCHAR(64) NOT NULL,               -- sha256 hex (64)
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

-- =========================
-- Навыки пользователя по видам спорта
-- =========================
CREATE TABLE IF NOT EXISTS user_sport_skill (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    sport      VARCHAR(64) NOT NULL,
    level      SMALLINT    NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT chk_user_sport_level CHECK (level BETWEEN 1 AND 5)
);

-- case-insensitive уникальность по (user_id, sport)
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_sport_ci
    ON user_sport_skill (user_id, immutable_lower(sport));


CREATE INDEX IF NOT EXISTS ix_user_sport_user  ON user_sport_skill(user_id);
CREATE INDEX IF NOT EXISTS ix_user_sport_sport ON user_sport_skill(immutable_lower(sport));


-- =========================
-- Доп.поля уровня у события
-- =========================
ALTER TABLE event
  ADD COLUMN IF NOT EXISTS level_min SMALLINT,
  ADD COLUMN IF NOT EXISTS level_max SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_event_level_range') THEN
    ALTER TABLE event
      ADD CONSTRAINT chk_event_level_range
      CHECK (
        (level_min IS NULL AND level_max IS NULL)
        OR (level_min IS NOT NULL AND level_max IS NOT NULL AND
            level_min BETWEEN 1 AND 5 AND level_max BETWEEN 1 AND 5 AND
            level_min <= level_max)
      );
  END IF;
END $$ LANGUAGE plpgsql;


DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_refresh_token_replaced_by') THEN
    ALTER TABLE refresh_token
      ADD CONSTRAINT fk_refresh_token_replaced_by
      FOREIGN KEY (replaced_by) REFERENCES refresh_token(id)
      ON DELETE SET NULL;
  END IF;
END $$ LANGUAGE plpgsql;

ALTER TABLE "user" ADD COLUMN avatar_url varchar(512);
