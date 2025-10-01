create table if not exists profile (
  id            bigserial primary key,
  user_id       bigint      not null unique references users(id) on delete cascade,
  display_name  varchar(100),
  telegram_url  varchar(255),
  level         smallint,
  radius_km     integer     not null default 10
);

create table if not exists sport (
  id    bigserial primary key,
  name  varchar(64) not null unique
);

create table if not exists user_sport_pref (
  user_id  bigint not null references users(id) on delete cascade,
  sport_id bigint not null references sport(id) on delete cascade,
  primary key (user_id, sport_id)
);
