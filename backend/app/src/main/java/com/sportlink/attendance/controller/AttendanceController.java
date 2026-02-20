package com.sportlink.attendance.controller;

import com.sportlink.attendance.dto.AttendanceMarkRequest;
import com.sportlink.attendance.dto.AttendanceResponse;
import com.sportlink.attendance.model.AttendanceStatus;
import com.sportlink.attendance.service.AttendanceService;
import com.sportlink.user.model.User;
import com.sportlink.user.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/event/{eventId}/attendance")
public class AttendanceController {

    private final AttendanceService attendanceService;
    private final UserRepository userRepository;

    private UUID me(Authentication auth) {
        User u = userRepository.findByEmail(auth.getName()).orElseThrow();
        return u.getId();
    }

    // organizer: list all
    @GetMapping
    public List<AttendanceResponse> list(@PathVariable UUID eventId, Authentication auth) {
        return attendanceService.list(eventId, me(auth));
    }

    // organizer: mark someone
    @PostMapping
    public AttendanceResponse mark(@PathVariable UUID eventId,
                                   @RequestBody @Valid AttendanceMarkRequest req,
                                   Authentication auth) {
        return attendanceService.mark(eventId, me(auth), req);
    }

    // participant/organizer: get own mark (if exists)
    @GetMapping("/me")
    public AttendanceResponse getMe(@PathVariable UUID eventId, Authentication auth) {
        return attendanceService.getMe(eventId, me(auth));
    }

    // participant/organizer: mark self (ATTENDED/ABSENT)
    @PostMapping("/me")
    public AttendanceResponse markMe(@PathVariable UUID eventId,
                                     @RequestParam AttendanceStatus status,
                                     Authentication auth) {
        return attendanceService.markMe(eventId, me(auth), status);
    }
}
