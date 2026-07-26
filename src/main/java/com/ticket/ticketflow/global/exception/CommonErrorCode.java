package com.ticket.ticketflow.global.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum CommonErrorCode implements  ErrorCode{
    INVALID_INPUT("COMMON_001", HttpStatus.BAD_REQUEST, "잘못된 입력입니다.");

    private final String code;
    private final HttpStatus httpStatus;
    private final String message;
}
