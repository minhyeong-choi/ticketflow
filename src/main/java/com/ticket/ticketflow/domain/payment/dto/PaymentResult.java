package com.ticket.ticketflow.domain.payment.dto;

import java.time.OffsetDateTime;

public record PaymentResult (boolean success, String transactionId,OffsetDateTime paidAt){
}
