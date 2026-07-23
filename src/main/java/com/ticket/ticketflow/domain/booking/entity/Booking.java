package com.ticket.ticketflow.domain.booking.entity;

import com.ticket.ticketflow.domain.user.entity.User;
import com.ticket.ticketflow.global.common.BaseCreatedEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Entity
@Table(name = "booking")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Booking extends BaseCreatedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "booking_number", nullable = false, length = 30)
    private String bookingNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // TODO: PerformanceSession 엔티티 생성 후 @ManyToOne(fetch = LAZY) @JoinColumn(name = "session_id")로 교체
    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "total_amount", nullable = false)
    private Integer totalAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BookingStatus status;

    @Column(name = "booked_at")
    private OffsetDateTime bookedAt;

    @Column(name = "cancelled_at")
    private OffsetDateTime cancelledAt;

    @Builder
    private Booking(String bookingNumber, User user, Long sessionId, Integer totalAmount) {
        this.bookingNumber = bookingNumber;
        this.user = user;
        this.sessionId = sessionId;
        this.totalAmount = totalAmount;
        this.status = BookingStatus.PENDING;
    }

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
