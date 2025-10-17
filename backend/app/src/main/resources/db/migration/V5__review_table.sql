create extension if not exists "uuid-ossp";

create table if not exists review (
    id uuid primary key default uuid_generate_v4(),
    event_id uuid not null references event(id) on delete cascade,
    author_id uuid not null references app_user(id) on delete cascade,
    rating int not null check (rating between 1 and 5),
    comment text,
    created_at timestamptz not null default now(),
    constraint ux_review_event_author unique (event_id, author_id)
);

create index if not exists ix_review_event on review(event_id);
