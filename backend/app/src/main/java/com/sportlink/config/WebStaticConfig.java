package com.sportlink.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class WebStaticConfig implements WebMvcConfigurer {

    @Value("${app.files.root:./var}")
    private String filesRoot;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Всё, что под /files/** — раздаём с диска из {filesRoot}
        registry.addResourceHandler("/files/**")
                .addResourceLocations("file:" + filesRoot + "/")
                .setCachePeriod(60 * 60); // кэш на час
    }
}
