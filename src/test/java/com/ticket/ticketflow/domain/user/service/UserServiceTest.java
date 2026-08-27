package com.ticket.ticketflow.domain.user.service;

import com.ticket.ticketflow.domain.user.dto.ChangePasswordRequest;
import com.ticket.ticketflow.domain.user.dto.SignupRequest;
import com.ticket.ticketflow.domain.user.dto.UpdateProfileRequest;
import com.ticket.ticketflow.domain.user.dto.UserResponse;
import com.ticket.ticketflow.domain.user.entity.User;
import com.ticket.ticketflow.domain.user.exception.UserErrorCode;
import com.ticket.ticketflow.domain.user.repository.UserRepository;
import com.ticket.ticketflow.global.exception.BusinessException;
import com.ticket.ticketflow.support.IntegrationTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.*;

@Transactional
class UserServiceTest extends IntegrationTestSupport {

    @Autowired
    private UserService userService;
    @Autowired
    private AuthService authService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private Long signupAndGetUserId(String email) {
        authService.signup(new SignupRequest(email, "password1", "원래이름"));
        return userRepository.findByEmail(email).orElseThrow().getId();
    }

    @Test
    void 프로필을_수정하면_이름과_전화번호가_바뀐다() {
        // given
        Long userId = signupAndGetUserId("profile@test.com");

        // when
        UserResponse response = userService.updateProfile(userId, new UpdateProfileRequest("새이름", "010-1234-5678"));

        // then
        assertThat(response.name()).isEqualTo("새이름");
        assertThat(response.phone()).isEqualTo("010-1234-5678");
    }

    @Test
    void 현재_비밀번호가_일치하면_비밀번호가_변경된다() {
        // given
        Long userId = signupAndGetUserId("changepw@test.com");

        // when
        userService.changePassword(userId, new ChangePasswordRequest("password1", "newpassword1"));

        // then : DB에서 다시 읽어와 새 비밀번호로 BCrypt 매칭이 되는지 확인
        User user = userRepository.findById(userId).orElseThrow();
        assertThat(passwordEncoder.matches("newpassword1", user.getPassword())).isTrue();
    }

    @Test
    void 현재_비밀번호가_틀리면_INVALID_PASSWORD_예외가_발생한다() {
        // given
        Long userId = signupAndGetUserId("wrongcurrent@test.com");

        // when & then
        assertThatThrownBy(() -> userService.changePassword(userId,
                new ChangePasswordRequest("wrongpassword", "newpassword1")))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getErrorCode())
                        .isEqualTo(UserErrorCode.INVALID_PASSWORD));
    }
}
