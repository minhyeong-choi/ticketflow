package com.ticket.ticketflow.domain.user.service;

import com.ticket.ticketflow.domain.user.dto.LoginRequest;
import com.ticket.ticketflow.domain.user.dto.SignupRequest;
import com.ticket.ticketflow.domain.user.dto.TokenResponse;
import com.ticket.ticketflow.domain.user.entity.Role;
import com.ticket.ticketflow.domain.user.entity.User;
import com.ticket.ticketflow.domain.user.exception.UserErrorCode;
import com.ticket.ticketflow.domain.user.repository.UserRepository;
import com.ticket.ticketflow.global.exception.BusinessException;
import com.ticket.ticketflow.global.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Transactional
    public void signup(SignupRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BusinessException(UserErrorCode.DUPLICATE_EMAIL);
        }

        User user = User.builder()
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .name(request.name())
                .role(Role.USER)
                .build();
        userRepository.save(user);
    }

    public TokenResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new BusinessException(UserErrorCode.INVALID_CREDENTIALS));
        if(!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new BusinessException(UserErrorCode.INVALID_CREDENTIALS);
        }

        String token = jwtTokenProvider.createToken(user.getId(),
                user.getEmail(), user.getRole().name());
        return new TokenResponse(token);
    }
}
