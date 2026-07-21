# 02. 개발자 B 워크플로우 — `performance`(카탈로그) / `booking` / `waitingroom` / `notification`

> 담당 기준은 **`docs/ROADMAP.md`의 "역할 분담 (2026-07 재편)"** 표입니다. 이 문서는 그 표를 그대로 따릅니다.
> (2026-07-22 개정: 구 분담에서 B가 갖고 있던 `global`·`user`(인증/JWT)는 **A로 이관**되어 [01번 문서](01-developer-a-workflow.md)로 옮겼고, 구 분담에서 A가 갖고 있던 `booking`(좌석 선점·예매 확정)은 **B로 이관**되어 이 문서로 들어왔습니다.)

> **먼저 [00-common-workflow.md](00-common-workflow.md)를 읽으세요.** 이 문서는 그 내용을 안다고 가정합니다.

## B가 맡은 것

| 도메인 | 내용 |
|---|---|
| `domain/performance` | 공연/공연장/회차/좌석 **카탈로그** + 시드 데이터 (`Venue`·`VenueSeat`·`SeatGrade`·`SessionSeat` 포함) |
| `domain/waitingroom` | 가상 대기실 (Redis ZSET) |
| `domain/booking` | **좌석 선점(분산 락), 예매 확정(T1/T2), 취소, 예매 내역** |
| `domain/notification` | Kafka consumer + 알림 적재 |
| API 경로 | `/api/performances/**`, `/api/sessions/**`, `/api/waiting/**`, `/api/bookings/**` |

**B는 이 프로젝트의 동시성 코어를 통째로 소유합니다.** 대기실 → 좌석 선점 → 예매 확정이 하나의 흐름이고, 이걸 두 사람이 나누면 락·트랜잭션 버그가 반드시 납니다. 그래서 B가 일관되게 갖습니다. **포트폴리오에서 "Redis 분산락·대기열·Kafka·부하 대응"을 말할 수 있는 사람이 B입니다.**

대신 난도가 높으므로 **3~4주차까지 상대적으로 여유가 있을 때 5주차 이후를 준비하는 것**이 이 문서의 전략입니다.

## 전체 일정

| 주차 | 할 일 | 산출물 / A와의 관계 |
|---|---|---|
| 1~2 | 카탈로그·예매 엔티티 8종 + **시드 데이터** | 앱이 뜬다 = 스키마 정합성 증명 |
| 3~4 | 카탈로그 조회 API + **OpenAPI 명세 확정** | A의 프론트가 Mock→실 API로 전환하는 근거 (SP2) |
| 5~6 | 가상 대기실 (Redis ZSET) + 좌석 락 PoC | 락 동작 원리를 손으로 확인 (SP3) |
| 7~8 | **좌석 선점 + 예매 확정 T1/T2 + 취소** ★ 최난도 | 동시 요청에 1건만 성공 (SP4) |
| 9~10 | Kafka + `notification` + 예매 내역 + **동시성 통합 테스트** | "중복 예매 0건" 증명 (SP5) |
| 11~12 | 부하 테스트 리드 / 마무리 (공동) | |

## A와 주고받는 계약 (미리 알아두세요)

| 계약 | 제공 | 사용 | 언제까지 |
|---|---|---|---|
| `ApiResponse` / `ErrorCode` / `BusinessException` / `GlobalExceptionHandler` | A | **B** | 1주차 Day 1 |
| `BaseCreatedEntity` / `BaseTimeEntity` | A | **B** (엔티티 8종) | 1주차 Day 1 |
| `User` 엔티티 | A | **B** (`Booking`이 `@ManyToOne` 참조) | 1주차 Day 2 |
| `CustomUserDetails`에서 `userId` 꺼내는 법 | A | **B** (모든 인증 API) | SP1 (2주차 말) |
| `PaymentService.pay(bookingId, amount)` | A | **B** (`BookingFacade`가 호출) | 6주차 말 |
| `SecurityConfig` 화이트리스트에 B 경로 추가 | A | **B** | 필요할 때마다 요청 |
| **시드 데이터** | **B** | A (프론트가 볼 실데이터) | 2주차 말 |
| **OpenAPI 명세** | **B** | A (프론트 Mock→실 API) | SP2 (4주차 말) |
| 좌석 락 TTL / 입장 토큰 TTL / 결제 제한시간 | **B가 결정** | A (화면 타이머) | 7주차 전 |

> **`global/` 하위는 A 소유이자 공유 기반입니다.** `SecurityConfig`에 경로를 추가해야 하면 직접 고치지 말고 A에게 요청하세요(`CLAUDE.md` 규칙).

---

# 1~2주차 — 엔티티 8종 + 시드 데이터

## 시작 전: A를 기다려야 하는 것 / 기다리지 않아도 되는 것

| 작업 | A 의존 | 지금 바로 가능? |
|---|---|---|
| 엔티티 8종 | `Base*Entity`, `User` **필요** | A의 Day 1~2 머지 후 |
| **시드 데이터** | **없음** (`JdbcTemplate` + 순수 SQL) | ✅ **바로 시작 가능** |
| 카탈로그 Repository | 엔티티 필요 | 엔티티 후 |

**A가 아직 안 올렸다면 시드부터 시작하세요.** 시드는 엔티티도 `global/`도 쓰지 않습니다.

## Day 1~3: 카탈로그·예매 엔티티 8종

### 작업 순서 (FK 의존 순서대로)

의존하는 쪽을 먼저 만들어야 참조할 대상이 있습니다.

```
[A 담당 — 먼저 머지되어 있어야 함]
   BaseCreatedEntity / BaseTimeEntity
   User

[B 담당]
1. Venue                 (의존 없음)
2. VenueSeat             → Venue
3. Performance           → Venue
4. SeatGrade             → Performance
5. PerformanceSession    → Performance          ★ 클래스명 주의
6. SessionSeat           → PerformanceSession, VenueSeat, SeatGrade
7. Booking               → User(A), PerformanceSession
8. BookingSeat           → Booking, SessionSeat

[A 담당 — B의 Booking 머지 후]
   Payment               → Booking
```

### 만들 파일

```
domain/performance/entity/Venue.java
domain/performance/entity/VenueSeat.java
domain/performance/entity/Performance.java
domain/performance/entity/PerformanceStatus.java
domain/performance/entity/Genre.java
domain/performance/entity/SeatGrade.java
domain/performance/entity/PerformanceSession.java
domain/performance/entity/SessionStatus.java
domain/performance/entity/SessionSeat.java
domain/performance/entity/SessionSeatStatus.java

domain/booking/entity/Booking.java
domain/booking/entity/BookingStatus.java
domain/booking/entity/BookingSeat.java
domain/booking/entity/BookingSeatStatus.java
```

> `Venue`, `VenueSeat`는 `performance` 도메인에 둡니다. 공연장은 B의 공연 카탈로그에 속한 마스터 데이터이고, 별도 패키지를 만들면 소유가 애매해집니다.

### 반드시 지킬 것 ([00번 문서 3장](00-common-workflow.md#3-entity-작성법--이-프로젝트에서-가장-조심할-부분) 요약)

- `@Table(name = "session")` 처럼 **클래스명과 테이블명이 다르면 명시**
- `TIMESTAMPTZ` → **`OffsetDateTime`** (`LocalDateTime` 금지)
- 시간 컬럼 유무에 따라 `BaseTimeEntity` / `BaseCreatedEntity` / **상속 없음** (00번 문서의 표를 그대로 따르세요)
- 모든 `@ManyToOne`에 `fetch = FetchType.LAZY`
- 모든 enum에 `@Enumerated(EnumType.STRING)`
- `@Setter` 금지, `@Builder`는 `private` 생성자에

### 특히 조심할 엔티티 3개

#### ① `PerformanceSession` — 클래스명과 테이블명이 다릅니다

```java
@Entity
@Table(name = "session")        // ★ 테이블은 session, 클래스는 PerformanceSession
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PerformanceSession extends BaseCreatedEntity {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performance_id", nullable = false)
    private Performance performance;

    @Column(name = "session_at", nullable = false)
    private OffsetDateTime sessionAt;

    @Column(name = "booking_open_at", nullable = false)
    private OffsetDateTime bookingOpenAt;

    @Column(name = "booking_close_at", nullable = false)
    private OffsetDateTime bookingCloseAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SessionStatus status;
    ...
}
```

Java 클래스명을 `Session`으로 지으면 `org.hibernate.Session`, `jakarta.servlet.http.HttpSession`과 import가 뒤섞여 매번 헷갈립니다. **A/B 둘 다 참조하는 엔티티라 나중에 이름을 바꾸면 두 사람 코드가 동시에 흔들립니다.**

#### ② `SessionSeat` — 상속 없음, 상태는 2개뿐

```java
@Entity
@Table(name = "session_seat")
public class SessionSeat {                  // ★ BaseTimeEntity 상속하면 앱이 안 뜬다

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SessionSeatStatus status;       // AVAILABLE, SOLD 뿐. HELD 없음
    ...
}
```

`HELD`(선점 중) 상태가 없는 게 이 프로젝트 설계의 핵심입니다. **임시 점유는 Redis TTL이 전담하고, DB는 영구 상태만 기록**합니다. 나중에 "선점 중 표시를 하려면 HELD가 있어야 하지 않나?" 싶어도 **추가하지 마세요.** Redis 락이 만료되거나 서버가 죽으면 DB의 HELD가 영원히 남아 좌석이 증발합니다.

`session_seat`·`booking_seat`에 시간 컬럼이 없는 것도 누락이 아니라, **회차당 수천 건이 벌크 생성되는 테이블이라 행 크기를 줄인 의도적 설계**입니다.

#### ③ `Booking` — 상태 변경 메서드를 미리 만들어 두세요

```java
@Entity
@Table(name = "booking")
public class Booking extends BaseCreatedEntity {

    @Column(name = "booking_number", nullable = false, length = 30)
    private String bookingNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BookingStatus status;

    @Column(name = "booked_at")
    private OffsetDateTime bookedAt;

    @Column(name = "cancelled_at")
    private OffsetDateTime cancelledAt;

    // 7~8주차에 쓸 상태 전이 메서드 — 지금 만들어 두면 나중에 흐름이 명확해집니다
    public void confirm() {
        this.status = BookingStatus.CONFIRMED;
        this.bookedAt = OffsetDateTime.now();
    }

    public void cancel() {
        this.status = BookingStatus.CANCELLED;
        this.cancelledAt = OffsetDateTime.now();
    }
}
```

### 완료 확인

```bash
docker compose up -d
./gradlew bootRun
```

`Started TicketflowApplication in X seconds`가 뜨면 **엔티티가 스키마와 100% 일치한다는 증명**입니다. 이 로그를 PR 본문에 붙이세요.

에러가 나면 [00번 문서의 에러 표](00-common-workflow.md#11-자주-만나는-에러와-읽는-법)를 보세요. 대부분 `missing column` 또는 `wrong column type`이고, `V1__init.sql`과 한 줄씩 대조하면 5분 안에 찾습니다.

**PR**: `feat: 카탈로그/예매 도메인 JPA 엔티티 8종 추가` → A 리뷰 후 즉시 머지

---

## Day 4~7: 시드 데이터 ★ 1~2주차 최우선

### 왜 최우선인가

`session_seat` 데이터가 없으면:

- **B 본인의 3~4주차 조회 API**를 만들 수도 테스트할 수도 없습니다
- **B 본인의 7~8주차 좌석 선점**도 마찬가지입니다
- A의 프론트는 SP2에서 붙일 실데이터가 없습니다
- 11주차 부하 테스트 데이터도 여기서 나옵니다

**공연장 좌석은 수백~수천 건이라 수동 INSERT가 불가능합니다.**

### 방식 선택: `CommandLineRunner` (권장)

| 방식 | 장점 | 단점 |
|---|---|---|
| Flyway 마이그레이션 | 자동 적용 | **한 번 적용되면 재실행 불가.** 개발 중 데이터를 갈아엎기 어려움 |
| **`CommandLineRunner` (local 프로필)** | 언제든 DB 비우고 재생성 가능 | 코드 한 벌 필요 |

개발 중에는 데이터를 자주 갈아엎게 되므로 **`CommandLineRunner`를 권장**합니다.

### 만들 파일

```
domain/performance/support/SeedDataRunner.java
```

> 위치 주의: 구 문서는 `global/config/`를 제안했지만, **`global/`은 A 소유**입니다. 시드는 카탈로그 데이터를 만드는 B의 코드이므로 `domain/performance/support/`에 두세요.

```java
@Slf4j
@Component
@Profile("local")                      // ★ local 프로필에서만 동작
@RequiredArgsConstructor
public class SeedDataRunner implements CommandLineRunner {

    private final JdbcTemplate jdbc;

    @Override
    public void run(String... args) {
        // ★ 멱등성: 앱을 재시작할 때마다 데이터가 두 배로 늘면 안 됩니다
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
}
```

> **테스트 계정(`users`)은 A의 회원가입 API가 뜬 뒤 `curl`로 만드는 편이 낫습니다.** 시드에서 직접 INSERT하면 BCrypt 해시를 손으로 만들어야 하고, A의 비밀번호 정책과 어긋날 수 있습니다.

### ★ 가장 중요한 기술 포인트: 벌크 INSERT

`session_seat`는 **회차 1개당 좌석 전체가 복제**됩니다. 공연 3건 × 회차 4개 × 좌석 1200석 = **14,400행**입니다.

```java
// ❌ 이렇게 하면 14,400번의 네트워크 왕복이 발생합니다 (수 분 소요)
for (VenueSeat seat : seats) {
    sessionSeatRepository.save(new SessionSeat(session, seat, grade));
}
```

> **왜 `saveAll()`도 느린가?** 엔티티가 `GenerationType.IDENTITY`를 쓰기 때문입니다. IDENTITY는 INSERT를 실행해야 ID를 알 수 있어서 **Hibernate가 JDBC 배치를 사용할 수 없습니다.** `spring.jpa.properties.hibernate.jdbc.batch_size`를 아무리 키워도 소용없습니다. JPA를 아는 사람도 잘 모르는 함정입니다.

**해결: `INSERT ... SELECT`로 DB 안에서 끝냅니다.** 데이터가 네트워크를 한 번도 건너오지 않습니다.

#### 좌석 1200석 생성 (`generate_series`)

```sql
INSERT INTO venue_seat (venue_id, section, row_label, seat_number, pos_x, pos_y)
SELECT ?,                       -- venue_id
       sec.name,
       chr(64 + r)::varchar,    -- 1→'A', 2→'B' ...
       n::varchar,
       n,                       -- pos_x
       r                        -- pos_y
FROM (VALUES ('FLOOR-A'), ('FLOOR-B'), ('2F-L'), ('2F-R')) AS sec(name),
     generate_series(1, 10) AS r,     -- 10열
     generate_series(1, 30) AS n;     -- 30번까지
-- 4구역 × 10열 × 30번 = 1,200석
```

#### 회차별 좌석 복제 (한 방 쿼리)

```sql
INSERT INTO session_seat (session_id, venue_seat_id, seat_grade_id, status)
SELECT s.id,
       vs.id,
       sg.id,
       'AVAILABLE'
FROM session s
JOIN performance p  ON p.id = s.performance_id
JOIN venue_seat vs  ON vs.venue_id = p.venue_id
JOIN seat_grade sg  ON sg.performance_id = p.id
                   AND sg.name = CASE
                        WHEN vs.section LIKE 'FLOOR%' THEN 'VIP'
                        WHEN vs.section LIKE '2F%'    THEN 'R'
                        ELSE 'S'
                   END
WHERE s.id = ?;
```

`section` 문자열로 등급을 정하는 이 `CASE`문이 **"어느 물리 좌석이 어느 등급인가"의 매핑 규칙**입니다(`V1__init.sql` 주석에 언급된 부분). 규칙을 바꾸고 싶으면 여기만 고치면 됩니다.

### 생성할 데이터 규모

| 대상 | 수량 |
|---|---|
| `venue` | 1곳 |
| `venue_seat` | 1,200석 |
| `performance` | 2~3건 (`ON_SALE` 상태 최소 1건) |
| `seat_grade` | 공연당 4종 (VIP/R/S/A) |
| `session` | 공연당 3~5회차 |
| `session_seat` | 회차 × 1,200 |

> **`booking_open_at`을 다양하게 두세요.** 이미 열린 회차(과거), 곧 열릴 회차(몇 분 후), 나중 회차(내일)를 섞어야 5~6주차 대기실 로직을 테스트할 수 있습니다.

### 완료 확인

```bash
docker compose exec postgres psql -U ticketflow -d ticketflow \
  -c "SELECT (SELECT count(*) FROM venue_seat) AS 물리좌석,
             (SELECT count(*) FROM session)    AS 회차,
             (SELECT count(*) FROM session_seat) AS 판매좌석;"
```

**A에게 바로 알리세요.** "시드 완료, `session_seat` N건 생성됨"이면 A는 프론트에서 실제 좌석 수를 기준으로 화면을 설계할 수 있습니다.

**PR**: `feat: local 프로필 시드 데이터 생성기 구현`

### 1~2주차 완료 기준
앱이 뜬다(= 엔티티 정합성 증명) + 시드 데이터로 공연/회차/좌석이 DB에 존재한다

---

# 3~4주차 — 카탈로그 조회 API → SP2

## API 목록

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/api/performances?page=0&size=20` | 공연 목록 (페이징) |
| `GET` | `/api/performances/{id}` | 공연 상세 + 회차 목록 |
| `GET` | `/api/sessions/{id}/seats/summary` | 등급/구역별 잔여 수 |
| `GET` | `/api/sessions/{id}/seats` | 좌석 배치도 + 잔여 상태 |

**이 4개의 요청/응답 스펙이 SP2의 산출물입니다.** A가 이 명세로 프론트를 Mock 선행하고 SP2에서 실 API로 갈아끼웁니다. **구현이 덜 끝났어도 명세는 4주차 말에 확정해서 전달하세요.**

## (1) 목록 — 페이징

```java
@GetMapping
public ApiResponse<Page<PerformanceListResponse>> list(
        @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
    return ApiResponse.success(performanceService.findAll(pageable));
}
```

`Pageable`을 파라미터로 두면 `?page=0&size=20&sort=createdAt,desc`를 Spring이 알아서 파싱합니다.

## (2) N+1 문제 ★ 반드시 확인하고 넘어가세요

공연 목록에서 각 공연의 공연장 이름을 함께 보여주려 하면:

```
SELECT * FROM performance LIMIT 20;      -- 1번
SELECT * FROM venue WHERE id = 1;        -- 20번 반복
```

**쿼리 21번.** 이게 N+1입니다. `@ManyToOne(fetch = LAZY)`를 걸어도 실제로 값을 꺼내는 순간 쿼리가 나갑니다.

### 확인 방법

```yaml
# application-local.yml
logging:
  level:
    org.hibernate.SQL: debug
```

목록 API를 한 번 호출하고 **로그의 SELECT 개수를 세어 보세요.**

### 해결

```java
@Query("select p from Performance p join fetch p.venue")
Page<Performance> findAllWithVenue(Pageable pageable);
```

> **주의**: `join fetch`와 `Pageable`을 컬렉션(`@OneToMany`)에 함께 쓰면 Hibernate가 메모리에서 페이징해서 경고가 뜹니다. `@ManyToOne`(단일 연관)의 `join fetch`는 안전합니다. 컬렉션이 필요하면 `@BatchSize`를 쓰세요.

> **`open-in-view: false`입니다.** 지연 로딩은 트랜잭션(서비스 계층) 안에서만 동작하므로, **DTO 변환을 서비스 계층에서 끝내세요.** 컨트롤러에서 LAZY 필드에 접근하면 `LazyInitializationException`이 납니다.

## (3) 좌석 배치도 — 이 프로젝트에서 가장 트래픽이 몰리는 API ★

**대기실을 통과한 사용자가 가장 먼저 호출하는 API**입니다. 여기가 느리면 대기실을 만든 의미가 없습니다.

### 문제: 응답 크기

좌석 1,200석(부하 테스트 시 2,000석)을 그대로 JSON으로 내보내면 **수백 KB**입니다. 동시 1,000명이면 수백 MB가 나갑니다.

### 대응 1 — 응답을 두 단계로 나눕니다

```
GET /api/sessions/{id}/seats/summary   → 등급/구역별 잔여 수 (작음, 자주 호출)
GET /api/sessions/{id}/seats           → 개별 좌석 전체 (큼, 좌석 선택 화면 진입 시 1회)
```

```java
public record SeatSummaryResponse(
        Long sessionId,
        List<GradeSummary> grades) {

    public record GradeSummary(String gradeName, int price, long total, long available) {}
}
```

### 대응 2 — 필드를 최대한 줄입니다

좌석 하나당 필드가 10개면 1,200석 × 10입니다. 프론트가 실제로 쓰는 것만 남기세요. **A와 합의해서 결정하세요** — 프론트가 안 쓰는 필드를 내보내는 건 순수한 낭비입니다.

```java
// 좌석 하나 = 6개 필드로 충분
public record SeatResponse(Long id, String section, String row, String number,
                           int posX, int posY, boolean available) {}
```

### 대응 3 — Redis 캐싱 (여유 있으면)

좌석 상태는 예매가 발생할 때만 바뀝니다. **짧은 TTL(1~3초) 캐시**만으로도 DB 부하가 크게 줍니다.

```java
@Cacheable(value = "seatMap", key = "#sessionId")
public SeatMapResponse getSeatMap(Long sessionId) { ... }
```

`@EnableCaching` + Redis CacheManager 설정이 필요합니다. **11주차 부하 테스트에서 "캐시 전/후" 비교표를 만들면 훌륭한 포트폴리오 소재**가 됩니다.

## (4) 도메인 경계용 Service 시그니처 ★ 7주차 전까지 필수

B의 `booking` 코드는 `performance` 소유인 `session_seat`를 건드려야 합니다. **둘 다 B 담당이지만 도메인 패키지가 다르므로 `CLAUDE.md` 규칙은 동일하게 적용됩니다** — `booking`에서 `SessionSeatRepository`를 직접 주입하지 말고 `SessionSeatService`를 경유하세요.

```java
// domain/performance/service/SessionSeatService.java
@Service
public class SessionSeatService {

    /** 좌석들이 해당 회차에 속하고 예매 가능한 상태인지 검증. 아니면 예외 */
    public void validateAvailable(Long sessionId, List<Long> sessionSeatIds) { ... }

    /** 예매에 필요한 좌석 정보(가격 포함) 조회 */
    public List<SeatPriceInfo> findForBooking(Long sessionId, List<Long> sessionSeatIds) { ... }

    /** 예매 확정 시 SOLD 로 변경 (T2에서 호출) */
    @Transactional
    public void markAsSold(List<Long> sessionSeatIds) { ... }

    /** 예매 취소 시 AVAILABLE 로 복구 */
    @Transactional
    public void markAsAvailable(List<Long> sessionSeatIds) { ... }
}
```

```java
// 도메인 경계를 넘는 DTO — record 로 단순하게
public record SeatPriceInfo(Long sessionSeatId, String gradeName, int price) {}
```

> **"어차피 내가 다 만드는데 왜 굳이?"** — 경계를 지키면 나중에 카탈로그 캐싱을 넣거나 좌석 상태 변경 로직을 바꿀 때 **한 곳만 고치면 됩니다.** 그리고 이 구조 자체가 면접에서 설명할 거리가 됩니다.

**PR**: `feat: 공연/회차/좌석 조회 API 구현`

**완료 기준**: 프론트(A)에서 목록 → 상세 → 좌석 배치도 조회 가능 + OpenAPI 명세 확정

---

# 5~6주차 — 가상 대기실 (Redis ZSET) + 좌석 락 PoC → SP3

> 패키지는 `booking` 하위가 아니라 **`domain/waitingroom/`을 신설**합니다. 대기실·좌석 선점 모두 B 담당이지만, `booking`이 `waitingroom`의 내부 구현을 직접 참조하지 말고 **입장 토큰 검증 인터페이스**를 통해서만 호출해야 합니다.

## Day 1: 토큰 검증 시그니처 먼저 커밋

7~8주차의 좌석 선점 코드가 이 메서드를 호출합니다. **껍데기라도 먼저 만들어 두면 흐름 설계가 명확해집니다.**

```java
// domain/waitingroom/service/WaitingRoomService.java
@Service
public class WaitingRoomService {

    /** 입장 토큰이 유효하고 해당 회차·사용자의 것인지 검증. 아니면 예외 */
    public void validateEntryToken(String entryToken, Long sessionId, Long userId) {
        throw new UnsupportedOperationException("구현 예정");
    }
}
```

## Redis 자료구조 설계

| 키 | 타입 | 용도 |
|---|---|---|
| `waiting:queue:{sessionId}` | **ZSET** | 대기열. member=userId, score=진입 시각(ms) |
| `waiting:granted:{sessionId}:{userId}` | String | 입장 허용된 사용자의 토큰 (TTL 15분) |
| `waiting:entry:{token}` | String | 토큰 → `{sessionId}:{userId}` 역방향 (TTL 15분) |
| `waiting:alive:{sessionId}:{userId}` | String | 생존 신호 (TTL 30초) |

### 왜 ZSET인가

| 자료구조 | 순번 조회 | 판정 |
|---|---|---|
| List | `LPOS` — O(N), 앞에서부터 훑음 | ❌ |
| **ZSET** | **`ZRANK` — O(log N)** | ✅ |
| Stream | 소비자 그룹 개념이 과함 | ❌ |

"내 앞에 몇 명"을 실시간으로 계속 물어보는 게 대기실의 본질이라 **`ZRANK`가 있는 ZSET**이 정답입니다. score를 진입 시각으로 두면 정렬이 곧 순번입니다.

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/api/waiting/{sessionId}/enter` | 대기열 진입 (순번 발급) |
| `GET` | `/api/waiting/{sessionId}/status` | 내 순번 조회 (폴링 + heartbeat 겸용) |
| `DELETE` | `/api/waiting/{sessionId}` | 대기 포기 |

**셋 다 인증 필요 API입니다.** `@AuthenticationPrincipal CustomUserDetails`로 `userId`를 꺼내세요(A가 SP1에서 전달한 방식).

## 구현 포인트 6가지

### ① 중복 진입 방지 — `ZADD NX`

새로고침이나 멀티탭으로 여러 번 진입하면 순번이 밀리거나 무의미해집니다.

```java
// NX = 이미 있으면 score 를 갱신하지 않음 → 기존 순번 유지
redisTemplate.opsForZSet().addIfAbsent(queueKey, userId.toString(), now);
```

**`add()`를 쓰면 안 됩니다.** score가 갱신되어 **새로고침할 때마다 순번이 맨 뒤로 밀립니다.** 대기실에서 가장 치명적인 버그입니다.

### ② 순번 조회

```java
public WaitingStatusResponse getStatus(Long sessionId, Long userId) {
    // 이미 입장 허용됐으면 토큰 반환
    String token = redisTemplate.opsForValue().get(grantedKey(sessionId, userId));
    if (token != null) {
        return WaitingStatusResponse.entered(token);
    }

    Long rank = redisTemplate.opsForZSet().rank(queueKey(sessionId), userId.toString());
    if (rank == null) {
        throw new BusinessException(WaitingRoomErrorCode.NOT_IN_QUEUE);
    }

    // ③ heartbeat 갱신 — 폴링 자체를 생존 신호로 활용
    redisTemplate.opsForValue().set(aliveKey(sessionId, userId), "1", Duration.ofSeconds(30));

    return WaitingStatusResponse.waiting(rank + 1);   // ZRANK 는 0부터 시작
}
```

### ③ 이탈자(유령) 처리

브라우저를 그냥 닫으면 큐에 유령이 남아 뒤 사람들이 영원히 기다립니다.

**폴링을 heartbeat로 활용**합니다(위 코드). `waiting:alive:*` 키는 TTL 30초라 폴링이 끊기면 자동 소멸합니다. 스케줄러가 입장을 허용할 때 **alive 키가 없는 사용자는 큐에서 제거**합니다.

> **A에게 알려주세요.** "폴링을 멈추면 30초 뒤 큐에서 빠진다"는 사실을 모르면 A가 화면 전환 중 폴링을 끊어놓고 "왜 순번이 사라지죠?"라고 묻게 됩니다.

### ④ 입장 허용 스케줄러

```java
@Scheduled(fixedDelay = 1000)      // 1초마다
public void grantEntry() {
    for (Long sessionId : activeSessionIds()) {
        int quota = entryRatePerSecond;              // 초당 N명

        while (quota-- > 0) {
            Set<String> popped = redisTemplate.opsForZSet().popMin(queueKey(sessionId), 1);
            if (popped == null || popped.isEmpty()) break;

            Long userId = Long.valueOf(popped.iterator().next());

            // 유령이면 토큰을 발급하지 않고 건너뜀
            if (!Boolean.TRUE.equals(redisTemplate.hasKey(aliveKey(sessionId, userId)))) {
                continue;
            }
            issueEntryToken(sessionId, userId);
        }
    }
}
```

`ZPOPMIN`은 **꺼내기와 삭제가 원자적**이라 여러 서버가 떠도 같은 사용자를 두 번 꺼내지 않습니다.
`@Scheduled`를 쓰려면 설정 클래스에 `@EnableScheduling`이 필요합니다.

### ⑤ 저트래픽 fast-path

대기 인원이 0명인데 대기실 화면을 보여주는 건 사용자 경험만 나빠집니다.

```java
public EnterResponse enter(Long sessionId, Long userId) {
    Long size = redisTemplate.opsForZSet().size(queueKey(sessionId));
    if (size == null || size == 0) {
        return EnterResponse.immediate(issueEntryToken(sessionId, userId));   // 즉시 입장
    }
    // 대기열 등록...
}
```

### ⑥ 토큰 검증 (7~8주차에 좌석 선점이 호출하는 그 메서드)

```java
public void validateEntryToken(String entryToken, Long sessionId, Long userId) {
    String value = redisTemplate.opsForValue().get(entryKey(entryToken));
    if (value == null) {
        throw new BusinessException(WaitingRoomErrorCode.ENTRY_TOKEN_EXPIRED);
    }
    if (!value.equals(sessionId + ":" + userId)) {
        throw new BusinessException(WaitingRoomErrorCode.ENTRY_TOKEN_MISMATCH);
    }
}
```

**`sessionId`와 `userId`를 함께 검증하는 게 중요합니다.** 토큰 문자열만 보면 남의 토큰을 복사해 쓸 수 있고, 다른 회차 토큰으로 인기 회차에 들어갈 수 있습니다.

## TTL 3종을 여기서 확정하세요 ★

```
입장 토큰 TTL   >   좌석 락 TTL   >   결제 제한 시간
    15분              7분              5분
```

**세 값 모두 B가 결정하고 관리합니다**(대기실·좌석락·예매확정이 전부 B 소유). 순서가 뒤집히면 반드시 버그가 납니다.

- 락 TTL < 결제 시간 → 결제 중에 락이 풀려 남이 같은 좌석을 잡습니다
- 입장 토큰 TTL < 락 TTL → 좌석은 잡았는데 입장 자격이 만료되어 확정을 못 합니다

**확정한 숫자를 A에게 통보하세요.** A는 이 값으로 화면 타이머를 맞춥니다.

### 처리율(초당 N명)은 어떻게 정하나

지금은 근거가 없습니다. **일단 임의의 값(예: 초당 20명)으로 시작하고, 11주차 부하 테스트에서 "서버가 견디는 최대 처리량"을 측정해 역산**하세요. 이 과정 자체가 포트폴리오에 쓸 좋은 이야기입니다.

## 6주차 말: 좌석 락 PoC — 7~8주차 준비의 핵심

**7주차에 처음 분산 락을 설계하면 늦습니다.** 대기실로 Redis에 익숙해진 지금, 작은 실험으로 원리를 확인해 두세요.

### ⚠️ 함정 ③ — 먼저 알아야 할 것: 왜 Redisson `RLock`이 아닌가 ★★★

인터넷의 "Redisson 분산 락" 예제는 대부분 이런 형태입니다.

```java
RLock lock = redissonClient.getLock("seat:1");
lock.lock();
try { ... } finally { lock.unlock(); }
```

**이 프로젝트의 좌석 선점에는 이걸 쓸 수 없습니다.** 이유:

- `RLock`은 **획득한 스레드가 해제**하는 구조입니다(재진입 락).
- 그런데 우리의 좌석 선점은 **HTTP 요청 A에서 잡고, 5분 뒤 다른 HTTP 요청 B에서 확인·해제**합니다.
- 요청마다 스레드가 다르므로 요청 B에서 `unlock()`을 부르면 `IllegalMonitorStateException`이 납니다.

| 상황 | 쓸 것 |
|---|---|
| 한 요청 안에서 시작·종료되는 짧은 임계 구역 | `RLock` (Redisson) |
| **요청을 넘어 유지되는 점유** (= 좌석 선점) | **`SET key value NX EX ttl`** (소유자 값 비교 방식) |

우리 좌석 선점은 후자입니다. 그래서 다음 형태를 씁니다.

```
키:   seat:hold:{sessionSeatId}
값:   {userId}                     ← "누가 잡았는지"를 값에 기록
TTL:  7분
```

- **획득** = `SET seat:hold:12 100 NX EX 420` → 성공하면 내가 주인
- **확인** = `GET seat:hold:12` 값이 내 userId인가
- **해제** = 값이 내 것일 때만 삭제 (Lua로 원자적 처리)

> 그 결과 **`redisson-spring-boot-starter` 의존성 자체가 불필요해질 수 있습니다.** `build.gradle`에 주석 처리된 상태 그대로 두는 편이 낫습니다.

### PoC로 만들 것

```
global/config/RedisConfig.java                        # StringRedisTemplate 설정 (A에게 요청 or 리뷰 요청)
domain/booking/service/SeatHoldRedisRepository.java   # 획득/확인/해제 3개 메서드
```

```java
@Repository
@RequiredArgsConstructor
public class SeatHoldRedisRepository {

    private static final String KEY_PREFIX = "seat:hold:";
    private static final Duration TTL = Duration.ofMinutes(7);

    private final StringRedisTemplate redisTemplate;

    /** 선점 시도. 이미 다른 사람이 잡고 있으면 false */
    public boolean tryHold(Long sessionSeatId, Long userId) {
        Boolean result = redisTemplate.opsForValue()
                .setIfAbsent(key(sessionSeatId), String.valueOf(userId), TTL);
        return Boolean.TRUE.equals(result);
    }

    /** 내가 주인인지 확인 */
    public boolean isHeldBy(Long sessionSeatId, Long userId) {
        return String.valueOf(userId).equals(redisTemplate.opsForValue().get(key(sessionSeatId)));
    }

    /** 내가 주인일 때만 해제 — GET 후 DEL 로 나눠 하면 그 사이에 남의 락을 지울 수 있어 Lua 로 원자 처리 */
    public void release(Long sessionSeatId, Long userId) {
        String script = """
                if redis.call('get', KEYS[1]) == ARGV[1] then
                    return redis.call('del', KEYS[1])
                else
                    return 0
                end
                """;
        redisTemplate.execute(new DefaultRedisScript<>(script, Long.class),
                List.of(key(sessionSeatId)), String.valueOf(userId));
    }

    private String key(Long sessionSeatId) {
        return KEY_PREFIX + sessionSeatId;
    }
}
```

> **`release`를 왜 Lua로 하나?**
> `if (isHeldBy(...)) { delete(...); }`로 쓰면, 확인과 삭제 사이에 TTL이 만료되고 다른 사용자가 같은 좌석을 잡을 수 있습니다. 그 상태에서 `delete`가 실행되면 **남의 락을 지워버립니다.** Lua 스크립트는 Redis에서 단일 명령으로 실행되므로 그 틈이 없습니다. 분산 락 구현에서 가장 유명한 버그이니 반드시 이해하고 넘어가세요.

### PoC 검증

```java
@Test
void 같은_좌석은_한_명만_선점한다() {
    assertThat(repo.tryHold(1L, 100L)).isTrue();
    assertThat(repo.tryHold(1L, 200L)).isFalse();   // 두 번째는 실패
}

@Test
void 남의_락은_해제되지_않는다() {
    repo.tryHold(1L, 100L);
    repo.release(1L, 200L);                         // 다른 사람이 해제 시도
    assertThat(repo.isHeldBy(1L, 100L)).isTrue();   // 여전히 100번 것
}
```

A가 3~4주차에 깔아둔 `IntegrationTestSupport`(Testcontainers)를 상속하면 Redis 컨테이너가 자동으로 뜹니다.

## 완료 확인

```bash
# 여러 사용자로 동시 진입 후 순번이 겹치지 않는지
docker compose exec redis redis-cli ZRANGE "waiting:queue:1" 0 -1 WITHSCORES

# 같은 사용자가 두 번 진입해도 순번이 유지되는지 (NX 검증)
```

**PR**: `feat: Redis ZSET 기반 가상 대기실 구현` / `feat: Redis 좌석 선점 락 저장소 PoC 구현`

**완료 기준**: 동시 요청 시 순번대로 토큰 발급됨을 로컬에서 확인

---

# 7~8주차 — 좌석 선점 + 예매 확정 ★ 최난도 구간 → SP4

## 시작 전 체크

- [ ] 대기실 `validateEntryToken`이 실제로 동작하는가 (5~6주차 산출물)
- [ ] `SessionSeatService`의 `validateAvailable` / `findForBooking` / `markAsSold` / `markAsAvailable`이 구현되어 있는가 (3~4주차 산출물)
- [ ] **A에게 `PaymentService.pay(bookingId, amount)` 시그니처를 받았는가?** (없으면 지금 요청 — 껍데기라도 커밋해달라고 하세요)
- [ ] TTL 3종(15분 / 7분 / 5분)을 확정하고 A에게 통보했는가

## 먼저: 스키마 보강 2건

두 가지를 **마이그레이션 추가**로 해결해야 합니다. **`V1__init.sql`을 고치지 마세요.** 이미 적용된 마이그레이션을 수정하면 Flyway 체크섬이 깨져 앱이 안 뜹니다.

파일명은 **타임스탬프 규칙**입니다: `V{yyyyMMddHHmm}__설명.sql`

```sql
-- src/main/resources/db/migration/V202609011000__alter_booking_payment.sql

-- ① PENDING 예매 만료 기준 컬럼
ALTER TABLE booking ADD COLUMN expires_at TIMESTAMPTZ;

-- ② 결제 재시도가 막히는 문제 해결
--    현재 UNIQUE(booking_id) 라서 FAILED 행이 자리를 차지하면 재결제 INSERT 가 거부됨.
--    uq_booking_seat_active 와 같은 패턴(부분 유니크)으로 전환한다.
ALTER TABLE payment DROP CONSTRAINT uq_payment_booking;
CREATE UNIQUE INDEX uq_payment_booking_success
    ON payment (booking_id)
    WHERE status = 'SUCCESS';
```

> **순차 번호(`V2__`)를 쓰지 마세요.** A도 같은 기간에 마이그레이션을 추가할 수 있습니다. 타임스탬프는 충돌하지 않습니다.

마이그레이션을 추가했으면 **`Booking` 엔티티에 `expiresAt` 필드를 추가**해야 합니다(안 그러면 validate는 통과하지만 코드에서 못 씁니다). **`payment` 테이블은 A 소유이므로 제약 변경 사실을 A에게 알리세요.**

## (1) 좌석 선점 API

### 만들 파일

```
domain/booking/controller/SeatHoldController.java
domain/booking/service/SeatHoldService.java
domain/booking/service/SeatHoldRedisRepository.java     # 6주차 PoC 승격
domain/booking/dto/SeatHoldRequest.java
domain/booking/dto/SeatHoldResponse.java
domain/booking/exception/BookingErrorCode.java
```

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/api/bookings/seats/hold` | 좌석 선점 (1~4석) |
| `DELETE` | `/api/bookings/seats/hold` | 선점 해제 (사용자가 선택 취소) |

```java
public record SeatHoldRequest(
        @NotNull Long sessionId,
        @NotEmpty @Size(max = 4) List<Long> sessionSeatIds,
        @NotBlank String entryToken               // 대기실 입장 토큰
) {}
```

### 1단계 — 좌석 ID를 **반드시 정렬**합니다

```java
List<Long> sortedIds = request.sessionSeatIds().stream().sorted().toList();
```

**왜?** 데드락 때문입니다.

```
사용자1: 좌석 5 잡음 → 좌석 3 대기
사용자2: 좌석 3 잡음 → 좌석 5 대기
→ 둘 다 영원히 대기 (데드락)
```

모두가 **작은 ID부터** 잡으면 이 상황이 원천적으로 불가능합니다. 한 줄이지만 이 프로젝트에서 가장 중요한 한 줄 중 하나입니다.

### 2단계 — 부분 실패 시 전량 해제

3석 중 2석만 잡히면 **이미 잡은 2석도 풀고 실패**시켜야 합니다. 안 그러면 아무도 예매 못 하는 좌석이 TTL 동안 방치됩니다.

```java
@Service
@RequiredArgsConstructor
public class SeatHoldService {

    private final SeatHoldRedisRepository holdRepository;
    private final SessionSeatService sessionSeatService;      // performance 도메인 경유
    private final WaitingRoomService waitingRoomService;      // waitingroom 도메인 경유

    public SeatHoldResponse hold(Long userId, SeatHoldRequest request) {
        // ① 대기열 우회 차단 — 이게 없으면 대기실이 무의미해집니다
        waitingRoomService.validateEntryToken(request.entryToken(), request.sessionId(), userId);

        // ② 좌석이 실제로 예매 가능한 상태인지 (performance 의 Service 경유)
        sessionSeatService.validateAvailable(request.sessionId(), request.sessionSeatIds());

        // ③ 정렬 순서대로 락 획득
        List<Long> sortedIds = request.sessionSeatIds().stream().sorted().toList();
        List<Long> acquired = new ArrayList<>();

        for (Long seatId : sortedIds) {
            if (holdRepository.tryHold(seatId, userId)) {
                acquired.add(seatId);
            } else {
                acquired.forEach(id -> holdRepository.release(id, userId));   // ④ 전량 롤백
                throw new BusinessException(BookingErrorCode.SEAT_ALREADY_HELD);
            }
        }

        return new SeatHoldResponse(sortedIds, OffsetDateTime.now().plusMinutes(7));
    }
}
```

> **주의**: `@Transactional`을 붙이지 마세요. 이 메서드는 DB를 쓰지 않고 Redis만 다룹니다. **Redis는 트랜잭션 롤백 대상이 아닙니다** — DB 트랜잭션이 롤백돼도 Redis에 쓴 값은 그대로 남습니다. Redis와 DB를 한 메서드에서 섞으면 정합성이 깨집니다.

### 3단계 — 선점 해제 API

```java
public void releaseAll(Long userId, List<Long> sessionSeatIds) {
    sessionSeatIds.forEach(id -> holdRepository.release(id, userId));
}
```

TTL이 있으니 해제 API가 없어도 결국 풀리지만, **사용자가 좌석을 바꾸려 할 때 7분을 기다리게 할 수는 없습니다.**

## (2) 예매 확정 흐름 — 왜 이 순서인가

```
1. 입장 토큰 검증 (waitingroom)
2. 좌석 락 소유 확인 (내가 잡은 좌석이 맞는가)
3. ── 트랜잭션 T1 ──  booking INSERT(PENDING) → booking_seat INSERT(ACTIVE)
                      ★ 여기서 uq_booking_seat_active 위반 = 중복 예매 → 즉시 거절
4. Mock 결제 호출 (A의 PaymentService)   ← 트랜잭션 밖!
                      실패하면 T1 되돌림 (booking/booking_seat → CANCELLED)
5. ── 트랜잭션 T2 ──  payment INSERT → booking CONFIRMED → session_seat SOLD
6. 커밋 후: Redis 락 해제 + Kafka 이벤트 발행
```

### 이 순서의 핵심 (면접에서 설명할 수 있어야 합니다)

**중복 예매 검증(3번)을 결제(4번)보다 앞에 뒀습니다.** 그래서 "결제는 성공했는데 좌석은 남에게 뺏긴" 상태가 **구조적으로 발생할 수 없습니다.** 결제 실패 시 되돌릴 것은 DB 안의 상태뿐이고, 이건 DB 안에서 끝납니다.

반대로 "결제 먼저 → 예매 생성" 순서였다면, 결제 후 좌석이 이미 팔린 것을 발견하면 **환불이라는 외부 시스템 보상**이 필요해집니다. 애초에 `payment.booking_id`가 NOT NULL FK라 물리적으로도 불가능한 순서입니다.

### 왜 트랜잭션을 T1/T2 두 개로 나누나

결제 호출(수백 ms~수 초)이 트랜잭션 안에 들어가면 그동안 **DB 커넥션을 붙잡고 있습니다.** 동시 접속이 몰리는 프로젝트에서 이건 커넥션 풀 고갈로 직결됩니다.

## ⚠️ 함정 ④ — 클래스를 나눠야 T1/T2가 실제로 동작합니다

```java
// ❌ 이렇게 하면 T1, T2 트랜잭션이 전혀 동작하지 않습니다
@Service
public class BookingService {
    public void confirm() {
        createPending();     // 자기 자신 호출 → 프록시를 안 거침 → @Transactional 무시됨
        payment.pay();
        finalize();
    }
    @Transactional public void createPending() { ... }
    @Transactional public void finalize() { ... }
}
```

Spring의 `@Transactional`은 **프록시**로 동작합니다. 같은 클래스 안에서 호출하면 프록시를 거치지 않아 어노테이션이 무시됩니다. **에러도 안 나고 조용히 트랜잭션 없이 실행됩니다.** 나중에 "롤백이 안 된다"로 발견하게 됩니다.

### 해결: Facade(흐름) + TransactionService(트랜잭션) 분리

| 클래스 | `@Transactional` | 역할 |
|---|---|---|
| `BookingFacade` | **없음** | 1~6단계 흐름 조율 |
| `BookingTransactionService` | 메서드마다 있음 | `createPending()`(T1) / `cancelPending()`(보상) / `confirmBooking()`(T2) |

```java
// domain/booking/service/BookingFacade.java  ← @Transactional 없음! 흐름만 담당
@Service
@RequiredArgsConstructor
public class BookingFacade {

    private final SeatHoldRedisRepository holdRepository;
    private final BookingTransactionService txService;      // ★ 별도 빈
    private final PaymentService paymentService;            // A 제공
    private final WaitingRoomService waitingRoomService;
    private final ApplicationEventPublisher eventPublisher;

    public BookingResponse confirm(Long userId, BookingCreateRequest request) {
        // 1. 입장 토큰 검증
        waitingRoomService.validateEntryToken(request.entryToken(), request.sessionId(), userId);

        // 2. 내가 잡은 좌석이 맞는지 확인
        List<Long> seatIds = request.sessionSeatIds().stream().sorted().toList();
        for (Long seatId : seatIds) {
            if (!holdRepository.isHeldBy(seatId, userId)) {
                throw new BusinessException(BookingErrorCode.SEAT_HOLD_EXPIRED);
            }
        }

        // 3. T1 — PENDING 예매 생성 (여기서 중복 예매가 걸러짐)
        Long bookingId = txService.createPending(userId, request.sessionId(), seatIds);

        // 4. 결제 (트랜잭션 밖) — A의 Mock 결제 호출
        PaymentResult result;
        try {
            result = paymentService.pay(bookingId, ...);
        } catch (Exception e) {
            txService.cancelPending(bookingId);       // T1 되돌리기
            throw new BusinessException(BookingErrorCode.PAYMENT_FAILED);
        }
        if (!result.success()) {
            txService.cancelPending(bookingId);
            throw new BusinessException(BookingErrorCode.PAYMENT_FAILED);
        }

        // 5. T2 — 결제 기록 + 확정 + 좌석 SOLD
        BookingResponse response = txService.confirmBooking(bookingId, result);

        // 6. 커밋 이후 — 락 해제
        seatIds.forEach(id -> holdRepository.release(id, userId));

        // Kafka 발행은 이벤트로 위임 (9~10주차)
        eventPublisher.publishEvent(new BookingConfirmedEvent(...));

        return response;
    }
}
```

```java
// domain/booking/service/BookingTransactionService.java  ← 트랜잭션만 담당
@Service
@RequiredArgsConstructor
public class BookingTransactionService {

    private final BookingRepository bookingRepository;
    private final BookingSeatRepository bookingSeatRepository;
    private final SessionSeatService sessionSeatService;     // performance 도메인 경유
    private final PaymentRepository paymentRepository;

    /** T1 — 결제 전. 여기서 중복 예매가 물리적으로 차단된다 */
    @Transactional
    public Long createPending(Long userId, Long sessionId, List<Long> seatIds) {
        List<SeatPriceInfo> seats = sessionSeatService.findForBooking(sessionId, seatIds);
        int totalAmount = seats.stream().mapToInt(SeatPriceInfo::price).sum();

        Booking booking = Booking.builder()
                .bookingNumber(generateBookingNumber())
                .userId(userId)
                .sessionId(sessionId)
                .totalAmount(totalAmount)
                .status(BookingStatus.PENDING)
                .expiresAt(OffsetDateTime.now().plusMinutes(5))
                .build();

        try {
            bookingRepository.save(booking);
            bookingSeatRepository.saveAll(toBookingSeats(booking, seats));
            bookingSeatRepository.flush();          // ★ 여기서 즉시 제약 위반을 확인
        } catch (DataIntegrityViolationException e) {
            // uq_booking_seat_active 위반 = 이미 다른 사람이 확정한 좌석
            throw new BusinessException(BookingErrorCode.SEAT_ALREADY_BOOKED);
        }
        return booking.getId();
    }

    /** 결제 실패 시 T1 되돌리기 */
    @Transactional
    public void cancelPending(Long bookingId) {
        Booking booking = findBooking(bookingId);
        booking.cancel();
        bookingSeatRepository.cancelAllByBookingId(bookingId);   // ACTIVE → CANCELLED
    }

    /** T2 — 결제 성공 후 확정 */
    @Transactional
    public BookingResponse confirmBooking(Long bookingId, PaymentResult result) {
        Booking booking = findBooking(bookingId);
        paymentRepository.save(Payment.success(booking, result));
        booking.confirm();
        sessionSeatService.markAsSold(seatIdsOf(bookingId));      // ★ performance 의 Service 경유
        return BookingResponse.from(booking);
    }
}
```

### 여기서 배울 포인트 4가지

1. **`flush()`를 명시적으로 호출하는 이유** — JPA는 보통 커밋 시점에 INSERT를 보냅니다. 그러면 `DataIntegrityViolationException`이 메서드 밖에서 터져 `catch`가 안 잡힙니다. `flush()`로 그 자리에서 쿼리를 보내야 잡을 수 있습니다.
2. **`uq_booking_seat_active`가 진짜 방어선** — Redis 락은 "대부분의 경우 빠르게 막는" 장치이고, 네트워크 지연·TTL 만료·Redis 장애에서는 뚫립니다. **DB 유니크 제약은 절대 뚫리지 않습니다.** "락이 있으니 제약은 없어도 되지 않나?"는 틀린 생각입니다.
3. **`session_seat` 변경은 `SessionSeatService` 경유** — `booking`에서 `SessionSeatRepository`를 직접 주입하면 `CLAUDE.md` 규칙 위반입니다.
4. **락 해제는 커밋 이후** — 해제 후 커밋하면 그 사이에 남이 좌석을 잡을 수 있습니다.

## (3) PENDING 만료 스케줄러

결제를 안 끝내고 브라우저를 닫으면 `booking`이 PENDING으로 영원히 남고 좌석이 잠깁니다.

```java
@Component
@RequiredArgsConstructor
public class BookingExpirationScheduler {

    @Scheduled(fixedDelay = 60_000)     // 1분마다
    @Transactional
    public void expirePendingBookings() {
        List<Booking> expired = bookingRepository
                .findAllByStatusAndExpiresAtBefore(BookingStatus.PENDING, OffsetDateTime.now());
        expired.forEach(b -> {
            b.cancel();
            bookingSeatRepository.cancelAllByBookingId(b.getId());
        });
    }
}
```

> **`session_seat`는 건드리지 않습니다.** T2에서만 SOLD가 되므로 PENDING 예매의 좌석은 여전히 `AVAILABLE`입니다. `booking_seat`만 CANCELLED로 바꾸면 부분 유니크 인덱스가 풀려 좌석이 자동 반환됩니다. **이게 `session_seat`에 HELD를 두지 않은 설계의 보상입니다.**

## (4) 취소 API

`DELETE /api/bookings/{id}` — 되돌릴 곳이 **3군데**입니다.

```java
@Transactional
public void cancel(Long userId, Long bookingId) {
    Booking booking = findBooking(bookingId);
    if (!booking.getUserId().equals(userId)) {                 // ★ 남의 예매 취소 차단
        throw new BusinessException(CommonErrorCode.FORBIDDEN);
    }
    booking.cancel();                                          // ① booking
    bookingSeatRepository.cancelAllByBookingId(bookingId);     // ② booking_seat
    sessionSeatService.markAsAvailable(seatIds);               // ③ session_seat (Service 경유)
}
```

**소유자 확인을 빼먹지 마세요.** 경로의 `{id}`만 보고 취소하면 남의 예매를 취소할 수 있습니다.

## 완료 확인

```bash
# 같은 좌석에 두 번 요청 → 두 번째는 409
curl -X POST localhost:8080/api/bookings/seats/hold \
  -H "Authorization: Bearer {token}" -H "Content-Type: application/json" \
  -d '{"sessionId":1,"sessionSeatIds":[10,11],"entryToken":"..."}'

# Redis 에서 확인
docker compose exec redis redis-cli KEYS "seat:hold:*"
docker compose exec redis redis-cli TTL "seat:hold:10"     # 남은 TTL(초)
```

**PR**: `feat: 좌석 선점/해제 API 및 Redis 분산 락 구현` / `feat: 예매 확정/취소 트랜잭션 구현`

**완료 기준**: 동일 좌석 동시 요청 시 정확히 1건만 성공

---

# 9~10주차 — Kafka + `notification` + 예매 내역 + 동시성 테스트 → SP5

## (1) Day 1: 이벤트 DTO 먼저 확정

**`global/event/` 중립 패키지**에 둡니다. `booking`(발행)과 `notification`(소비) 모두 B 소유이지만 **서로 다른 도메인 패키지**이므로, 어느 한쪽에 두면 반대쪽이 남의 도메인을 import하게 됩니다.

> `global/`은 A 소유지만 `global/event/`는 **B가 채우는 자리**로 SP0에서 합의된 예외입니다(A가 1주차에 빈 패키지만 만들어 둡니다).

```java
// global/event/BookingConfirmedEvent.java
public record BookingConfirmedEvent(
        String eventId,            // ★ 멱등성 판단 기준 (UUID)
        Long bookingId,
        String bookingNumber,
        Long userId,
        Long sessionId,
        String performanceTitle,
        OffsetDateTime occurredAt
) {}
```

```java
// global/event/BookingCancelledEvent.java
public record BookingCancelledEvent(String eventId, Long bookingId, Long userId,
                                    OffsetDateTime occurredAt) {}
```

**`eventId`를 반드시 넣으세요.** Kafka는 at-least-once 전달이라 **같은 메시지가 두 번 올 수 있습니다.** 중복 판단 기준이 없으면 알림이 두 번 발송됩니다.

## (2) `notification` 테이블 마이그레이션

ERD에서 빠져 있던 테이블입니다. **타임스탬프 규칙**을 지키세요.

```sql
-- src/main/resources/db/migration/V202610151400__add_notification.sql
CREATE TABLE notification
(
    id         BIGSERIAL PRIMARY KEY,
    event_id   VARCHAR(50)  NOT NULL,
    user_id    BIGINT       NOT NULL,
    type       VARCHAR(30)  NOT NULL,
    title      VARCHAR(200) NOT NULL,
    content    TEXT,
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_notification_event UNIQUE (event_id),          -- ★ 멱등성 보장
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT ck_notification_type CHECK (type IN ('BOOKING_CONFIRMED', 'BOOKING_CANCELLED'))
);
CREATE INDEX idx_notification_user ON notification (user_id, created_at DESC);
```

`uq_notification_event`가 **consumer 멱등성의 최후 방어선**입니다. `uq_booking_seat_active`와 완전히 같은 아이디어입니다 — **코드가 아니라 DB 제약으로 보장**합니다.

> 마이그레이션을 추가했으면 `Notification` **엔티티도 함께** 만드세요.

## (3) 토픽 설계

```java
@Configuration
public class KafkaTopicConfig {

    @Bean
    public NewTopic bookingConfirmedTopic() {
        return TopicBuilder.name("booking.confirmed").partitions(3).replicas(1).build();
    }

    @Bean
    public NewTopic bookingCancelledTopic() {
        return TopicBuilder.name("booking.cancelled").partitions(3).replicas(1).build();
    }
}
```

- **`auto.create.topics.enable`에 의존하지 마세요.** 자동 생성은 파티션 수를 제어할 수 없고, 오타난 토픽명도 조용히 만들어버려 "메시지가 안 온다"의 원인 파악이 어렵습니다.
- **파티션 키는 `sessionId`**로 두면 같은 회차 이벤트가 같은 파티션에 들어가 **회차별 순서가 보장**됩니다.

## (4) Consumer

```java
@Component
@RequiredArgsConstructor
public class BookingEventConsumer {

    private final NotificationService notificationService;

    @KafkaListener(topics = "booking.confirmed", groupId = "notification")
    public void onBookingConfirmed(BookingConfirmedEvent event) {
        notificationService.createIfAbsent(event);
    }
}
```

```java
@Transactional
public void createIfAbsent(BookingConfirmedEvent event) {
    // ① 애플리케이션 레벨 중복 체크 (빠른 경로)
    if (notificationRepository.existsByEventId(event.eventId())) {
        log.info("중복 이벤트 무시: {}", event.eventId());
        return;
    }
    try {
        notificationRepository.save(Notification.bookingConfirmed(event));
    } catch (DataIntegrityViolationException e) {
        // ② 동시에 두 번 소비된 경우 — DB 제약이 막아줌 (최후 방어선)
        log.info("중복 이벤트(제약 위반) 무시: {}", event.eventId());
    }
}
```

**①만 있으면 부족합니다.** 두 스레드가 동시에 `existsByEventId`를 통과할 수 있습니다. ②의 DB 제약이 진짜 보장입니다. — **좌석 예매에서 쓰는 것과 정확히 같은 패턴**입니다.

## (5) 이벤트 발행 실패 문제

**DB 커밋은 성공했는데 Kafka 발행이 실패하면 알림이 유실됩니다.** 정석 해법은 트랜잭셔널 아웃박스 패턴(이벤트를 DB 테이블에 함께 저장하고 별도 프로세스가 발행)입니다.

**3개월 일정에서는 다음 중 하나를 고르세요.**

| 선택 | 난이도 | 비고 |
|---|---|---|
| `@TransactionalEventListener(AFTER_COMMIT)` + 실패 시 로그 | 낮음 | **MVP 권장.** "유실 가능성이 있음"을 문서에 명시 |
| 아웃박스 패턴 | 높음 | 학습 소재로는 최고. 일정에 여유가 있을 때만 |

**어느 쪽을 고르든 "왜 그렇게 했는지"를 README에 쓰세요.** 한계를 아는 것과 모르는 것은 완전히 다릅니다.

## (6) DLQ

소비 실패가 무한 재시도로 이어지면 컨슈머가 그 메시지에 갇혀 뒤의 모든 메시지가 멈춥니다.

```java
@Bean
public DefaultErrorHandler errorHandler(KafkaTemplate<Object, Object> template) {
    var recoverer = new DeadLetterPublishingRecoverer(template);   // booking.confirmed.DLT 로 이동
    return new DefaultErrorHandler(recoverer, new FixedBackOff(1000L, 2));  // 1초 간격 2회 재시도
}
```

일부러 예외를 던져 DLT로 가는지 확인하세요.

## (7) 예매 내역 API

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/api/bookings` | 내 예매 목록 (페이징, 최신순) |
| `GET` | `/api/bookings/{id}` | 예매 상세 (좌석·결제 정보 포함) |

`idx_booking_user (user_id, created_at DESC)` 인덱스가 이미 있으니 정렬은 `created_at DESC`로 하세요.

상세 조회는 `booking` → `booking_seat` → `session_seat` → `venue_seat`까지 이어져 **N+1이 발생하기 쉽습니다.** `join fetch`로 한 번에 가져오세요. `org.hibernate.SQL: debug`를 켜고 쿼리 개수를 직접 세어 확인하는 게 확실합니다.

**A가 마이페이지 화면에서 이 API를 씁니다.** 응답 스펙을 먼저 전달하세요.

## (8) 동시성 통합 테스트 ★ 포트폴리오의 핵심 산출물

이 프로젝트가 주장하는 것은 **"동시 요청에도 중복 예매 0건"**입니다. 이건 코드로 증명해야 합니다.

```java
class BookingConcurrencyTest extends IntegrationTestSupport {   // A가 3~4주차에 만든 베이스

    // ★ @Transactional 을 붙이지 마세요! 롤백되면 다른 스레드가 데이터를 못 봅니다

    @Test
    void 동일_좌석에_100명이_동시에_예매하면_1건만_성공한다() throws Exception {
        int threadCount = 100;
        ExecutorService executor = Executors.newFixedThreadPool(32);
        CountDownLatch latch = new CountDownLatch(threadCount);
        AtomicInteger success = new AtomicInteger();
        AtomicInteger fail = new AtomicInteger();

        for (int i = 0; i < threadCount; i++) {
            long userId = users.get(i).getId();
            executor.submit(() -> {
                try {
                    bookingFacade.confirm(userId, request);
                    success.incrementAndGet();
                } catch (Exception e) {
                    fail.incrementAndGet();
                } finally {
                    latch.countDown();
                }
            });
        }
        latch.await(30, TimeUnit.SECONDS);

        assertThat(success.get()).isEqualTo(1);
        assertThat(fail.get()).isEqualTo(99);

        // DB 로도 직접 검증
        assertThat(bookingSeatRepository.countActiveBySessionSeatId(seatId)).isEqualTo(1);
    }
}
```

### 꼭 해볼 것: **락을 끈 버전과 비교**

Redis 락을 건너뛰는 경로를 만들어 같은 테스트를 돌려보세요.

| 버전 | 성공 | 실패 | 관찰 |
|---|---|---|---|
| 락 없음 | 1 | 99 | DB 유니크 제약이 다 막아줌. **하지만 99개의 INSERT 시도가 DB까지 도달** |
| Redis 락 | 1 | 99 | 99개가 Redis에서 걸러져 DB 부하가 거의 없음 |

**"락이 없어도 중복은 0건이지만, 락이 있으면 DB가 훨씬 편하다"** — 이게 분산 락의 진짜 역할입니다. 이 비교표 하나가 포트폴리오 설득력을 크게 올립니다. 11주차 부하 테스트의 비교군으로도 그대로 씁니다.

> **11주차 부하 테스트용 대량 계정은 A가 만듭니다.** 필요한 계정 수와 형식을 지금 A에게 알려주세요. 11주차에 몰아서 하면 늦습니다.

## 완료 확인

```bash
# 토픽 확인
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9092

# 메시지 직접 확인
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --topic booking.confirmed --from-beginning --bootstrap-server localhost:9092
```

예매를 한 건 확정하고 → consumer 로그가 찍히고 → `notification` 테이블에 1행이 생기면 완료입니다. **같은 메시지를 두 번 보내도 1행만 생기는지**도 반드시 확인하세요.

**PR**: `feat: Kafka 이벤트 연동 및 알림 적재 구현` / `test: 좌석 예매 동시성 통합 테스트 추가`

---

# 11~12주차 — 부하 테스트 (B 리드) + 마무리

- **[B]** k6 시나리오: ① 동일 좌석 동시 요청 ② 대기실 동시 진입
- **[A]** 대량 테스트 유저/토큰 사전 생성, 결과 시각화
- **목표 수치를 미리 정하세요.** "동시 500명에서 p95 < 500ms, 중복 예매 0건" 같은 기준이 없으면 성공/실패 판정이 불가능합니다
- 검증 SQL:
  ```sql
  SELECT session_seat_id, count(*) FROM booking_seat
  WHERE status = 'ACTIVE' GROUP BY 1 HAVING count(*) > 1;
  -- 0행이어야 함
  ```
- 앱과 k6를 같은 노트북에서 돌리면 서로 자원을 뺏습니다. **"로컬 단일 머신 측정"이라는 한계를 리포트에 명시**하세요 (숨기는 것보다 훨씬 좋은 인상을 줍니다)
- **[B]** 백엔드/아키텍처 다이어그램 · 부하 리포트 문서화

---

# B가 반드시 기억할 7가지

1. **시드 데이터를 1~2주차에 끝낸다** — 없으면 B 본인의 3주차 이후가 전부 막힌다. A를 기다릴 필요도 없다
2. **좌석 ID는 정렬해서 락을 잡는다** — 데드락 방지. 이 한 줄이 없으면 동시 요청에서 교착이 난다
3. **부분 실패 시 획득한 락 전량 해제** — 좌석 증발 방지
4. **`@Transactional`은 같은 클래스 내부 호출에서 동작하지 않는다** — `BookingFacade` / `BookingTransactionService` 분리
5. **`uq_booking_seat_active`가 최후 방어선** — Redis 락은 뚫릴 수 있고 DB 제약은 안 뚫린다. 멱등성도 같은 원리(`uq_notification_event`)
6. **락 해제는 커밋 이후, 결제는 트랜잭션 밖**
7. **`ZADD NX`를 쓴다** — `add()`를 쓰면 새로고침마다 순번이 맨 뒤로 밀린다
