package com.sportlink.config;

import com.sportlink.security.JwtAuthFilter;
import com.sportlink.security.JwtProperties;
import com.sportlink.security.UserDetailsServiceImpl;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableConfigurationProperties(JwtProperties.class)
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final UserDetailsServiceImpl userDetailsService;
    private final Environment env;

    @Value("${security.cors.allowed-origins:}")
    private List<String> allowedOrigins;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter, UserDetailsServiceImpl uds, Environment env) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.userDetailsService = uds;
        this.env = env;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        final boolean isDev = Arrays.asList(env.getActiveProfiles()).contains("dev");

        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authenticationProvider(daoAuthProvider())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> {
                    // Swagger / OpenAPI
                    auth.requestMatchers(
                            "/api-docs/**",
                            "/v3/api-docs/**",
                            "/swagger-ui/**",
                            "/swagger-ui.html"
                    ).permitAll();

                    // Публичная аутентификация/регистрация
                    auth.requestMatchers("/api/v1/auth/**").permitAll();
                    auth.requestMatchers(HttpMethod.POST, "/api/v1/user").permitAll();

                    // Публичное чтение каталога/поиска/событий/профилей
                    auth.requestMatchers(HttpMethod.GET,
                            "/api/v1/event/**",
                            "/api/v1/search/**",
                            "/api/v1/sport/**",
                            "/api/v1/user/*"
                    ).permitAll();

                    // Actuator: в dev — открыт; в prod — только health (+ prometheus при мониторинге)
                    if (isDev) {
                        auth.requestMatchers("/actuator/**").permitAll();
                    } else {
                        auth.requestMatchers("/actuator/health", "/actuator/health/**").permitAll();
                        auth.requestMatchers("/actuator/prometheus").permitAll(); // убери, если не нужен
                        auth.requestMatchers("/actuator/**").authenticated();
                    }

                    // Админка
                    auth.requestMatchers("/api/v1/admin/**").hasRole("ADMIN");

                    // События (создание/редактирование)
                    auth.requestMatchers(HttpMethod.POST,  "/api/v1/event/**").hasRole("USER");
                    auth.requestMatchers(HttpMethod.PATCH, "/api/v1/event/**").hasRole("USER");

                    // Заявки — авторизованный пользователь (права организатора проверяются в сервисе)
                    auth.requestMatchers("/api/v1/application/**").hasRole("USER");

                    // Клубы
                    auth.requestMatchers(HttpMethod.POST, "/api/v1/club/**").hasRole("USER");
                    auth.requestMatchers(HttpMethod.GET,  "/api/v1/club/*/member").permitAll();

                    // Отзывы
                    auth.requestMatchers(HttpMethod.GET,  "/api/v1/review/**").permitAll();
                    auth.requestMatchers(HttpMethod.POST, "/api/v1/review/**").hasRole("USER");

                    // Остальное — только аутентифицированным
                    auth.anyRequest().authenticated();
                });

        return http.build();
    }

    @Bean
    public DaoAuthenticationProvider daoAuthProvider() {
        DaoAuthenticationProvider p = new DaoAuthenticationProvider();
        p.setUserDetailsService(userDetailsService);
        p.setPasswordEncoder(passwordEncoder());
        return p;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration cfg) throws Exception {
        return cfg.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /** Единый бин CORS, источники — из application*.yml */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();

        List<String> origins = (allowedOrigins == null || allowedOrigins.isEmpty())
                ? List.of("http://localhost:3000", "http://localhost:5173")
                : allowedOrigins;

        cfg.setAllowedOrigins(origins);
        cfg.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return src;
    }
}
