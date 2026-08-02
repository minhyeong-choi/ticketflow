package com.ticket.ticketflow.domain.performance.support;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * 테스트 데이터 생성을 위한 클래스
 */
@Slf4j
@Component
@Profile("local") //local일 경우만 해당 클래스를 빈으로 등록.
@RequiredArgsConstructor //클래스 안의 private final 필드들을 파라미터로 받는 생성자를 자동으로 생성.
public class SeedDataRunner implements CommandLineRunner {

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        Integer count = jdbc.queryForObject("SELECT count(*) FROM venue", Integer.class);

        if(count != null && count > 0) {
            log.info("시드 데이터가 이미 존재하여 생성을 건너뜁니다.");
            return;
        }

        //step2
        seedVenueAndSeats();
        //step3
        seedPerformances();
        //step4
        seedSessionSeats();
        //step5
        seedAdminUser();
    }

    public void seedVenueAndSeats() {
        Long venueId = jdbc.queryForObject(
                "INSERT INTO venue (name, address, total_seat_count) " +
                        "VALUES (?, ?, ?) RETURNING id",
                Long.class,
                "올림픽공원 체조경기장", "서울 송파구 올림픽로 424", 1200
        );

        jdbc.update(
                "INSERT INTO venue_seat (venue_id, section, row_label, seat_number, pos_x, pos_y) " +
                        "SELECT ?, sec.name, chr(64 + r)::varchar, n::varchar, n, r " +
                        "FROM (VALUES ('FLOOR-A'), ('FLOOR-B'), ('2F-L'), ('2F-R')) AS sec(name), " +
                        "     generate_series(1, 10) AS r, " +
                        "     generate_series(1, 30) AS n",
                venueId
        );

        log.info("공연장/좌석 테스트 자료 생성완료={}", venueId);
    }

    public void seedPerformances() {
        // 목록/페이징 API 테스트를 위해 최소 2건 이상 생성
        seedOnePerformance("2026 데모 콘서트", "시드 데이터로 생성된 테스트 공연입니다.", "CONCERT");
        seedOnePerformance("호두까기 인형", "시드 데이터로 생성된 테스트 뮤지컬입니다.", "MUSICAL");
    }

    private void seedOnePerformance(String title, String description, String genre) {
        Long performanceId = jdbc.queryForObject(
                "INSERT INTO performance (venue_id, title, description, genre, running_time, status) " +
                        "SELECT id, ?, ?, ?, ?, ? FROM venue LIMIT 1 RETURNING id",
                Long.class,
                title, description, genre, 120, "ON_SALE"
        );

        // 좌석 등급 4종 (VIP/R/S/A) — 등급명은 session_seat 생성 시 section 기준 매핑에 그대로 사용됨
        jdbc.update(
                "INSERT INTO seat_grade (performance_id, name, price) VALUES " +
                        "(?, 'VIP', 180000), (?, 'R', 140000), (?, 'S', 100000), (?, 'A', 70000)",
                performanceId, performanceId, performanceId, performanceId
        );

        // 회차 3개 — booking_open_at을 과거/몇 분 후/내일로 섞어서 나중 대기실 테스트에 대비
        jdbc.update(
                "INSERT INTO session (performance_id, session_at, booking_open_at, booking_close_at, status) VALUES " +
                        "(?, now() + interval '3 day',  now() - interval '1 day',    now() + interval '2 day', 'ON_SALE'), " +
                        "(?, now() + interval '5 day',  now() + interval '5 minute', now() + interval '4 day', 'SCHEDULED'), " +
                        "(?, now() + interval '10 day', now() + interval '1 day',    now() + interval '9 day',  'SCHEDULED')",
                performanceId, performanceId, performanceId
        );

        log.info("공연/등급/회차 시드 완료 — performanceId={}, title={}", performanceId, title);
    }

    public void seedSessionSeats() {
        jdbc.query("SELECT id FROM session", (rs) -> {
            Long sessionId = rs.getLong("id");
            jdbc.update(
                    "INSERT INTO session_seat (session_id, venue_seat_id, seat_grade_id, status) " +
                            "SELECT s.id, vs.id, sg.id, 'AVAILABLE' " +
                            "FROM session s " +
                            "JOIN performance p  ON p.id = s.performance_id " +
                            "JOIN venue_seat vs  ON vs.venue_id = p.venue_id " +
                            "JOIN seat_grade sg  ON sg.performance_id = p.id " +
                            "                   AND sg.name = CASE " +
                            "                        WHEN vs.section LIKE 'FLOOR%' THEN 'VIP' " +
                            "                        WHEN vs.section LIKE '2F%'    THEN 'R' " +
                            "                        ELSE 'S' END " +
                            "WHERE s.id = ?",
                    sessionId
            );
        });

        log.info("회차별 판매 좌석 시드 완료");
    }

    public void seedAdminUser() {
        jdbc.update(
                "INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)",
                "admin@ticketflow.com", passwordEncoder.encode("admin1234!"), "관리자", "ADMIN"
        );

        log.info("ADMIN 계정 시드 완료 — email=admin@ticketflow.com");
    }
}
