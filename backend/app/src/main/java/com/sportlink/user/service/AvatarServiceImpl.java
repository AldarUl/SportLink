package com.sportlink.user.service;

import net.coobird.thumbnailator.Thumbnails;
import net.coobird.thumbnailator.tasks.UnsupportedFormatException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Base64;
import java.util.UUID;

@Service
public class AvatarServiceImpl implements AvatarService {

    // ==== Настройки Nextcloud ====

    @Value("${app.files.root:./var}")
    private String filesRoot;

    @Value("${nextcloud.base-url}")
    private String baseUrl;               // например: http://nextcloud

    @Value("${nextcloud.username}")
    private String username;              // например: sportlink

    @Value("${nextcloud.password}")
    private String password;

    @Value("${nextcloud.avatars-root}")
    private String avatarsRoot;          // /remote.php/dav/files/sportlink/SportLink/avatars

    private final HttpClient httpClient;

    public AvatarServiceImpl() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    // ======== PUBLIC API ========

    @Override
    public String store(UUID userId, MultipartFile file) throws Exception {
        // 1. Временная директория для обработки картинок
        Path tempDir = Files.createTempDirectory("avatar-" + userId);
        try {
            if (file == null || file.isEmpty()) {
                throw new IllegalArgumentException("Файл пустой");
            }

            // Читаем байты один раз (чтобы можно было и сохранить original, и построить превью)
            byte[] bytes = file.getBytes();

            // Имя original (с расширением, если оно есть)
            String originalName = file.getOriginalFilename();
            String ext = null;
            if (originalName != null) {
                int dot = originalName.lastIndexOf('.');
                if (dot > -1 && dot < originalName.length() - 1) {
                    ext = originalName.substring(dot + 1).toLowerCase();
                    // небольшой sanity-check
                    if (ext.length() > 8) ext = null;
                }
            }
            String originalFileName = (ext != null && !ext.isBlank()) ? ("original." + ext) : "original";

            // ====== Готовим файлы во временной папке ======
            Path original = tempDir.resolve(originalFileName);
            Files.write(original, bytes);

            Path avatar = tempDir.resolve("avatar.jpg");
            try {
                Thumbnails.of(new ByteArrayInputStream(bytes))
                        .size(512, 512)
                        .outputFormat("jpg")
                        .outputQuality(0.9)
                        .toFile(avatar.toFile());
            } catch (UnsupportedFormatException ex) {
                // Чаще всего падает на WEBP/HEIC без ImageIO-плагина
                throw new IllegalArgumentException("Неподдерживаемый формат изображения. Загрузите JPG или PNG.");
            }

            Path thumb = tempDir.resolve("avatar_128.jpg");
            Thumbnails.of(avatar.toFile())
                    .size(128, 128)
                    .outputFormat("jpg")
                    .toFile(thumb.toFile());

            // ====== Локальная копия как раньше (для /files/avatars/...) ======
            Path localDir = Path.of(filesRoot, "avatars", userId.toString());
            Files.createDirectories(localDir);

            Path localAvatar = localDir.resolve("avatar.jpg");
            Files.copy(avatar, localAvatar, java.nio.file.StandardCopyOption.REPLACE_EXISTING);

            Path localThumb = localDir.resolve("avatar_128.jpg");
            Files.copy(thumb, localThumb, java.nio.file.StandardCopyOption.REPLACE_EXISTING);

            // ====== Загрузка в Nextcloud ======
            // 1. Убедиться, что папки есть
            ensureUserFolderExists(userId);

            // 2. Загрузить файлы в Nextcloud (WebDAV PUT)
            uploadToNextcloud(userId, originalFileName, original);
            uploadToNextcloud(userId, "avatar.jpg", avatar);
            uploadToNextcloud(userId, "avatar_128.jpg", thumb);

            // 3. Вернуть ссылку (как и раньше)
            return buildAvatarPath(userId);

        } finally {
            // Почистить только временную директорию
            try (var s = Files.walk(tempDir)) {
                s.sorted((a, b) -> b.getNameCount() - a.getNameCount())
                        .forEach(p -> {
                            try {
                                Files.deleteIfExists(p);
                            } catch (Exception ignored) {}
                        });
            } catch (Exception ignored) {}
        }
    }


    @Override
    public void deleteAll(UUID userId) {
        // Для Nextcloud хранилища удаление не обязательно:
        // store(...) всегда перезаписывает файлы avatar.jpg и avatar_128.jpg.
        // Поэтому здесь ничего не делаем.
    }

    @Override
    public String link(UUID userId) throws Exception {
        // Здесь два варианта:
        // 1) вернуть относительный путь, который твой контроллер будет проксировать,
        // 2) вернуть прямой WebDAV/Nextcloud URL.
        //
        // Я оставляю старый вариант, чтобы не ломать фронт:
        return buildAvatarPath(userId);
    }

    // ======== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ========

    private String buildAvatarPath(UUID userId) {
        // Как было: /files/avatars/<userId>/avatar.jpg?v=...
        long version = System.currentTimeMillis(); // простая версия по времени
        return "/files/avatars/" + userId + "/avatar.jpg?v=" + version;
    }

    private String buildUserRemoteDir(UUID userId) {
        // /remote.php/dav/files/.../avatars/<userId>
        String root = avatarsRoot.endsWith("/") ? avatarsRoot.substring(0, avatarsRoot.length() - 1) : avatarsRoot;
        return root + "/" + userId;
    }

    private String buildRemoteFilePath(UUID userId, String filename) {
        // /remote.php/dav/files/.../avatars/<userId>/<filename>
        return buildUserRemoteDir(userId) + "/" + filename;
    }

    /**
     * Создаём папку пользователя в Nextcloud, если её ещё нет.
     * Для этого используем WebDAV-метод MKCOL.
     */
    private void ensureUserFolderExists(UUID userId) throws IOException, InterruptedException {
        // 1. /remote.php/dav/files/sportlink/SportLink
        mkcolSafe("/remote.php/dav/files/" + username + "/SportLink");

        // 2. /remote.php/dav/files/sportlink/SportLink/avatars
        mkcolSafe(avatarsRoot); // avatarsRoot уже содержит /remote.php/dav/files/sportlink/SportLink/avatars

        // 3. /remote.php/dav/files/sportlink/SportLink/avatars/<userId>
        mkcolSafe(buildUserRemoteDir(userId));
    }

    private void mkcolSafe(String remotePath) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(fullUrl(remotePath)))
                .timeout(Duration.ofSeconds(5))
                .header("Authorization", basicAuthHeader())
                .method("MKCOL", HttpRequest.BodyPublishers.noBody())
                .build();

        HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
        int code = response.statusCode();

        // 201 — создано
        // 405 / 409 — уже существует
        if (code == 201 || code == 405 || code == 409) {
            return;
        }

        throw new IOException("Failed to MKCOL " + remotePath + ": HTTP " + code);
    }

    private void uploadToNextcloud(UUID userId, String filename, Path localFile)
            throws IOException, InterruptedException {

        String remotePath = buildRemoteFilePath(userId, filename);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(fullUrl(remotePath)))
                .timeout(Duration.ofSeconds(15))
                .header("Authorization", basicAuthHeader())
                .PUT(HttpRequest.BodyPublishers.ofFile(localFile))
                .build();

        HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
        int code = response.statusCode();
        if (code >= 400) {
            throw new IOException("Failed to upload " + filename + " to Nextcloud: HTTP " + code);
        }
    }

    private void sendDavRequest(String method, String remotePath, HttpRequest.BodyPublisher body)
            throws IOException, InterruptedException {

        if (body == null) {
            body = HttpRequest.BodyPublishers.noBody();
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(fullUrl(remotePath)))
                .timeout(Duration.ofSeconds(10))
                .header("Authorization", basicAuthHeader())
                .method(method, body)
                .build();

        HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
        int code = response.statusCode();
        if (code >= 400 && !(method.equals("DELETE") && code == 404)) {
            throw new IOException("WebDAV " + method + " failed for " + remotePath + " : HTTP " + code);
        }
    }

    private String fullUrl(String remotePath) {
        String base = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        String path = remotePath.startsWith("/") ? remotePath : "/" + remotePath;
        return base + path;
    }

    private String basicAuthHeader() {
        String creds = username + ":" + password;
        String encoded = Base64.getEncoder().encodeToString(creds.getBytes());
        return "Basic " + encoded;
    }
}
