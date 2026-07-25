package com.ticket.ticketflow.domain.performance.entity;

import com.ticket.ticketflow.global.common.BaseCreatedEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "venue")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Venue extends BaseCreatedEntity {

    /**
     * Venue PK
     * PostgreSQL의 BIGSERIAL 타입은 Java의 Long으로 매핑할 수 있음.
     * 자동 증가 처리
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 공연장 이름
     * 예 : 올림픽 경기장
     */
    @Column(name = "name", nullable = false, length = 200)
    private String name;

    /**
     * 공연장 주소
     * DB에서 NULL을 허용하므로 nullable 속성은 생략합니다.
     */
    @Column(name = "address", length = 300)
    private String address;

    /**
     * 공연장 전체 좌석 수
     *
     * 좌석 테이블을 매번 COUNT하지 않고
     * 공연장 목록 등에 빠르게 표시하기 위한 캐시값입니다.
     */
    @Column(name = "total_seat_count", nullable = false)
    private int totalSeatCount = 0;

    private Venue(String name, String address, int totalSeatCount) {
        this.name = name;
        this.address = address;
        this.totalSeatCount = totalSeatCount;
    }

    /**
     * Venue 객체 생성을 위한 팩토리 메서드
     * 객체가 아직 존재하지 않아도 클래스 이름으로 생성 메서드를 호출하기 위해서 static메소드로 생성.
     */
    public static Venue create(
            String name,
            String address,
            int totalSeatCount
    ){
        return new Venue(
                name,
                address,
                totalSeatCount);
    }

    // 남은 것
    // 업데이트 메서드
    // 업데이트 시 정합성 체크 (Validation)
}
