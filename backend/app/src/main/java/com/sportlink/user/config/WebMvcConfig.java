package com.sportlink.user.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    // Дефолт ./var, даже если свойства нет
    private final Path filesRoot;

    public WebMvcConfig(@Value("${app.files.root:./var}") String rootDir) {
        // на всякий — подстрахуемся от null/пустого
        if (rootDir == null || rootDir.isBlank()) {
            rootDir = "./var";
        }
        this.filesRoot = Paths.get(rootDir).toAbsolutePath().normalize();
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        try {
            Path avatars = filesRoot.resolve("avatars");
            Files.createDirectories(avatars); // создаём при старте, чтобы хендлер не ссылался на воздух

            // ВАЖНО: для директорий — трейлинг / и file: URI
            String location = avatars.toUri().toString();
            if (!location.endsWith("/")) location += "/";

            registry.addResourceHandler("/static/avatars/**")
                    .addResourceLocations(location);
        } catch (Exception ignore) {
            // можно залогировать, но не роняем контекст из-за статиков
        }
    }
}
