package com.sportlink.sport.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/sport")
public class SportController {

    public record SportDto(String code, String name) {}

    @GetMapping
    public List<SportDto> list() {
        // Единый справочник видов спорта для всего приложения (профиль, создание/редактирование событий, панели карты)
        return List.of(
                new SportDto("RUNNING", "Бег"),
                new SportDto("FOOTBALL", "Футбол"),
                new SportDto("BASKETBALL", "Баскетбол"),
                new SportDto("VOLLEYBALL", "Волейбол"),
                new SportDto("TENNIS", "Теннис"),
                new SportDto("SWIMMING", "Плавание"),
                new SportDto("CYCLING", "Велоспорт"),
                new SportDto("YOGA", "Йога"),
                new SportDto("BOXING", "Бокс"),
                new SportDto("MMA", "ММА")
        );
    }
}
