package com.sportlink.config;

import com.sportlink.club.model.Club;
import com.sportlink.club.model.ClubMember;
import com.sportlink.club.model.ClubMemberRole;
import com.sportlink.club.repository.ClubMemberRepository;
import com.sportlink.club.repository.ClubRepository;
import com.sportlink.event.dto.EventCreateRequest;
import com.sportlink.event.model.*;
import com.sportlink.event.service.EventService;
import com.sportlink.user.model.Role;
import com.sportlink.user.model.User;
import com.sportlink.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.boot.CommandLineRunner;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Slf4j
@Component
@Profile("dev")
@RequiredArgsConstructor
public class DevDataSeeder implements CommandLineRunner {

    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;
    private final EventService eventService;
    private final ClubRepository clubRepo;
    private final ClubMemberRepository memberRepo;

    @Override
    public void run(String... args) {
        if (userRepo.count() > 0) {
            log.info("DevDataSeeder: data already present, skipping.");
            return;
        }
        log.info("DevDataSeeder: seeding demo data...");

        // users
        User admin = makeUser("admin@sport.link", "Admin", "admin123", Role.ADMIN);
        User u1 = makeUser("alex@sport.link", "Alex", "pass123", Role.USER);
        User u2 = makeUser("maria@sport.link", "Maria", "pass123", Role.USER);
        User u3 = makeUser("ivan@sport.link", "Ivan", "pass123", Role.USER);
        User u4 = makeUser("kate@sport.link", "Kate", "pass123", Role.USER);

        // club
        Club club = clubRepo.save(Club.builder().name("Sparta Club").ownerId(u2.getId()).build());
        memberRepo.save(ClubMember.builder().clubId(club.getId()).userId(u2.getId()).role(ClubMemberRole.OWNER).build());
        memberRepo.save(ClubMember.builder().clubId(club.getId()).userId(u3.getId()).role(ClubMemberRole.MEMBER).build());

        // events
        OffsetDateTime base = OffsetDateTime.now(ZoneOffset.UTC).plusDays(1).withHour(18).withMinute(0).withSecond(0).withNano(0);

        // open training (manual)
        eventService.create(new EventCreateRequest(
                EventKind.TRAINING, "Boxing practice", "boxing", "Pads & sparring",
                base, 90, 20, true, EventAccess.PUBLIC, EventAdmission.MANUAL,
                null, base.minusHours(2), u1.getId(), null, 55.75, 37.61
        ));

        // public event (auto)
        eventService.create(new EventCreateRequest(
                EventKind.EVENT, "City Run 5K", "running", "Fun run",
                base.plusDays(1), 60, 200, true, EventAccess.PUBLIC, EventAdmission.AUTO,
                null, base.plusDays(1).minusHours(4), u1.getId(), null, 55.78, 37.60
        ));

        // club-only training (manual)
        eventService.create(new EventCreateRequest(
                EventKind.TRAINING, "Club Boxing — Sparring", "boxing", "Members only",
                base.plusDays(2), 120, 16, true, EventAccess.CLUB_ONLY, EventAdmission.MANUAL,
                null, base.plusDays(2).minusHours(3), u2.getId(), club.getId(), 55.73, 37.59
        ));

        // public training (manual)
        eventService.create(new EventCreateRequest(
                EventKind.TRAINING, "Basketball drills", "basketball", "Ball handling",
                base.plusDays(3), 90, 12, false, EventAccess.PUBLIC, EventAdmission.MANUAL,
                null, base.plusDays(3).minusHours(2), u3.getId(), null, 55.70, 37.65
        ));

        // big public event (auto)
        eventService.create(new EventCreateRequest(
                EventKind.EVENT, "Spartakiada 2025", "multi", "Multi-sport festival",
                base.plusDays(7), 240, 1000, true, EventAccess.PUBLIC, EventAdmission.AUTO,
                null, base.plusDays(7).minusDays(1), u2.getId(), null, 55.80, 37.50
        ));

        log.info("DevDataSeeder: done.");
    }

    private User makeUser(String email, String name, String rawPassword, Role role) {
        User u = User.builder()
                .email(email)
                .displayName(name)
                .passwordHash(passwordEncoder.encode(rawPassword))
                .role(role)
                .build();
        u = userRepo.save(u);
        log.info("Seed user: {} ({}) role={}", u.getEmail(), u.getId(), role);
        return u;
    }
}
