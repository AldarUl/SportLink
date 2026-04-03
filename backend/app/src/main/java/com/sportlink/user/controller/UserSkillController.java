package com.sportlink.user.controller;

import com.sportlink.user.dto.UserSkillResponse;
import com.sportlink.user.dto.UserSkillUpsertRequest;
import com.sportlink.user.model.User;
import com.sportlink.user.model.UserSportSkill;
import com.sportlink.user.repository.UserRepository;
import com.sportlink.user.repository.UserSportSkillRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;

import java.util.List;
import java.util.UUID;

@Tag(name = "User Skills", description = "Навыки пользователя по видам спорта")
@RestController
@RequestMapping("/api/v1/user/me/skills")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
public class UserSkillController {

    private final UserRepository userRepository;
    private final UserSportSkillRepository skillRepo;
    private final MessageSource messages;

    @Operation(summary = "Список моих навыков")
    @GetMapping
    public List<UserSkillResponse> list(Authentication auth) {
        UUID uid = currentUserId(auth);
        return skillRepo.findByUserId(uid).stream()
                .map(s -> new UserSkillResponse(
                        s.getSport(),
                        s.getLevel(),
                        levelLabel(s.getLevel())
                ))
                .toList();
    }


    @Operation(summary = "Создать/обновить уровень для спорта")
    @PutMapping("/{sport}")
    public UserSkillResponse upsert(@PathVariable String sport,
                                    @RequestBody @Valid UserSkillUpsertRequest req,
                                    Authentication auth) {
        UUID uid = currentUserId(auth);
        User user = userRepository.findById(uid).orElseThrow();

        String sportCode = (sport == null) ? null : sport.trim().toUpperCase();

        var skill = skillRepo.findByUserIdAndSportIgnoreCase(uid, sportCode)
                .orElseGet(() -> UserSportSkill.builder().user(user).sport(sportCode).build());

        skill.setLevel((short) req.level());
        skill = skillRepo.save(skill);

        return new UserSkillResponse(skill.getSport(), skill.getLevel(), levelLabel(skill.getLevel()));
    }

    private String levelLabel(int level) {
        var locale = LocaleContextHolder.getLocale();
        // дефолт — "Уровень X", если ключа нет
        return messages.getMessage("skill.level." + level, null, "Уровень " + level, locale);
    }

    @Operation(summary = "Удалить навык по спорту")
    @DeleteMapping("/{sport}")
    public void delete(@PathVariable String sport, Authentication auth) {
        String sportCode = (sport == null) ? null : sport.trim().toUpperCase();
        skillRepo.deleteByUserIdAndSportIgnoreCase(currentUserId(auth), sportCode);
    }

    private UUID currentUserId(Authentication auth) {
        return userRepository.findByEmailIgnoreCase(auth.getName()).orElseThrow().getId();
    }
}
