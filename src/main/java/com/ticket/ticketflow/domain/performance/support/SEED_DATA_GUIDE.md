# 시드 데이터 생성기 (`SeedDataRunner`) 작업 가이드

> `docs/study/02-developer-b-workflow.md` 1~2주차 "Day 4~7: 시드 데이터" 항목의 실행 가이드입니다.
> 엔티티 8종 작업이 끝난 뒤 바로 이어서 진행하는 다음 작업입니다.

## 왜 필요한가

DB에는 아직 공연장·공연·좌석 데이터가 하나도 없습니다. 앞으로 만들 공연 목록 조회 API, 좌석 선점 API는
전부 실제 데이터가 있어야 개발·테스트가 가능합니다. 공연장 좌석은 수백~수천 건이라 손으로 `INSERT`할 수
없으므로, **앱 기동 시 자동으로 대량 데이터를 만들어주는 코드**가 필요합니다.

## 핵심 개념 3가지

1. **`CommandLineRunner`** — Spring Boot 앱이 완전히 켜진 직후 자동 실행되는 코드를 만드는 인터페이스.
   `run()` 메서드 안의 코드가 앱 기동 시 한 번 실행됩니다.
2. **`@Profile("local")`** — "로컬 개발 환경에서만 이 코드를 실행해라"는 뜻. `application.yml`에
   `spring.profiles.active: local`이 이미 설정되어 있어 `./gradlew bootRun`이면 자동으로 켜집니다.
   나중에 `prod` 프로필로 배포하면 이 코드는 실행되지 않아, 운영 DB에 테스트 데이터가 섞이지 않습니다.
3. **`JdbcTemplate`** — JPA 엔티티(`Venue.create(...)`)가 아니라 SQL을 직접 실행하는 도구.
   수천 건을 한 번에 넣을 때 JPA보다 훨씬 빠릅니다(아래 참고).

## 왜 JPA `save()`가 아니라 SQL을 직접 쓰는가 (중요한 함정)

엔티티들은 ID를 `GenerationType.IDENTITY`(=DB의 `BIGSERIAL`)로 생성합니다. 이 방식은 행을 하나
INSERT해봐야 ID를 알 수 있는 구조라서, Hibernate가 여러 건을 묶어 한 번에 보내는 배치 처리를 할 수
없습니다. 좌석 1,200개를 `for`문으로 `save()`하면 1,200번 DB를 왕복해 몇 분씩 걸립니다.

**해결책**: `INSERT INTO ... SELECT ...` 형태로 DB 안에서 대량 데이터를 한 번의 명령으로 생성합니다.
데이터가 애플리케이션 쪽으로 나올 필요가 없어 매우 빠릅니다.

## Step 1. 파일 위치

```
src/main/java/com/ticket/ticketflow/domain/performance/support/SeedDataRunner.java
```

`global/`이 아니라 여기 두는 이유: 시드 데이터는 A 소유인 `global`이 아니라 카탈로그 데이터를 다루는
B의 코드이기 때문입니다.

## Step 2. 전체 골격

```java
package com.ticket.ticketflow.domain.performance.support;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Profile("local")
@RequiredArgsConstructor
public class SeedDataRunner implements CommandLineRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(String... args) {
        // 1) 이미 데이터가 있으면 건너뛴다 (멱등성 — 재시작할 때마다 데이터가 두 배로 늘면 안 됨)
        Integer count = jdbc.queryForObject("SELECT count(*) FROM venue", Integer.class);
        if (count != null && count > 0) {
            log.info("시드 데이터가 이미 존재하여 생성을 건너뜁니다.");
            return;
        }

        seedVenueAndSeats();
        seedPerformances();
        seedSessionSeats();

        log.info("시드 데이터 생성 완료");
    }

    private void seedVenueAndSeats() {
        // Step 3
    }

    private void seedPerformances() {
        // Step 4
    }

    private void seedSessionSeats() {
        // Step 5
    }
}
```

**설명**
- `@Component`: Spring이 자동으로 찾아 Bean으로 등록.
- `@Profile("local")`: local 프로필일 때만 동작.
- `@RequiredArgsConstructor`(Lombok): `JdbcTemplate jdbc` 필드를 받는 생성자를 자동 생성 → Spring이
  자동 주입. `spring-boot-starter-data-jpa`가 이미 `JdbcTemplate`을 준비해주므로 별도 설정 불필요.
- `implements CommandLineRunner`: `run()`이 앱 기동 직후 자동 호출됨.
- `count(*) FROM venue`로 기존 데이터 여부 확인 — 없으면 재기동할 때마다 데이터가 계속 늘어남.

## Step 3. 공연장 + 좌석 1,200석 생성

```java
private void seedVenueAndSeats() {
    // 공연장 1곳 생성 후, 방금 만든 venue의 id를 반환받음
    Long venueId = jdbc.queryForObject(
            "INSERT INTO venue (name, address, total_seat_count) " +
            "VALUES (?, ?, ?) RETURNING id",
            Long.class,
            "올림픽공원 체조경기장", "서울 송파구 올림픽로 424", 1200
    );

    // 좌석 1,200석 = 4구역 × 10열 × 30번, DB 안에서 한 번에 생성
    jdbc.update(
            "INSERT INTO venue_seat (venue_id, section, row_label, seat_number, pos_x, pos_y) " +
            "SELECT ?, sec.name, chr(64 + r)::varchar, n::varchar, n, r " +
            "FROM (VALUES ('FLOOR-A'), ('FLOOR-B'), ('2F-L'), ('2F-R')) AS sec(name), " +
            "     generate_series(1, 10) AS r, " +
            "     generate_series(1, 30) AS n",
            venueId
    );

    log.info("공연장/좌석 시드 완료 — venueId={}", venueId);
}
```

**설명**
- `RETURNING id`: PostgreSQL 전용 문법. INSERT하면서 방금 생성된 `id`를 바로 돌려받음.
  `jdbc.queryForObject(...)`가 그 SQL을 실행하고 결과 한 줄(=생성된 id)을 `Long`으로 돌려줌.
- `generate_series(1, 10)`: 1부터 10까지 숫자를 만들어주는 PostgreSQL 함수.
  `generate_series(1,10) AS r`(10개 열) × `generate_series(1,30) AS n`(30개 좌석번호) × 4개 구역
  = **4 × 10 × 30 = 1,200석**이 SQL 한 번으로 생성됨.
- `chr(64 + r)`: 64는 아스키코드에서 'A' 바로 앞 숫자라서, `r=1`→`chr(65)='A'`, `r=2`→`'B'`... 식으로
  숫자를 알파벳 열(A, B, C...)로 변환.

## Step 4. 공연 2~3건 + 좌석 등급 4종 생성

```java
private void seedPerformances() {
    Long performanceId = jdbc.queryForObject(
            "INSERT INTO performance (venue_id, title, description, genre, running_time, status) " +
            "SELECT id, ?, ?, ?, ?, ? FROM venue LIMIT 1 RETURNING id",
            Long.class,
            "2026 데모 콘서트", "시드 데이터로 생성된 테스트 공연입니다.",
            "CONCERT", 120, "ON_SALE"
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

    log.info("공연/등급/회차 시드 완료 — performanceId={}", performanceId);
}
```

**설명**
- 회차(`session`) 3개를 다르게 만든 이유: 하나는 이미 예매 오픈된 상태(`booking_open_at`이 과거),
  하나는 곧 오픈될 상태(5분 후), 하나는 한참 나중(내일). 5~6주차 "가상 대기실" 테스트에 이 다양한
  상태가 필요함.
- `interval '3 day'`: PostgreSQL의 날짜 계산 문법("지금 시각 + 3일").

## Step 5. 회차별 판매 좌석(`session_seat`) 복제 — 가장 중요한 부분

```java
private void seedSessionSeats() {
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
```

**설명**
- 회차마다 물리 좌석(`venue_seat`) 1,200개가 전부 복제되어 `session_seat`가 생성됨. 회차 3개면
  `3 × 1,200 = 3,600건`.
- `CASE WHEN ... THEN` 부분이 "어느 물리 좌석이 어느 등급인가"를 정하는 규칙 — `FLOOR-A`/`FLOOR-B`
  구역은 VIP, `2F-L`/`2F-R`은 R, 그 외는 S로 매핑. 등급 배치를 바꾸고 싶으면 여기만 수정.
- `jdbc.query(sql, rowCallback)`: 회차 목록을 조회하고, 각 회차마다 위 INSERT를 한 번씩 실행.

## Step 6. 실행 및 검증

1. 인프라 확인
   ```bash
   docker compose up -d
   ```
2. 앱 실행
   ```bash
   ./gradlew bootRun
   ```
   콘솔에 `공연장/좌석 시드 완료` → `공연/등급/회차 시드 완료` → `회차별 판매 좌석 시드 완료` →
   `시드 데이터 생성 완료` 순서로 로그가 뜨면 성공.
3. DB에서 직접 확인 (다른 터미널)
   ```bash
   docker compose exec postgres psql -U ticketflow -d ticketflow \
     -c "SELECT (SELECT count(*) FROM venue_seat) AS 물리좌석,
                (SELECT count(*) FROM session)    AS 회차,
                (SELECT count(*) FROM session_seat) AS 판매좌석;"
   ```
   `물리좌석 1200 / 회차 3 / 판매좌석 3600` 정도면 정상.
4. **멱등성 확인** — 앱을 껐다가(`Ctrl+C`) 다시 `./gradlew bootRun`. 콘솔에
   `시드 데이터가 이미 존재하여 생성을 건너뜁니다.`만 뜨고, 위 쿼리 결과 숫자가 그대로여야 함.
   숫자가 두 배로 늘었다면 멱등성 체크(Step 2)가 잘못된 것.

## Step 7. 커밋

```
feat: local 프로필 시드 데이터 생성기 구현
```

## 다음 순서 (참고용)

시드 데이터까지 끝나면 1~2주차가 완전히 마무리됩니다. 다음은 **3~4주차: 카탈로그 조회 API**
(`GET /api/performances`, `GET /api/sessions/{id}/seats` 등)로 넘어갑니다.
