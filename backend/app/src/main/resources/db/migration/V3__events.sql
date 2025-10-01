-- События/тренировки
create table if not exists event (
  id            bigserial primary key,
  sport_id      bigint       not null references sport(id),
  organizer_id  bigint       not null references users(id),
  title         varchar(120) not null,
  description   text,
  start_at      timestamptz  not null,
  end_at        timestamptz  not null,
  price         numeric(10,2) not null default 0,
  level         smallint,
  club_only     boolean      not null default false,
  lat           numeric(10,6),
  lng           numeric(10,6),
  capacity      integer      not null,
  reserved      integer      not null default 0,
  created_at    timestamptz  not null default now(),
  constraint chk_time_order check (start_at < end_at),
  constraint chk_capacity   check (capacity >= 0 and reserved >= 0 and reserved <= capacity)
);

create index if not exists idx_event_sport_time on event (sport_id, start_at);
create index if not exists idx_event_time on event (start_at);
-- без PostGIS пока обычные индексы; гео-сортировку можно делать через Haversine в SQL
