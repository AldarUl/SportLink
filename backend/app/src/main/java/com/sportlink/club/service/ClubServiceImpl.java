package com.sportlink.club.service;

import com.sportlink.club.dto.*;
import com.sportlink.club.model.Club;
import com.sportlink.club.model.ClubMember;
import com.sportlink.club.model.ClubMemberRole;
import com.sportlink.club.repository.ClubMemberRepository;
import com.sportlink.club.repository.ClubRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class ClubServiceImpl implements ClubService {
    private final ClubRepository clubRepo;
    private final ClubMemberRepository memberRepo;

    @Override
    public ClubResponse create(String name, UUID ownerId) {
        Club club = clubRepo.save(Club.builder().name(name).ownerId(ownerId).build());
        // владелец сразу становится членом
        memberRepo.save(ClubMember.builder()
                .clubId(club.getId()).userId(ownerId).role(ClubMemberRole.OWNER).build());
        long members = memberRepo.countByClubIdAndRole(club.getId(), ClubMemberRole.OWNER);
        return new ClubResponse(club.getId(), club.getName(), club.getOwnerId(), members);
    }

    @Override
    public void join(UUID clubId, UUID userId) {
        clubRepo.findById(clubId).orElseThrow(() -> new EntityNotFoundException("Club not found"));
        if (!memberRepo.existsByClubIdAndUserId(clubId, userId)) {
            memberRepo.save(ClubMember.builder().clubId(clubId).userId(userId).role(ClubMemberRole.MEMBER).build());
        }
    }

    @Override
    public void leave(UUID clubId, UUID userId) {
        Club club = clubRepo.findById(clubId).orElseThrow(() -> new EntityNotFoundException("Club not found"));
        var m = memberRepo.findByClubIdAndUserId(clubId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Not a member"));
        if (m.getRole() == ClubMemberRole.OWNER || club.getOwnerId().equals(userId)) {
            throw new IllegalStateException("Owner cannot leave the club (transfer ownership first)");
        }
        memberRepo.delete(m);
    }

    @Override
    @Transactional(readOnly = true)
    public ClubMemberPage members(UUID clubId, int page, int size) {
        var p = memberRepo.findByClubId(clubId, PageRequest.of(page, size));
        var content = p.map(mm -> new ClubMemberResponse(mm.getUserId(), mm.getRole())).toList();
        return new ClubMemberPage(content, p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages(), p.isLast());
    }
}
