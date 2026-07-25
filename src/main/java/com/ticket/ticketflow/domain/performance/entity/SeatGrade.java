package com.ticket.ticketflow.domain.performance.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "seat_grade",
        /*
         * 동일한 공연 안에서는 같은 좌석 등급 이름을
         * 중복으로 등록할 수 없도록 설정합니다.
         *
         * 예:
         *
         * performance_id = 1, name = VIP  → 등록 가능
         * performance_id = 1, name = R    → 등록 가능
         * performance_id = 1, name = VIP  → 중복이므로 등록 불가
         * performance_id = 2, name = VIP  → 다른 공연이므로 등록 가능
         *
         * DB의 다음 제약조건과 대응됩니다.
         *
         * CONSTRAINT uq_seat_grade
         *     UNIQUE (performance_id, name)
         */
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_seat_grade",
                        columnNames = {
                                "performance_id",
                                "name"
                        }
                )
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SeatGrade {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /*
     * 이 좌석 등급이 속한 공연입니다.
     *
             * 하나의 공연에는 VIP, R, S, A 등 여러 좌석 등급이 존재할 수 있으므로
     * SeatGrade 입장에서는 다대일 관계입니다.
            *
            * SeatGrade N : 1 Performance
     */
    @NotNull
    @ManyToOne(
            /*
             * 좌석 등급을 조회할 때 공연 정보까지 항상 즉시 조회하지 않고,
             * 실제 performance 필드에 접근할 때 공연 정보를 조회합니다.
             *
             * 불필요한 JOIN이나 추가 조회를 줄이기 위해
             * 연관관계는 기본적으로 LAZY 사용을 권장합니다.
             */
            fetch = FetchType.LAZY,

            /*
             * performance_id가 NOT NULL이므로
             * SeatGrade는 반드시 하나의 Performance에 소속되어야 합니다.
             */
            optional = false
    )
    @JoinColumn(
            /*
             * seat_grade 테이블에서 외래 키로 사용하는 실제 컬럼명입니다.
             */
            name = "performance_id",

            /*
             * DB의 NOT NULL 조건을 JPA 매핑에도 명시합니다.
             */
            nullable = false,

            /*
             * 좌석 등급이 생성된 이후 다른 공연으로 이동하는 것을 막습니다.
             *
             * 예를 들어 공연 1의 VIP 등급을 공연 2로 옮기는 것보다는,
             * 공연 1의 등급을 삭제하고 공연 2에 새 등급을 생성하는 것이
             * 도메인 의미상 더 자연스럽습니다.
             */
            updatable = false,

            /*
             * DB 외래 키 제약조건 이름과 동일하게 지정합니다.
             *
             * 실제 테이블 생성과 제약조건 관리는 Flyway가 담당합니다.
             */
            foreignKey = @ForeignKey(
                    name = "fk_seat_grade_performance"
            )
    )
    private Performance performance;

    @Column(
            name = "name",
            nullable = false,
            length = 20)
    private String name;

    @Column(
            name = "price",
            nullable = false)
    private Integer price;

    private SeatGrade(Performance performance, String name, Integer price) {
        this.performance = performance;
        this.name = name;
        this.price = price;
    }

    public static SeatGrade create(
            Performance performance,
            String name,
            Integer price)
    {
        return new SeatGrade(
                performance,
                name,
                price);
    }
}
