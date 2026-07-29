package com.ticket.ticketflow.domain.performance.entity;

import com.ticket.ticketflow.global.common.BaseCreatedEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Entity
@Table(
        name = "session",
        uniqueConstraints = {
                /*
                 * 하나의 공연에 동일한 공연 시작 시각을 가진 회차가
                 * 중복 등록되는 것을 방지합니다.
                 *
                 * DB 제약조건:
                 * CONSTRAINT uq_session
                 * UNIQUE (performance_id, session_at)
                 */
                @UniqueConstraint(
                        name = "uq_session",
                        columnNames = {
                                "performance_id",
                                "session_at"
                        }
                )
        },
        indexes = {
                /*
                 * 예매 오픈 예정 회차를 조회할 때 사용하는 인덱스입니다.
                 *
                 * 예:
                 * SELECT *
                 * FROM session
                 * WHERE booking_open_at <= now();
                 *
                 * 가상 대기실 활성화, 예매 오픈 스케줄러 또는 배치 작업에서
                 * booking_open_at을 기준으로 회차를 조회할 때 활용됩니다.
                 */
                @Index(
                        name = "idx_session_booking_open_at",
                        columnList = "booking_open_at"
                )
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PerformanceSession extends BaseCreatedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "performance_id",
            nullable = false,
            updatable = false,
            foreignKey = @ForeignKey(
                    name = "fk_session_performance"
            )
    )
    private Performance performance;

    @Column(
            name = "session_at",
            nullable = false
    )
    private OffsetDateTime sessionAt;

    @Column(
            name = "booking_open_at",
            nullable = false
    )
    private OffsetDateTime bookingOpenAt;

    @Column(
            name = "booking_close_at",
            nullable = false
    )
    private OffsetDateTime bookingCloseAt;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 20
    )
    private PerformanceSessionStatus status = PerformanceSessionStatus.SCHEDULED;

    private PerformanceSession(Performance performance,
                              OffsetDateTime sessionAt,
                              OffsetDateTime bookingOpenAt,
                              OffsetDateTime bookingCloseAt) {
        this.performance = performance;
        this.sessionAt = sessionAt;
        this.bookingOpenAt = bookingOpenAt;
        this.bookingCloseAt = bookingCloseAt;
        this.status = PerformanceSessionStatus.SCHEDULED;
    }

    /***
     * 공연장 정보를 생성하는 정적 팩토리 메소드 입니다.
     */
    public static PerformanceSession create(Performance performance,
                                            OffsetDateTime sessionAt,
                                            OffsetDateTime bookingOpenAt,
                                            OffsetDateTime bookingCloseAt) {

        return new PerformanceSession(performance, sessionAt, bookingOpenAt, bookingCloseAt);
    }

    //    CREATE TABLE session
//    (
//                    id               BIGSERIAL PRIMARY KEY,
//                    performance_id   BIGINT      NOT NULL,
//                    session_at       TIMESTAMPTZ NOT NULL, -- 공연 시작 시각
//                            booking_open_at  TIMESTAMPTZ NOT NULL, -- 예매 오픈 시각
//                            booking_close_at TIMESTAMPTZ NOT NULL, -- 예매 마감 시각
//                            status           VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
//    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
//    CONSTRAINT fk_session_performance FOREIGN KEY (performance_id) REFERENCES performance (id),
//    CONSTRAINT uq_session UNIQUE (performance_id, session_at),
//    CONSTRAINT ck_session_status CHECK (status IN ('SCHEDULED', 'ON_SALE', 'SOLD_OUT', 'CLOSED')),
//    CONSTRAINT ck_session_booking_period CHECK (booking_close_at > booking_open_at)
//    );
//    CREATE INDEX idx_session_booking_open_at ON session (booking_open_at);
}
