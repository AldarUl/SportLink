package com.sportlink.admin.mapper;

import com.sportlink.admin.dto.AdminEvent;
import com.sportlink.admin.dto.AdminUser;
import com.sportlink.event.model.Event;
import com.sportlink.user.model.User;

public class AdminMapper {
    private AdminMapper() {}

    public static AdminUser toAdminUser(User u) {
        return new AdminUser(u.getId(), u.getEmail(), u.getDisplayName(), u.getCreatedAt());
    }

    public static AdminEvent toAdminEvent(Event e) {
        return new AdminEvent(
                e.getId(), e.getKind(), e.getTitle(), e.getSport(),
                e.getStartsAt(), e.getCapacity(), e.getStatus(), e.getOrganizerId()
        );
    }
}
