create extension if not exists "uuid-ossp";

alter table refresh_token
  add column if not exists family_id uuid;

update refresh_token
set family_id = coalesce(family_id, uuid_generate_v4());

alter table refresh_token
  alter column family_id set not null;

create index if not exists ix_refresh_token_family_id on refresh_token(family_id);
