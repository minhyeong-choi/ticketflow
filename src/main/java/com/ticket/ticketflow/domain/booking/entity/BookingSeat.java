package com.ticket.ticketflow.domain.booking.entity;

import com.ticket.ticketflow.domain.performance.entity.PerformanceSession;
import com.ticket.ticketflow.domain.performance.entity.PerformanceSessionSeat;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@Table(name="booking_seat")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BookingSeat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "booking_id",
            nullable = false,
            updatable = false,
            foreignKey = @ForeignKey(
                    name = "fk_booking_seat_booking"
            )
    )
    private Booking booking;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "session_seat_id",
            nullable = false,
            updatable = false,
            foreignKey = @ForeignKey(
                    name = "fk_booking_seat_session_seat"
            )
    )
    private PerformanceSessionSeat performanceSessionSeat;

    @Column(
            name = "price",
            nullable = false
    )
    private Integer price;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 20
    )
    private BookingSeatStatus status;

    private BookingSeat(
            Booking booking,
            PerformanceSessionSeat performanceSessionSeat,
            Integer price) {
        this.booking = booking;
        this.performanceSessionSeat = performanceSessionSeat;
        this.price = price;
        this.status = BookingSeatStatus.ACTIVE;
    }

    public static BookingSeat create (
            Booking booking,
            PerformanceSessionSeat performanceSessionSeat,
            Integer price) {
        return new BookingSeat(
                booking,
                performanceSessionSeat,
                price
        );
    }

    //    id              BIGSERIAL PRIMARY KEY,
//    booking_id      BIGINT      NOT NULL,
//    session_seat_id BIGINT      NOT NULL,
//    price           INTEGER     NOT NULL, -- 예매 시점 가격 스냅샷
//    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
//    CONSTRAINT fk_booking_seat_booking FOREIGN KEY (booking_id) REFERENCES booking (id),
//    CONSTRAINT fk_booking_seat_session_seat FOREIGN KEY (session_seat_id) REFERENCES session_seat (id),
//    CONSTRAINT ck_booking_seat_status CHECK (status IN ('ACTIVE', 'CANCELLED')),
//    CONSTRAINT ck_booking_seat_price CHECK (price >= 0)/**/
}
