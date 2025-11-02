package com.sportlink.user.service;

import com.sportlink.user.config.AvatarProperties;
import lombok.RequiredArgsConstructor;
import net.coobird.thumbnailator.Thumbnails;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AvatarService {
    private final AvatarProperties props;

    // сохраняем как JPEG 512x512 max, имя с ts для bust-cache
    public String store(UUID userId, MultipartFile file) throws IOException {
        if (file.isEmpty()) throw new IllegalArgumentException("Empty file");
        String ct = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        if (!(ct.startsWith("image/"))) throw new IllegalArgumentException("Only images allowed");

        Path base = Path.of(props.getLocalDir(), userId.toString());
        Files.createDirectories(base);

        String name = Instant.now().toEpochMilli() + ".jpg";
        Path target = base.resolve(name);

        // ресайз с ограничением 512 и компрессией
        Thumbnails.of(file.getInputStream())
                .size(512, 512)
                .outputFormat("jpg")
                .outputQuality(0.9f)
                .toFile(target.toFile());

        // возвращаем публичный URL, соответствующий ResourceHandler
        return "/static/avatars/" + userId + "/" + name;
    }

    public void deleteAll(UUID userId) throws IOException {
        Path base = Path.of(props.getLocalDir(), userId.toString());
        if (Files.exists(base)) {
            try (var s = Files.list(base)) {
                s.forEach(p -> { try { Files.deleteIfExists(p); } catch (IOException ignored) {} });
            }
        }
    }
}
