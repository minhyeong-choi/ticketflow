package com.ticket.ticketflow.domain.booking.entity;


import com.ticket.ticketflow.global.common.BaseCreatedEntity;
import jakarta.persistence.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "booking")
public class Booking extends BaseCreatedEntity {

    @Column(name = "booking_number", nullable = false, length = 30)
    private String bookingNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BookingStatus status;

    @Column(name = "booked_at")
    private OffsetDateTime bookedAt;

    @Column(name = "cancelled_at")
    private OffsetDateTime cancelledAt;

    // 7~8주차에 쓸 상태 전이 메서드
    public void confirm() {
        this.status = BookingStatus.CONFIRMED;
        this.bookedAt = OffsetDateTime.now();
    }

    public void cancel() {
        this.status = BookingStatus.CANCELLED;
        this.cancelledAt = OffsetDateTime.now();
    }
}
