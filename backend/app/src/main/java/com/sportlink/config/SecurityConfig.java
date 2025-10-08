package com.sportlink.config;

import com.sportlink.security.JwtAuthFilter;
import com.sportlink.security.JwtProperties;
import com.sportlink.security.UserDetailsServiceImpl;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.*;

import java.util.List;

@Configuration
@EnableConfigurationProperties(JwtProperties.class)
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final UserDetailsServiceImpl userDetailsService;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter, UserDetailsServiceImpl uds) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.userDetailsService = uds;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .authenticationProvider(daoAuthProvider())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> auth
                        // общедоступные
                        .requestMatchers("/api/v1/auth/**",
                                "/api-docs/**", "/swagger-ui/**", "/swagger-ui.html",
                                "/actuator/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/user").permitAll() // регистрация
                        .requestMatchers(HttpMethod.GET,
                                "/api/v1/event/**", "/api/v1/search/**", "/api/v1/sport/**").permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/user/*").permitAll()


                        // админка — только ADMIN
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")

                        // создание/редактирование событий — USER
                        .requestMatchers(HttpMethod.POST,  "/api/v1/event/**").hasRole("USER")
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/event/**").hasRole("USER")

                        // управление заявками — USER (организатор проверяется в сервисе)
                        .requestMatchers("/api/v1/application/**").hasRole("USER")


                        .requestMatchers(HttpMethod.POST, "/api/v1/club/**").hasRole("USER")
                        .requestMatchers(HttpMethod.GET,  "/api/v1/club/*/member").permitAll()


                        // всё остальное — с токеном
                        .anyRequest().authenticated()
                );
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

    @Bean public PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(List.of("http://localhost:3000","http://localhost:5173"));
        cfg.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return src;
    }
}
