package com.ticket.ticketflow.domain.user.exception;

import com.ticket.ticketflow.global.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum UserErrorCode implements ErrorCode {
    DUPLICATE_EMAIL("USER_001", HttpStatus.CONFLICT, "이미 가입된 이메일입니다."),
    INVALID_CREDENTIALS("USER_002", HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다.");

    private final String code;
    private final HttpStatus httpStatus;
    private final String message;
}
