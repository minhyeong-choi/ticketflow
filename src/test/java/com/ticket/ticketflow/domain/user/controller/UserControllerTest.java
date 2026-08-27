package com.ticket.ticketflow.domain.user.controller;

import com.ticket.ticketflow.domain.user.dto.LoginRequest;
import com.ticket.ticketflow.domain.user.dto.SignupRequest;
import com.ticket.ticketflow.domain.user.service.AuthService;
import com.ticket.ticketflow.support.IntegrationTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@AutoConfigureMockMvc
@Transactional
class UserControllerTest extends IntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private AuthService authService;

    @Test
    void 토큰없이_내_정보를_조회하면_401과_JSON_에러바디를_반환한다() throws Exception {
        mockMvc.perform(get("/api/users/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void 유효한_토큰으로_내_정보를_조회하면_본인_정보가_반환된다() throws Exception {
        // given : 실제 서비스 로직으로 가입/로그인해서 진짜 토큰을 만든다
        authService.signup(new SignupRequest("mvc@test.com", "password1", "테스트"));
        String token = authService.login(new LoginRequest("mvc@test.com", "password1")).accessToken();

        // when & then
        mockMvc.perform(get("/api/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value("mvc@test.com"))
                .andExpect(jsonPath("$.data.name").value("테스트"));
    }
}
