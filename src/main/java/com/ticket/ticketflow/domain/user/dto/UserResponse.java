package com.ticket.ticketflow.domain.user.dto;

import com.ticket.ticketflow.domain.user.entity.Role;
import com.ticket.ticketflow.domain.user.entity.User;

public record UserResponse (Long id, String email, String name, String phone, Role role){

    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getEmail(),
                user.getName(), user.getPhone(), user.getRole());
    }
}
