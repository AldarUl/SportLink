-- Make sure UUID functions exist (already present in V1, but harmless)
create extension if not exists "uuid-ossp";

-- 1) Add a new UUID column
alter table refresh_token
  add column if not exists id_new uuid;

-- 2) Fill new column (assign new UUIDs; old BIGINT ids aren't referenced elsewhere)
update refresh_token
   set id_new = coalesce(id_new, uuid_generate_v4());

-- 3) Swap PK from old id -> id_new
do $$
begin
    if exists (
        select 1
        from information_schema.table_constraints
        where table_name = 'refresh_token'
          and constraint_type = 'PRIMARY KEY'
    ) then
        alter table refresh_token drop constraint refresh_token_pkey;
    end if;
end $$;

-- 4) Drop old BIGINT column and rename
alter table refresh_token drop column if exists id;
alter table refresh_token rename column id_new to id;

-- 5) Add PK on the new id
alter table refresh_token add primary key (id);

-- 6) Clean up possible leftover sequence from BIGSERIAL
drop sequence if exists refresh_token_id_seq;

-- (Optional) tighten indexes
create unique index if not exists ux_refresh_token_token on refresh_token(token);
create index if not exists ix_refresh_token_user_revoked on refresh_token(user_id, revoked);
