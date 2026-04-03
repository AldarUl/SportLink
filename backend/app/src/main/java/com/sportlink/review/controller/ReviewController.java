package com.sportlink.review.controller;

import com.sportlink.review.dto.*;
import com.sportlink.review.service.ReviewService;
import com.sportlink.user.model.User;
import com.sportlink.user.repository.UserRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "Review", description = "Отзывы о событиях")
@RestController
@RequestMapping("/api/v1/review")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;
    private final UserRepository userRepository;

    private UUID me(Authentication auth) {
        String email = auth.getName();
        User u = userRepository.findByEmailIgnoreCase(email).orElseThrow();
        return u.getId();
    }

    @Operation(summary = "Создать отзыв (участник завершённого события)")
    @PostMapping
    public ReviewResponse create(@RequestBody @Valid ReviewCreateRequest req, Authentication auth) {
        return reviewService.create(me(auth), req);
    }

    @Operation(summary = "Отзывы по событию (с пагинацией и средней оценкой)")
    @GetMapping("/by-event/{eventId}")
    public ReviewPage byEvent(@PathVariable UUID eventId,
                              @RequestParam(required = false) UUID targetId,
                              @RequestParam(defaultValue = "0") int page,
                              @RequestParam(defaultValue = "20") int size) {
        // если targetId=null — вернёт все отзывы, иначе только по конкретному пользователю
        if (reviewService instanceof com.sportlink.review.service.ReviewServiceImpl impl) {
            return impl.listByEvent(eventId, targetId, page, size);
        }
        return reviewService.listByEvent(eventId, page, size);
    }
}
