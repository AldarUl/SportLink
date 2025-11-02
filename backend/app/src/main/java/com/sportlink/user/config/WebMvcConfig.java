package com.sportlink.user.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;

@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {
    private final AvatarProperties props;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String location = Path.of(props.getLocalDir()).toUri().toString(); // file:/...
        registry.addResourceHandler("/static/avatars/**")
                .addResourceLocations(location)
                .setCachePeriod(60 * 60 * 24 * 30); // 30 дней
    }
}
