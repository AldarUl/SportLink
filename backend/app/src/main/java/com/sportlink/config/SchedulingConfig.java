package com.sportlink.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import com.sportlink.event.config.EventsProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@Configuration
@EnableScheduling
@EnableConfigurationProperties(EventsProperties.class)
public class SchedulingConfig {}
