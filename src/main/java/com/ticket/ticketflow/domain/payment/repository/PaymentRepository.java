package com.ticket.ticketflow.domain.payment.repository;

import com.ticket.ticketflow.domain.payment.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
}
