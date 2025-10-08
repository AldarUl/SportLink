create extension if not exists "uuid-ossp";

create table if not exists club (
    id uuid primary key default uuid_generate_v4(),
    name varchar(120) not null,
    owner_id uuid not null references app_user(id),
    created_at timestamptz not null default now()
);
create index if not exists ix_club_owner on club(owner_id);

create table if not exists club_member (
    id uuid primary key default uuid_generate_v4(),
    club_id uuid not null references club(id) on delete cascade,
    user_id uuid not null references app_user(id) on delete cascade,
    role varchar(16) not null,             -- OWNER | MEMBER
    created_at timestamptz not null default now(),
    constraint ux_club_member unique (club_id, user_id)
);
create index if not exists ix_club_member_club on club_member(club_id);
