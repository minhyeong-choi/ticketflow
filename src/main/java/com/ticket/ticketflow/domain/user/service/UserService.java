package com.ticket.ticketflow.domain.user.service;

import com.ticket.ticketflow.domain.user.dto.ChangePasswordRequest;
import com.ticket.ticketflow.domain.user.dto.UpdateProfileRequest;
import com.ticket.ticketflow.domain.user.dto.UserResponse;
import com.ticket.ticketflow.domain.user.entity.User;
import com.ticket.ticketflow.domain.user.exception.UserErrorCode;
import com.ticket.ticketflow.domain.user.repository.UserRepository;
import com.ticket.ticketflow.global.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserResponse getMe(Long userId) {
        return UserResponse.from(findUserOrThrow(userId));
    }

    @Transactional
    public UserResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = findUserOrThrow(userId);
        user.updateProfile(request.name(), request.phone());
        return UserResponse.from(user);
    }

    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        User user = findUserOrThrow(userId);

        if (!passwordEncoder.matches(request.currentPassword(),
                user.getPassword())) {
            throw new BusinessException(UserErrorCode.INVALID_PASSWORD);
        }
        user.changePassword(passwordEncoder.encode(request.newPassword()));
    }


    private User findUserOrThrow(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
    }
}
