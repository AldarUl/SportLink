package com.sportlink.event.admin.mapper;

import com.sportlink.event.admin.dto.AdminEvent;
import com.sportlink.event.admin.dto.PageResponseAdminEvent;
import com.sportlink.event.model.Event;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class AdminEventMapper {
    public AdminEvent toDto(Event e) {
        return new AdminEvent(
                e.getId(), e.getKind(), e.getTitle(), e.getSport(),
                e.getStartsAt(), e.getCapacity(), e.getStatus(), e.getOrganizerId()
        );
    }

    public PageResponseAdminEvent toPage(Page<Event> pg) {
        List<AdminEvent> content = pg.getContent().stream().map(this::toDto).toList();
        return new PageResponseAdminEvent(
                content, pg.getNumber(), pg.getSize(),
                pg.getTotalElements(), pg.getTotalPages(), pg.isLast()
        );
    }
}
