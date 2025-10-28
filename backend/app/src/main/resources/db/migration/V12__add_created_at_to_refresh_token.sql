-- Add created_at and backfill automatically
alter table refresh_token
  add column if not exists created_at timestamptz not null default now();

-- (Optional) index if you’ll query by time
create index if not exists ix_refresh_token_created_at on refresh_token(created_at);
