package com.sportlink.user.service;

import net.coobird.thumbnailator.Thumbnails;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.*;
import java.util.UUID;

@Service
public class AvatarServiceImpl implements AvatarService {

    @Value("${app.files.root:./var}")
    private String filesRoot;

    @Override
    public String store(UUID userId, MultipartFile file) throws Exception {
        Path dir = Path.of(filesRoot, "avatars", userId.toString());
        Files.createDirectories(dir);

        Path original = dir.resolve("original");
        Files.copy(file.getInputStream(), original, StandardCopyOption.REPLACE_EXISTING);

        Path avatar = dir.resolve("avatar.jpg");
        Thumbnails.of(original.toFile())
                .size(512, 512)
                .outputFormat("jpg")
                .outputQuality(0.9)
                .toFile(avatar.toFile());

        Path thumb = dir.resolve("avatar_128.jpg");
        Thumbnails.of(avatar.toFile()).size(128, 128).outputFormat("jpg").toFile(thumb.toFile());

        // можно вернуть базу, но главное — link() всегда даст версию
        return "/files/avatars/" + userId + "/avatar.jpg";
    }

    @Override
    public void deleteAll(UUID userId) throws Exception {
        Path dir = Path.of(filesRoot, "avatars", userId.toString());
        if (Files.exists(dir)) {
            try (var s = Files.walk(dir)) {
                s.sorted((a,b) -> b.getNameCount() - a.getNameCount()).forEach(p -> {
                    try { Files.deleteIfExists(p); } catch (Exception ignored) {}
                });
            }
        }
    }

    @Override
    public String link(UUID userId) throws Exception {
        Path avatar = Path.of(filesRoot, "avatars", userId.toString(), "avatar.jpg");
        if (!Files.exists(avatar)) return null;
        long v = Files.getLastModifiedTime(avatar).toMillis(); // версия по mtime
        return "/files/avatars/" + userId + "/avatar.jpg?v=" + v;
    }
}
