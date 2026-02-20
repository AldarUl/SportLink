package com.sportlink.event.model;

/**
 * Доступ к событию.
 * PUBLIC  — публичное (видно всем в выдаче/на карте).
 * PRIVATE — приватное (по приглашению). На текущем этапе используется как режим «не клубное».
 *
 * CLUB_ONLY оставлен для обратной совместимости со старыми данными, но в UI не используется.
 */
public enum EventAccess {
    PUBLIC,
    PRIVATE,
    CLUB_ONLY
}
