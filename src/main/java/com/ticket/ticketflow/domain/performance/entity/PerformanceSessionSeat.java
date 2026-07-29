package com.ticket.ticketflow.domain.performance.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.Objects;

@Entity
@Table(
        name = "session_seat",
        uniqueConstraints = {
                /*
                 * 동일한 회차에 동일한 물리 좌석이
                 * 두 번 생성되는 것을 방지합니다.
                 *
                 * DB 제약조건:
                 * CONSTRAINT uq_session_seat
                 * UNIQUE (session_id, venue_seat_id)
                 */
                @UniqueConstraint(
                        name = "uq_session_seat",
                        columnNames = {
                                "session_id",
                                "venue_seat_id"
                        }
                )
        },
        indexes = {
                /*
                 * 특정 회차의 판매 가능 좌석을 조회할 때 사용하는
                 * 복합 인덱스입니다.
                 *
                 * 예:
                 * SELECT *
                 * FROM session_seat
                 * WHERE session_id = ?
                 *   AND status = 'AVAILABLE';
                 */
                @Index(
                        name = "idx_session_seat_lookup",
                        columnList = "session_id, status"
                )
        }
)
@Getter
@NoArgsConstructor(
        access = AccessLevel.PROTECTED
)
public class PerformanceSessionSeat {

    /**
     * 회차별 판매 좌석의 고유 식별자입니다.
     *
     * DB 컬럼:
     * id BIGSERIAL PRIMARY KEY
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 해당 좌석이 판매되는 공연 회차입니다.
     *
     * 하나의 회차에는 여러 판매 좌석이 존재하므로
     * 다대일 관계로 설정합니다.
     *
     * DB 컬럼:
     * session_id BIGINT NOT NULL
     */
    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "session_id",
            nullable = false,
            updatable = false,
            foreignKey = @ForeignKey(
                    name = "fk_session_seat_session"
            )
    )
    private PerformanceSession performanceSession;

    /**
     * 공연장에 물리적으로 배치된 좌석입니다.
     *
     * VenueSeat는 좌석의 위치 정보를 관리합니다.
     *
     * 예:
     * - 구역
     * - 열
     * - 좌석 번호
     * - 화면 배치 좌표
     *
     * DB 컬럼:
     * venue_seat_id BIGINT NOT NULL
     */
    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "venue_seat_id",
            nullable = false,
            updatable = false,
            foreignKey = @ForeignKey(
                    name = "fk_session_seat_venue_seat"
            )
    )
    private VenueSeat venueSeat;

    /**
     * 해당 회차에서 적용되는 좌석 등급입니다.
     *
     * 같은 물리 좌석이라도 공연이나 회차에 따라
     * 서로 다른 좌석 등급 및 가격 정책이 적용될 수 있습니다.
     *
     * 예:
     * - 특정 공연에서는 VIP석
     * - 다른 공연에서는 R석
     *
     * DB 컬럼:
     * seat_grade_id BIGINT NOT NULL
     */
    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "seat_grade_id",
            nullable = false,
            updatable = false,
            foreignKey = @ForeignKey(
                    name = "fk_session_seat_grade"
            )
    )
    private SeatGrade seatGrade;

    /**
     * 회차별 좌석의 영구적인 판매 상태입니다.
     *
     * DB 컬럼:
     * status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
     *
     * 저장 가능한 값:
     * - AVAILABLE: 판매 가능
     * - SOLD: 판매 완료
     *
     * HELD 상태를 DB에서 관리하지 않는 이유:
     *
     * 사용자가 좌석을 선택하고 결제를 진행하는 동안의 임시 선점은
     * Redis TTL 락이 담당합니다.
     *
     * Redis:
     * - 임시 좌석 선점
     * - TTL 만료
     * - 결제 진행 중 상태
     *
     * DB:
     * - 최종 판매 완료 여부
     *
     * 따라서 임시 상태는 Redis에서 관리하고,
     * 영구적으로 확정된 상태만 DB에 저장합니다.
     */
    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 20
    )
    private PerformanceSessionSeatStatus status;

    /**
     * 새로운 회차별 판매 좌석을 생성합니다.
     */
    private PerformanceSessionSeat(
            PerformanceSession performanceSession,
            VenueSeat venueSeat,
            SeatGrade seatGrade
    ) {
        this.performanceSession = Objects.requireNonNull(
          performanceSession,
          "공연 회차는 필수입니다."
        );

        this.venueSeat = Objects.requireNonNull(
            venueSeat,
            "공연장 좌석은 필수입니다."
        );

        this.seatGrade = Objects.requireNonNull(
          seatGrade,
          "공연장 좌석등급은 필수입니다."
        );

        this.status = PerformanceSessionSeatStatus.AVAILABLE;
    }

    /**
     * 회차별 판매 좌석을 생성하는 정적 팩토리 메서드입니다.
     *
     * 사용 예:
     *
     * PerformanceSessionSeat sessionSeat = PerformanceSessionSeat.create(
     *         performanceSession,
     *         venueSeat,
     *         seatGrade
     * );
     */
    public static PerformanceSessionSeat create(
            PerformanceSession performanceSession,
            VenueSeat venueSeat,
            SeatGrade seatGrade
    ){
        return new PerformanceSessionSeat(performanceSession, venueSeat, seatGrade);
    }

    //
//    CREATE TABLE session_seat
//            (
//                    id            BIGSERIAL PRIMARY KEY,
//                    session_id    BIGINT      NOT NULL,
//                    venue_seat_id BIGINT      NOT NULL,
//                    seat_grade_id BIGINT      NOT NULL,
//                    status        VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
//    CONSTRAINT fk_session_seat_session FOREIGN KEY (session_id) REFERENCES session (id),
//    CONSTRAINT fk_session_seat_venue_seat FOREIGN KEY (venue_seat_id) REFERENCES venue_seat (id),
//    CONSTRAINT fk_session_seat_grade FOREIGN KEY (seat_grade_id) REFERENCES seat_grade (id),
//    CONSTRAINT uq_session_seat UNIQUE (session_id, venue_seat_id),
//    CONSTRAINT ck_session_seat_status CHECK (status IN ('AVAILABLE', 'SOLD'))
//            );
//-- 좌석 배치도 조회(특정 회차의 잔여석) 전용 인덱스
//    CREATE INDEX idx_session_seat_lookup ON session_seat (session_id, status);
}
