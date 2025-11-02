package com.sportlink.event.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "sportlink.events")
public class EventsProperties {
    /** Через сколько дней после окончания удалять событие */
    private int retentionDays = 30;

    /** Включить/выключить обработчик жизненного цикла */
    private boolean lifecycleEnabled = true;
}
