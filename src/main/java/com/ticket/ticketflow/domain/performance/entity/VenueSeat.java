package com.ticket.ticketflow.domain.performance.entity;

import com.ticket.ticketflow.global.common.BaseCreatedEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "venue_seat")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VenueSeat {

    /**
     * venue_seat PK
     * PostgreSQL의 BIGSERIAL 타입은 Java의 Long으로 매핑할 수 있음.
     * 자동 증가 처리
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 공연장 (venue) 테이블의 id
     * 공연장 (venue) : 공연장 좌석 (venue_seat) => 1 : N  (관계)
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "venue_id", // venue_seat 테이블의 실제 DB 컬럼 명
            referencedColumnName = "id", // 참조할 venue 테이블의 실제 DB의 컬럼명
            nullable = false,  // Null을 허용하지 않음
            insertable = true, // INSERT 문에 추가
            updatable = false, // UPDATE 문에서 제거 (수정 불가)
            foreignKey = @ForeignKey(name = "fk_venue_seat_venue")
    )
    private Venue venue;

    /**
     * 공연장 내의 좌석 구역
     */
    @Column(name = "section", nullable = false, length = 20)
    private String section;

    /**
     * 공연장 내의 좌석 열의 구역
     */
    @Column(
            name = "row_label",
            nullable = false,
            updatable = false,
            length = 10)
    private String rowLabel;

    /**
     * 공연장 내의 좌석 번호
     */
    @Column(
            name = "seat_number",
            nullable = false,
            length = 10)
    private String seatNumber;

    /**
     * 프론트엔드 좌석 배치도에서 사용하는 X축 좌표입니다.
     *
     * 아직 좌석 배치가 완료되지 않은 경우에는
     * NULL이 될 수 있으므로 Integer 타입을 사용합니다.
     */
    @Column(name = "pos_x")
    private Integer posX;

    /**
     * 프론트엔드 좌석 배치도에서 사용하는 Y축 좌표입니다.
     *
     * 아직 좌석 배치가 완료되지 않은 경우에는
     * NULL이 될 수 있으므로 Integer 타입을 사용합니다.
     */
    @Column(name = "pos_y")
    private Integer posY;

    private VenueSeat(
            Venue venue,
            String section,
            String rowLabel,
            String seatNumber,
            Integer posX,
            Integer posY) {
        this.venue = venue;
        this.section = section;
        this.rowLabel = rowLabel;
        this.seatNumber = seatNumber;
        this.posX = posX;
        this.posY = posY;
    }

    /**
     * VenueSeat 객체 생성을 위한 팩토리 메서드
     * 객체가 아직 존재하지 않아도 클래스 이름으로 생성 메서드를 호출하기 위해서 static메소드로 생성.
     */
    public static VenueSeat create(
            Venue venue,
            String section,
            String rowLabel,
            String seatNumber,
            Integer posX,
            Integer posY) {

        return new VenueSeat(
                venue,
                section,
                rowLabel,
                seatNumber,
                posX,
                posY);
    }
}
