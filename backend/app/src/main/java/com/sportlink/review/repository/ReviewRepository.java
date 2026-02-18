package com.sportlink.review.repository;

import com.sportlink.review.model.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface ReviewRepository extends JpaRepository<Review, UUID> {

    Page<Review> findByEventId(UUID eventId, Pageable pageable);
    Page<Review> findByEventIdAndTargetId(UUID eventId, UUID targetId, Pageable pageable);

    boolean existsByEventIdAndAuthorIdAndTargetId(UUID eventId, UUID authorId, UUID targetId);

    @Query("select avg(r.rating) from Review r " +
            "where r.eventId = :eventId and (:targetId is null or r.targetId = :targetId)")
    Double averageRating(@Param("eventId") UUID eventId, @Param("targetId") UUID targetId);
}
