package com.ticket.ticketflow.domain.payment.service;

import com.ticket.ticketflow.domain.payment.dto.PaymentResult;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class PaymentService {

    private static final int FAILURE_TEST_AMOUNT = 1313;

    public PaymentResult pay(Long bookingId, int amount) {
        if (amount == FAILURE_TEST_AMOUNT) {
            return new PaymentResult(false, null, null);
        }
        return new PaymentResult(true, UUID.randomUUID().toString(), OffsetDateTime.now());
    }
}
