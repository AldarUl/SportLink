package com.sportlink.event.model;

public enum EventStatus {
    DRAFT,
    PUBLISHED,  // запланировано/опубликовано (ещё не началось)
    STARTED,    // идёт сейчас
    FINISHED,   // завершено
    CANCELLED
}
