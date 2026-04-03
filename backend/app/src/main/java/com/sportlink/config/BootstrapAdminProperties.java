package com.sportlink.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Настройки для bootstrap-админа.
 *
 * Идея: при первом запуске системы админов ещё нет.
 * Тогда можно передать email+password через env (.env/docker-compose) и приложение само создаст админа.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "app.bootstrap-admin")
public class BootstrapAdminProperties {
    /** Включить/выключить создание bootstrap-админа. */
    private boolean enabled = true;

    /** Email админа (если пусто — bootstrap пропускается). */
    private String email;

    /** Пароль админа (если пусто — bootstrap пропускается). */
    private String password;

    /** Отображаемое имя. */
    private String displayName = "Admin";
}
