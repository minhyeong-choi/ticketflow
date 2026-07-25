package com.ticket.ticketflow.domain.payment.entity;

import com.ticket.ticketflow.domain.booking.entity.Booking;
import com.ticket.ticketflow.global.common.BaseCreatedEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Entity
@Table(name = "payment")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Payment extends BaseCreatedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @Column(name = "amount", nullable = false)
    private Integer amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentStatus status;

    @Column(name = "pg_provider", nullable = false, length = 20)
    private String pgProvider;

    @Column(name = "transaction_id", length = 100)
    private String transactionId;

    @Column(name = "paid_at")
    private OffsetDateTime paidAt;

    @Builder
    private Payment(Booking booking, Integer amount, PaymentStatus status, String pgProvider, String transactionId, OffsetDateTime paidAt) {
        this.booking = booking;
        this.amount = amount;
        this.status = status;
        this.pgProvider = (pgProvider != null) ? pgProvider : "MOCK";  // 여기서 기본값 처리
        this.transactionId = transactionId;
        this.paidAt = paidAt;
    }
}
