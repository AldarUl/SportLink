package com.sportlink.sport.controller;

import com.sportlink.sport.dto.SportResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@io.swagger.v3.oas.annotations.tags.Tag(name = "Sport", description = "Справочник видов спорта")
@RestController
@RequestMapping("/api/v1/sport")
public class SportController {

    @GetMapping
    public List<SportResponse> list() {
        // позже вынесешь в БД/конфиг
        return List.of(
                new SportResponse("football", "Футбол"),
                new SportResponse("basketball", "Баскетбол"),
                new SportResponse("boxing", "Бокс"),
                new SportResponse("volleyball", "Волейбол"),
                new SportResponse("running", "Бег")
        );
    }
}
