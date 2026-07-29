package com.ticket.ticketflow.domain.performance.entity;

import com.ticket.ticketflow.global.common.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "performance")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Performance extends BaseTimeEntity {

    /**
     * 공연의 고유 식별자입니다.
     * <p>
     * DB 컬럼:
     * id BIGSERIAL PRIMARY KEY
     * <p>
     * BIGSERIAL은 PostgreSQL에서 시퀀스를 사용해 값을 자동 증가시키는 방식입니다.
     * GenerationType.IDENTITY를 사용하면 ID 생성을 DB에 위임합니다.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 공연이 진행되는 공연장입니다.
     * <p>
     * DB에서는 venue_id 외래 키 컬럼으로 저장되지만,
     * 객체에서는 Venue 엔티티 자체를 참조합니다.
     * <p>
     * 여러 공연이 하나의 공연장을 참조할 수 있으므로
     * 다대일 관계인 @ManyToOne을 사용합니다.
     */
    @ManyToOne(
            /*
             * 공연 정보를 조회할 때 공연장 정보까지 항상 즉시 조회하지 않고,
             * 실제로 venue 필드에 접근할 때 조회하도록 설정합니다.
             *
             * 불필요한 JOIN이나 추가 조회를 줄이기 위해
             * 일반적으로 연관관계는 LAZY 사용을 권장합니다.
             */
            fetch = FetchType.LAZY,

            /*
             * performance.venue_id가 NOT NULL이므로
             * Performance 객체에도 Venue가 반드시 존재해야 합니다.
             */
            optional = false
    )
    @JoinColumn(
            /*
             * performance 테이블에서 외래 키로 사용되는 실제 컬럼명입니다.
             */
            name = "venue_id",

            /*
             * DB의 venue_id NOT NULL 조건을 엔티티 매핑에도 표현합니다.
             */
            nullable = false,

            /*
             * JPA가 스키마를 생성하는 경우 사용될 외래 키 제약조건 이름입니다.
             *
             * Flyway를 사용하는 현재 프로젝트에서는 실제 외래 키 생성은
             * 마이그레이션 SQL이 담당합니다.
             */
            foreignKey = @ForeignKey(
                    name = "fk_performance_venue"
            )
    )
    private Venue venue;

    /**
     * 공연 제목입니다.
     *
     * DB 컬럼:
     * title VARCHAR(200) NOT NULL
     *
     * 예:
     * - 2026 월드투어 서울 콘서트
     * - 오페라의 유령
     * - 햄릿
     */
    @Column(
            name = "title",
            nullable = false,
            length = 200)
    private String title;

    /**
     * 공연에 대한 상세 설명입니다.
     *
     * DB 컬럼:
     * description TEXT
     *
     * 필수값이 아니므로 null이 허용됩니다.
     *
     * PostgreSQL의 TEXT 타입을 명확하게 나타내기 위해
     * columnDefinition을 지정했습니다.
     */
    @Column(
            name = "description",
            columnDefinition = "TEXT")
    private String description;

    /**
     * 공연 포스터 이미지의 URL입니다.
     *
     * DB 컬럼:
     * poster_image_url VARCHAR(500)
     *
     * 이미지 자체를 DB에 저장하는 것이 아니라,
     * S3 또는 CDN 등에 저장된 이미지 주소를 보관합니다.
     *
     * 예:
     * https://cdn.example.com/posters/performance-1001.jpg
     */
    @Column(
            name = "poster_image_url",
            length = 500)
    private String posterImageUrl;

    /**
     * 공연 장르입니다.
     *
     * Java에서는 PerformanceGenre enum으로 관리하지만
     * DB에는 enum의 이름을 문자열로 저장합니다.
     *
     * 저장 예:
     * PerformanceGenre.CONCERT -> "CONCERT"
     * PerformanceGenre.MUSICAL -> "MUSICAL"
     * PerformanceGenre.PLAY    -> "PLAY"
     *
     * DB의 CHECK 제약조건:
     * genre IN ('CONCERT', 'MUSICAL', 'PLAY')
     *
     * genre 컬럼에는 NOT NULL 조건이 없으므로 null이 허용됩니다.
     */
    @Enumerated(EnumType.STRING)
    @Column(
            name = "genre",
            length = 50)
    private PerformanceGenre genre;

    /**
     * 공연 러닝타임입니다.
     *
     * DB 컬럼:
     * running_time INTEGER
     *
     * 단위는 분입니다.
     *
     * 예:
     * 90  -> 1시간 30분
     * 120 -> 2시간
     * 150 -> 2시간 30분
     *
     * 아직 러닝타임이 확정되지 않은 공연을 고려하여
     * 기본형 int가 아닌 래퍼 타입 Integer를 사용합니다.
     *
     * Integer는 null을 표현할 수 있지만 int는 null을 표현할 수 없습니다.
     */
    @Column(name = "running_time")
    private Integer runningTime;

    /**
     * 공연의 현재 운영 상태입니다.
     *
     * DB 컬럼:
     * status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED'
     *
     * Java enum 값을 DB 문자열로 저장하기 위해
     * EnumType.STRING을 사용합니다.
     *
     * 저장 가능한 값:
     * - SCHEDULED: 공연 예정 또는 판매 준비
     * - ON_SALE: 티켓 판매 중
     * - CLOSED: 판매 또는 공연 종료
     */
    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            length = 20
    )
    private PerformanceStatus status = PerformanceStatus.SCHEDULED;

    private Performance(
            Venue venue,
            String title,
            String description,
            String posterImageUrl,
            PerformanceGenre genre,
            Integer runningTime,
            PerformanceStatus status)
    {
        this.venue = venue;
        this.title = title;
        this.description = description;
        this.posterImageUrl = posterImageUrl;
        this.genre = genre;
        this.runningTime = runningTime;
        this.status = status;
    }

    public static Performance create(
            Venue venue,
            String title,
            String description,
            String posterImageUrl,
            PerformanceGenre genre,
            Integer runningTime,
            PerformanceStatus status)
    {
        return new Performance(
                venue,
                title,
                description,
                posterImageUrl,
                genre,
                runningTime,
                status);
    }
}
