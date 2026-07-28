package com.ticket.ticketflow.domain.user.controller;

import com.ticket.ticketflow.domain.user.dto.ChangePasswordRequest;
import com.ticket.ticketflow.domain.user.dto.UpdateProfileRequest;
import com.ticket.ticketflow.domain.user.dto.UserResponse;
import com.ticket.ticketflow.domain.user.service.UserService;
import com.ticket.ticketflow.global.common.ApiResponse;
import com.ticket.ticketflow.global.security.CustomUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ApiResponse<UserResponse> me(@AuthenticationPrincipal CustomUserDetails principal) {
        return ApiResponse.success(userService.getMe(principal.getUserId()));
    }

    @PatchMapping("/me")
    public ApiResponse<UserResponse> updateMe(@AuthenticationPrincipal CustomUserDetails principal, @Valid @RequestBody UpdateProfileRequest request) {
        return ApiResponse.success(userService.updateProfile(principal.getUserId(), request));
    }

    @PatchMapping("/me/password")
    public ApiResponse<Void> changePassword(@AuthenticationPrincipal CustomUserDetails principal, @Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(principal.getUserId(), request);
        return ApiResponse.success(null);
    }
}
