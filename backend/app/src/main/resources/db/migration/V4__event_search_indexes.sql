-- ускоряем /search и /event?...
create index if not exists ix_event_access_starts   on event(access, starts_at);
create index if not exists ix_event_admission_start on event(admission, starts_at);
create index if not exists ix_event_club_starts     on event(club_id, starts_at);
-- на заявки считаем слоты быстро
create index if not exists ix_application_event_status on application(event_id, status);
