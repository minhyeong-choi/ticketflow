package com.ticket.ticketflow.global.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum CommonErrorCode implements  ErrorCode{
    INVALID_INPUT("COMMON_001", HttpStatus.BAD_REQUEST, "잘못된 입력입니다."),
    // 토큰이 없거나 유효하지 않을 때
    UNAUTHORIZED("COMMON_002", HttpStatus.UNAUTHORIZED, "인증이 필요합니다."),
    // 로그인은 했지만 권한이 없을 때
    FORBIDDEN("COMMON_003", HttpStatus.FORBIDDEN, "접근 권한이 없습니다."),
    // 예상 못 한 에러가 났을 때
    INTERNAL_ERROR("COMMON_004", HttpStatus.INTERNAL_SERVER_ERROR, "서버 내부 오류가 발생했습니다.");


    private final String code;
    private final HttpStatus httpStatus;
    private final String message;
}
