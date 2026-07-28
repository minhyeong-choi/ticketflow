package com.ticket.ticketflow.domain.user.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateProfileRequest (@NotBlank String name, String phone){
}
