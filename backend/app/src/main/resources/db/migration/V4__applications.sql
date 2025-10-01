-- Заявки на участие
create type application_status as enum ('PENDING','APPROVED','REJECTED','WAITING');

create table if not exists application (
  id         bigserial primary key,
  event_id   bigint not null references event(id) on delete cascade,
  user_id    bigint not null references users(id) on delete cascade,
  status     application_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists idx_app_event_status on application(event_id, status);
create index if not exists idx_app_user_status  on application(user_id, status);
