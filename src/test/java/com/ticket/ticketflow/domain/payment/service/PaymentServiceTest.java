package com.ticket.ticketflow.domain.payment.service;

import com.ticket.ticketflow.domain.payment.dto.PaymentResult;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

public class PaymentServiceTest {

    private final PaymentService paymentService = new PaymentService();

    @Test
    void 실패_금액이_아니면_결제에_성공한다() {
        // given
        Long bookingId = 1L;
        int amount = 10000;

        // when
        PaymentResult result = paymentService.pay(bookingId, amount);

        // then
        assertThat(result.success()).isTrue();
        assertThat(result.transactionId()).isNotNull();
        assertThat(result.paidAt()).isNotNull();
    }

    @Test
    void 금액이_1313_이면_결제에_실패한다() {
        // given
        Long bookingId = 1L;
        int amount = 1313;

        // when
        PaymentResult result = paymentService.pay(bookingId, amount);

        // then
        assertThat(result.success()).isFalse();
    }
}
