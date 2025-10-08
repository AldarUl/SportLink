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

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/ping")
    public String ping() { return "ok"; }

    @GetMapping("/summary")
    public AdminSummary summary() { return adminService.summary(); }

    @GetMapping("/user")
    public PageResponse<AdminUser> users(@RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return adminService.listUsers(pageable);
    }

    @GetMapping("/event")
    public PageResponse<AdminEvent> events(@RequestParam(required = false) EventStatus status,
                                           @RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "20") int size) {
        return adminService.listEvents(status, PageRequest.of(page, size));
    }

    @PostMapping("/event/{id}/cancel")
    public void cancel(@PathVariable UUID id) { adminService.cancelEvent(id); }

    @PostMapping("/event/{id}/publish")
    public void publish(@PathVariable UUID id) { adminService.publishEvent(id); }
}
