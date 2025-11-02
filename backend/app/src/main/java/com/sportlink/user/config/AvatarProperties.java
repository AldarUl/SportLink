package com.sportlink.user.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "avatar")
@Getter @Setter
public class AvatarProperties {
    private String localDir;
}
