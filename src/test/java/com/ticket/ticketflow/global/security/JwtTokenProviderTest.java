package com.ticket.ticketflow.global.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JwtTokenProviderTest {

    // application-local.yml의 jwt.secret과 형식(Base64)만 맞으면 아무값이나 통과
    // HS256은 최소 32바이트가 필요하므로 짧으면 WeakKeyException이 난다
    private static final String SECRET = "MNRvGm9y/T3m0GyGQ8M9CSRfA1tvvSx/pRainCyI0Mc=";

    private final JwtTokenProvider tokenProvider = new JwtTokenProvider(SECRET, 1_800_00L); // 30분

    @Test
    void 토큰을_생성하면_userId_email_role_클레임을_그대로_복원할_수_있다() {
        // given
        Long userId = 1L;
        String email = "test.test.com";
        String role = "USER";

        // when
        String token = tokenProvider.createToken(userId, email, role);

        // then
        assertThat(tokenProvider.validateToken(token)).isTrue();
        assertThat(tokenProvider.getUserId(token)).isEqualTo(userId);
        assertThat(tokenProvider.getEmail(token)).isEqualTo(email);
        assertThat(tokenProvider.getRole(token)).isEqualTo(role);
    }

    @Test
    void 만료된_토큰은_검증에_실패한다() throws InterruptedException {
        // given: 유효기간을 1ms로 만들어서 강제로 만료시킨다
        JwtTokenProvider shortLivedProvider = new JwtTokenProvider(SECRET, 1L);
        String token = shortLivedProvider.createToken(1L, "test@test.com", "USER");
        Thread.sleep(10); // 1ms보다 확실하게 뒤로 밀기

        // when & then
        assertThat(shortLivedProvider.validateToken(token)).isFalse();
    }

    @Test
    void 변조된_토큰은_검증에_실패한다() {
        // given
        String token = tokenProvider.createToken(1L, "test@test.com", "USER");
        String tampered = token.substring(0, token.length() - 1) + "x"; // 마지막 글자를 조작

        // when & then
        assertThat(tokenProvider.validateToken(tampered)).isFalse();
    }


}
