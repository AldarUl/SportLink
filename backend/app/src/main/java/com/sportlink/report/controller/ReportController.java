package com.sportlink.report.controller;

import com.sportlink.report.dto.ReportSummary;
import com.sportlink.application.repository.ApplicationRepository;
import com.sportlink.event.repository.EventRepository;
import com.sportlink.user.repository.UserRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Report", description = "Отчёты и агрегаты")
@RestController
@RequestMapping("/api/v1/report")
@RequiredArgsConstructor
public class ReportController {
    private final UserRepository userRepo;
    private final EventRepository eventRepo;
    private final ApplicationRepository appRepo;

    @GetMapping("/summary")
    public ReportSummary summary() {
        return new ReportSummary(
                userRepo.count(),
                eventRepo.count(),
                appRepo.count()
        );
    }
}
