package com.ticket.ticketflow.domain.user.service;

import com.ticket.ticketflow.domain.user.dto.LoginRequest;
import com.ticket.ticketflow.domain.user.dto.SignupRequest;
import com.ticket.ticketflow.domain.user.dto.TokenResponse;
import com.ticket.ticketflow.domain.user.exception.UserErrorCode;
import com.ticket.ticketflow.global.exception.BusinessException;
import com.ticket.ticketflow.support.IntegrationTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Transactional
class AuthServiceTest extends IntegrationTestSupport {
    @Autowired
    private AuthService authService;

    @Test
    void 회원가입에_성공하면_예외없이_끝난다() {
        // given
        SignupRequest request = new SignupRequest("new@test.com", "password1", "홍길동");
        // when & then (예외가 안 던져지면 성공)
        authService.signup(request);
    }

    @Test
    void 이미_가입된_이메일로_회원가입하면_DUPLICATE_EMAIL_예외가_발생한다() {
        // given: 먼저 한 번 가입시킨다
        SignupRequest request = new SignupRequest("dup@test.com", "password1", "홍길동");
        authService.signup(request);

        // when & then: 같은 이메일로 다시 가입 시도
        assertThatThrownBy(() -> authService.signup(request))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getErrorCode())
                        .isEqualTo(UserErrorCode.DUPLICATE_EMAIL));
    }

    @Test
    void 로그인에_성공하면_토큰이_발급된다() {
        // given
        authService.signup(new SignupRequest("login@test.com", "password1", "홍길동"));

        // when
        TokenResponse response = authService.login(new LoginRequest("login@test.com", "password1"));

        // then
        assertThat(response.accessToken()).isNotBlank();
    }

    @Test
    void 비밀번호가_틀리면_INVALID_CREDENTIALS_예외가_발생한다() {
        // given
        authService.signup(new SignupRequest("wrongpw@test.com", "password1", "홍길동"));

        // when & then
        assertThatThrownBy(() -> authService.login(new LoginRequest("wrongpw@test.com", "wrongpassword")))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getErrorCode())
                        .isEqualTo(UserErrorCode.INVALID_CREDENTIALS));
    }

    @Test
    void 존재하지_않는_이메일로_로그인하면_INVALID_CREDENTIALS_예외가_발생한다() {
        // when & then
        assertThatThrownBy(() -> authService.login(new LoginRequest("nobody@test.com", "password1")))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getErrorCode())
                        .isEqualTo(UserErrorCode.INVALID_CREDENTIALS));
    }
}
