package com.sportlink.review.repository;

import com.sportlink.review.model.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface ReviewRepository extends JpaRepository<Review, UUID> {
    Page<Review> findByEventId(UUID eventId, Pageable pageable);

    boolean existsByEventIdAndAuthorId(UUID eventId, UUID authorId);

    @Query("select avg(r.rating) from Review r where r.eventId = :eventId")
    Double averageRating(@Param("eventId") UUID eventId);
}
