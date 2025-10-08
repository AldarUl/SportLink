alter table app_user
    add column if not exists role varchar(16) not null default 'USER';
