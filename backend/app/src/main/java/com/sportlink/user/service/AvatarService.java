package com.sportlink.user.service;

import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

public interface AvatarService {
    /** Сохраняет исходник и делает миниатюру, возвращает URL (например, /files/avatars/{userId}/avatar.jpg). */
    String store(UUID userId, MultipartFile file) throws Exception;
    void deleteAll(UUID userId) throws Exception;
    String link(UUID userId) throws Exception;
}
