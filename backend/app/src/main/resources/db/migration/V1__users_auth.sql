create table if not exists users (
  id            bigserial primary key,
  email         varchar(255) not null unique,
  password_hash text         not null,
  role          varchar(32)  not null default 'USER',
  status        varchar(32)  not null default 'ACTIVE',
  created_at    timestamptz  not null default now()
);

create table if not exists refresh_token (
  id           bigserial primary key,
  user_id      bigint       not null references users(id) on delete cascade,
  token        varchar(255) not null unique,
  issued_at    timestamptz  not null default now(),
  expires_at   timestamptz  not null,
  revoked_at   timestamptz,
  device_info  text
);
create index if not exists idx_refresh_user on refresh_token(user_id);
