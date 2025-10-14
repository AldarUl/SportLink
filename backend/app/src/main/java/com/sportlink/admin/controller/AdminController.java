package com.sportlink.admin.controller;

import com.sportlink.admin.dto.AdminSummary;
import com.sportlink.admin.dto.AdminUser;
import com.sportlink.admin.dto.AdminEvent;
import com.sportlink.admin.dto.PageResponse;
import com.sportlink.admin.service.AdminService;
import com.sportlink.event.model.EventStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@io.swagger.v3.oas.annotations.tags.Tag(name = "Admin", description = "Администрирование")
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @io.swagger.v3.oas.annotations.Operation(summary = "Проверка доступности")
    @GetMapping("/ping")
    public String ping() { return "ok"; }


    @io.swagger.v3.oas.annotations.Operation(summary = "Сводка по системе")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    @GetMapping("/summary")
    public AdminSummary summary() { return adminService.summary(); }

    @io.swagger.v3.oas.annotations.Operation(summary = "Пользователи (пагинация)")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    @GetMapping("/user")
    public PageResponse<AdminUser> users(@RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return adminService.listUsers(pageable);
    }

    @io.swagger.v3.oas.annotations.Operation(summary = "События (фильтр по статусу, пагинация)")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    @GetMapping("/event")
    public PageResponse<AdminEvent> events(@RequestParam(required = false) EventStatus status,
                                           @RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "20") int size) {
        return adminService.listEvents(status, PageRequest.of(page, size));
    }

    @io.swagger.v3.oas.annotations.Operation(summary = "Отменить событие")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    @PostMapping("/event/{id}/cancel")
    public void cancel(@PathVariable UUID id) { adminService.cancelEvent(id); }

    @io.swagger.v3.oas.annotations.Operation(summary = "Опубликовать событие")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
    @PostMapping("/event/{id}/publish")
    public void publish(@PathVariable UUID id) { adminService.publishEvent(id); }
}
