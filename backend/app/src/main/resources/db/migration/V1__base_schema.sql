-- V1: базовая схема приложения
-- PostgreSQL

create extension if not exists "uuid-ossp";

-- === USERS ===
create table if not exists app_user (
    id            uuid primary key default uuid_generate_v4(),
    email         varchar(255) not null unique,
    display_name  varchar(120),
    password_hash varchar(255) not null,
    created_at    timestamptz  not null default now()
    -- поле role добавится в V2__add_user_role.sql
);

-- === EVENTS ===
create table if not exists event (
    id                     uuid primary key default uuid_generate_v4(),
    kind                   varchar(16)  not null,  -- TRAINING | EVENT
    title                  varchar(160) not null,
    sport                  varchar(64)  not null,
    description            text,
    starts_at              timestamptz  not null,
    duration_min           int          not null,
    capacity               int,
    waitlist_enabled       boolean      not null default false,
    access                 varchar(16)  not null,  -- PUBLIC | CLUB_ONLY
    admission              varchar(16)  not null,  -- AUTO | MANUAL
    recurrence_rule        varchar(255),
    registration_deadline  timestamptz,
    organizer_id           uuid         not null references app_user(id),
    club_id                uuid,                    -- FK к club.id можно добавить в V3 (когда есть таблица club)
    location_lat           double precision,
    location_lon           double precision,
    status                 varchar(16)  not null default 'PUBLISHED'  -- PUBLISHED | CANCELLED
);

-- Индексы для быстрых выборок ленты
create index if not exists ix_event_starts        on event(starts_at);
create index if not exists ix_event_kind_starts   on event(kind,  starts_at);
create index if not exists ix_event_sport_starts  on event(lower(sport), starts_at);

-- === APPLICATIONS (заявки) ===
create table if not exists application (
    id         uuid primary key default uuid_generate_v4(),
    event_id   uuid not null references event(id) on delete cascade,
    user_id    uuid not null references app_user(id) on delete cascade,
    status     varchar(16) not null,  -- PENDING | CONFIRMED | DECLINED | WAITLISTED
    created_at timestamptz  not null default now(),
    constraint ux_application_unique unique (event_id, user_id)
);

-- Базовые индексы
create index if not exists ix_application_event      on application(event_id);
create index if not exists ix_application_user       on application(user_id);
