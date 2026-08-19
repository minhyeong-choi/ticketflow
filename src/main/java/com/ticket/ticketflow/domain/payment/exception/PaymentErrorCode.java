package com.ticket.ticketflow.domain.payment.exception;

import com.ticket.ticketflow.global.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum PaymentErrorCode implements ErrorCode {
    PAYMENT_FAILED("PAYMENT_001", HttpStatus.PAYMENT_REQUIRED, "결제에 실패했습니다");

    private final String code;
    private final HttpStatus httpStatus;
    private final String message;
}
