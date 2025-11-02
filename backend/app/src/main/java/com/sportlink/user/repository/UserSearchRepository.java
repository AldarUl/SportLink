package com.sportlink.user.repository;

import com.sportlink.user.dto.UserCard;
import com.sportlink.user.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface UserSearchRepository extends JpaRepository<User, UUID> {

    @Query("""
        select new com.sportlink.user.dto.UserCard(
            u.id, u.displayName, u.email, u.avatarUrl,
            s.sport, cast(s.level as integer)
        )
        from User u
        left join UserSportSkill s on s.user.id = u.id
        where (:q is null
                  or lower(u.displayName) like lower(concat('%', :q, '%'))
                  or lower(u.email)       like lower(concat('%', :q, '%')))
          and (:sport  is null or lower(s.sport) = lower(:sport))
          and (:lvlMin is null or s.level >= :lvlMin)
          and (:lvlMax is null or s.level <= :lvlMax)
        """)
    Page<UserCard> search(@Param("q") String q,
                          @Param("sport") String sport,
                          @Param("lvlMin") Integer lvlMin,
                          @Param("lvlMax") Integer lvlMax,
                          Pageable pageable);
}
