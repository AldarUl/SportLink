package com.sportlink.user.dto;

import java.util.UUID;

/** Плоская карточка пользователя для каталога/поиска. */
public record UserCard(
        UUID id,
        String displayName,
        String email,
        String avatarUrl,
        String sport,      // может быть null, если скиллов нет
        Integer level      // может быть null
) {}
