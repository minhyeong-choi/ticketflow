# 카탈로그 조회 API 만들기 (개발자 B / 3~4주차)

> 작성 기준일: 2026-08-03 (3주차 첫날)
> 대상: 개발자 B (dhyeom)
> 선행 문서: [00-common-workflow.md](00-common-workflow.md), [03-jpa-entity-from-sql-guide.md](03-jpa-entity-from-sql-guide.md)

이 문서는 두 가지를 담고 있습니다.

1. **지금까지 만든 코드(엔티티 12종 + 시드 데이터)에 대한 검토 결과** — 무엇이 잘 됐고 무엇을 고쳐야 하는지
2. **다음 단계인 카탈로그 조회 API 3종을 만드는 방법** — 파일 목록부터 쿼리 작성까지

---

## 0. 지금 어디에 있는가

로드맵(`docs/ROADMAP.md`)의 스캐폴딩 완료일이 2026-07-21이고, 그 주를 1주차로 세면 **오늘은 3주차 첫날**입니다.

| 주차 | 기간 | B가 할 일 | 상태 |
|---|---|---|---|
| 1~2주차 | 07/20 ~ 08/02 | 도메인 엔티티 + 시드 데이터 | ✅ 완료 |
| **3~4주차** | **08/03 ~ 08/16** | **카탈로그 조회 API + 관리자 CRUD** | **← 지금 여기** |
| 5~6주차 | 08/17 ~ | 가상 대기실 | 대기 |

**마감은 4주차 말(SP2)** 입니다. 이때까지 카탈로그 API와 OpenAPI 명세를 확정해서 A에게 넘겨야, A가 Mock 데이터로 만든 프론트 화면을 실제 API로 교체할 수 있습니다. 여기가 밀리면 A의 작업도 함께 막힙니다.

### 참고: 로드맵 문서가 실제보다 뒤처져 있습니다

`ROADMAP.md`의 "진행 현황 요약" 표에는 아직 "엔티티·인증 미착수"라고 적혀 있지만, 실제 코드를 보면 A는 이미 JWT 인증(회원가입/로그인/프로필 수정/비밀번호 변경)과 `global/` 공통 인프라를 전부 끝냈습니다. **즉 B는 지금 만드는 API에 인증을 바로 얹을 수 있습니다.** 표를 갱신해두면 다음에 상태를 다시 조사하는 수고를 덜 수 있습니다.

---

## 1. 지금까지 만든 코드 검토

### 1-1. 잘 된 점 (그대로 유지하세요)

엔티티 12종을 `V1__init.sql`과 전수 대조한 결과, 로드맵이 "반드시 막힌다"고 경고한 함정들을 정확히 피했습니다.

| 항목 | 결과 | 왜 중요한가 |
|---|---|---|
| **시간 타입** | TIMESTAMPTZ 컬럼 전부 `OffsetDateTime` (누락 0건) | `LocalDateTime`을 썼다면 앱이 기동조차 안 되거나, 통과해도 나중에 **시간이 9시간씩 밀리는 버그**가 터졌을 부분입니다 (함정②) |
| **Base 엔티티 상속** | 10/10 정확 | `created_at`+`updated_at` 둘 다 있는 테이블만 `BaseTimeEntity`, `created_at`만 있으면 `BaseCreatedEntity`, 시간 컬럼이 없으면 상속 안 함 — 이걸 틀리면 `validate`에서 앱이 안 뜹니다 (함정①) |
| **연관관계** | `@ManyToOne` 13곳 전부 `LAZY`, EAGER 0건 | `open-in-view: false` 환경에서 불필요한 조인을 막습니다 |
| **enum 매핑** | `@Enumerated(EnumType.STRING)` 8/8 적용 | 빠뜨리면 기본값이 ORDINAL(숫자 0,1,2)이라 DB에 숫자가 저장되고 CHECK 제약 위반이 납니다. **JPA 초보가 가장 자주 당하는 함정인데 하나도 안 놓쳤습니다** |
| **캡슐화** | public setter·`@Data` 0건, 전부 `@NoArgsConstructor(PROTECTED)` + `@Getter` | 엔티티 상태를 아무 데서나 바꾸지 못하게 막는 올바른 설계입니다 |
| **컬럼명·길이** | `booking_number(30)`, `poster_image_url(500)` 등 전수 일치 | — |

시드 데이터(`SeedDataRunner.java`)도 마찬가지입니다.

- **멱등성 체크** — `SELECT count(*) FROM venue > 0`이면 건너뜀. 앱을 재시작해도 데이터가 두 배로 늘지 않습니다
- **`INSERT ... SELECT` 벌크 방식** — 로드맵 함정⑤(엔티티가 `IDENTITY` 전략이라 `saveAll()`을 써도 JDBC 배치가 동작하지 않음)를 정확히 회피했습니다. 7,200행이 네트워크를 한 번도 건너오지 않습니다
- **`booking_open_at`을 과거/5분 후/내일로 섞음** — 5~6주차 대기실 테스트용 준비까지 되어 있습니다

### 1-2. 고쳐야 할 것

아래 6가지는 **카탈로그 API를 만들기 전에 정리**하는 것이 좋습니다. 지금은 조회 기능만 있어서 드러나지 않지만, 관리자 CRUD와 7~8주차 예매 구현에서 반드시 터집니다.

#### ① `Performance.create()`가 `status`를 파라미터로 받습니다

```java
// Performance.java:188 — 필드에 기본값이 있지만
private PerformanceStatus status = PerformanceStatus.SCHEDULED;

// Performance.java:205 — 생성자가 그 값을 덮어씁니다
this.status = status;
```

`create(...)`가 `status`를 그대로 받아 대입하므로 **필드 초기값은 죽은 코드**입니다. 호출자가 `null`을 넘기면 `status VARCHAR(20) NOT NULL` 위반으로 INSERT가 실패합니다.

다른 엔티티(`PerformanceSession`, `Booking`, `BookingSeat`)는 전부 생성자에서 초기 상태를 강제하는데 **여기만 예외**입니다. 지금은 시드가 SQL로 직접 INSERT해서 엔티티 생성자를 안 타기 때문에 문제가 안 보이지만, 관리자 CRUD(FR-M1)에서 공연을 생성하는 순간 터집니다.

```java
// 이렇게 고칩니다 — status는 항상 SCHEDULED로 시작하고, 파라미터에서 뺍니다
@Column(name = "status", length = 20, nullable = false)
private PerformanceStatus status = PerformanceStatus.SCHEDULED;

// 상태 변경은 별도 메서드로
public void openSale() { this.status = PerformanceStatus.ON_SALE; }
public void close()    { this.status = PerformanceStatus.CLOSED; }
```

#### ② `Performance.status`에 `nullable = false`가 빠져 있습니다

`Performance.java:184-188`. NOT NULL 컬럼 중 유일하게 누락됐습니다. Hibernate의 `validate`는 nullability까지는 검사하지 않아서 앱은 뜨지만, ①번 버그를 애플리케이션 레벨에서 잡아줄 마지막 방어선이 사라진 상태입니다.

#### ③ `BookingSeat`에 `cancel()`이 없습니다 — 좌석이 영원히 잠깁니다

이게 **가장 중요한 문제**입니다. `V1__init.sql:196`을 보세요.

```sql
CREATE UNIQUE INDEX uq_booking_seat_active
    ON booking_seat (session_seat_id) WHERE status = 'ACTIVE';
```

이 부분 유니크 인덱스는 "취소되지 않은 예매는 좌석당 1건만"을 강제합니다. 즉 **좌석을 다시 팔 수 있느냐 없느냐가 전적으로 `booking_seat.status`에 달려 있습니다.**

그런데 현재 코드는:

```java
// Booking.java:76 — booking 자신만 CANCELLED로 바꿉니다
public void cancel() {
    this.status = BookingStatus.CANCELLED;
    this.cancelledAt = OffsetDateTime.now();
}

// BookingSeat.java — 상태 변경 메서드가 아예 없습니다 (생성자에서 ACTIVE 고정 후 불변)
```

예매를 취소해도 `booking_seat`는 `ACTIVE`로 남고, 그 좌석은 **다시 팔 수 없게 됩니다.**

```java
// BookingSeat.java에 추가
public void cancel() {
    this.status = BookingSeatStatus.CANCELLED;
}
```

그리고 `Booking.cancel()`에서 보유한 `BookingSeat`들에 전파하거나, 서비스 계층에서 둘 다 처리하도록 해야 합니다.

#### ④ `PerformanceSessionSeat`에 `markAsSold()`가 없습니다

```java
// PerformanceSessionSeat.java:173 — status 필드는 있는데
private PerformanceSessionSeatStatus status;
// AVAILABLE → SOLD 로 바꾸는 메서드가 없습니다. setter도 없습니다(의도는 좋음)
```

즉 **현재로선 어떤 방법으로도 "이 좌석 팔렸음"을 기록할 수 없습니다.** 이 프로젝트에서 가장 중요한 기능(좌석 선점 → 예매 확정)의 마지막 단계입니다.

```java
public void markAsSold() {
    this.status = PerformanceSessionSeatStatus.SOLD;
}
```

같은 맥락으로 `PerformanceSession`도 상태 4종(`SCHEDULED/ON_SALE/SOLD_OUT/CLOSED`)을 선언해뒀지만 전이 메서드가 없습니다. 필요할 때 추가하면 됩니다.

> **참고**: `CLAUDE.md`의 도메인 경계 규칙상 `booking`은 `SessionSeatRepository`를 직접 쓰면 안 되고 `performance`가 제공하는 `SessionSeatService.markAsSold(List<Long>)`를 호출해야 합니다. 그 서비스 메서드는 실제 호출자가 생기는 7~8주차에 만들면 되고, **지금은 엔티티 메서드만 준비**해두면 충분합니다.

#### ⑤ `Payment.booking`이 `@ManyToOne`입니다 — A에게 알려주세요

DB에는 `uq_payment_booking UNIQUE (booking_id)`가 걸려 있으므로 `@OneToOne`이 맞습니다. `optional = false`도 빠져 있습니다(`booking_id`는 NOT NULL).

**`payment`는 A 담당 도메인이므로 직접 고치지 말고 알려만 주세요.**

#### ⑥ 잔여 코드 정리

- 미사용 import — `VenueSeat.java:3`(`BaseCreatedEntity`를 import만 하고 상속 안 함), `BookingSeat.java:3`(`PerformanceSession`)
- 엔티티에 붙여넣은 DDL 주석 사본 — `BookingSeat.java:83-91`, `PerformanceSession.java:119-133`, `PerformanceSessionSeat.java:220-235`. `V1__init.sql`이 원본(SSOT)인데 사본이 여러 곳에 있으면 곧 서로 달라집니다
- `VenueSeat.rowLabel`에만 `updatable = false`가 붙어 있음 — 같은 유니크 키를 구성하는 `section`·`seatNumber`에는 없습니다. 셋 다 걸거나 셋 다 빼는 게 맞습니다

---

## 2. 시작 전에 반드시 알아야 할 것 — 프론트가 이미 API 계약을 정해놨습니다

**이 절이 이 문서에서 가장 중요합니다.**

A가 이미 `frontend/src/features/catalog/`에 공연 목록 화면을 만들어두고 `GET /api/performances`를 호출하고 있습니다. 즉 **B가 만들 응답 형태는 이미 프론트 코드에 박혀 있습니다.** 여기에 맞추지 않으면 화면이 깨집니다.

`frontend/src/features/catalog/types.ts`:

```ts
export interface PerformanceSummary {
  id: number
  title: string
  posterImageUrl: string   // null이 아니라 빈 문자열이어야 합니다
  genre: 'CONCERT' | 'MUSICAL' | 'PLAY'
  status: 'SCHEDULED' | 'ON_SALE' | 'CLOSED'
  venueName: string        // venue 테이블 조인 필요
  periodStart: string      // 회차 중 최초 공연일 (session 집계)
  periodEnd: string        // 회차 중 최후 공연일 (session 집계)
  minPrice: number         // 좌석 등급 중 최저가 (seat_grade 집계)
  maxPrice: number         // 좌석 등급 중 최고가 (seat_grade 집계)
}
```

여기서 나오는 제약이 3가지입니다.

### ① 응답은 배열입니다 (페이징 아님)

```ts
// frontend/src/features/catalog/api.ts
getPerformances: () => apiClient.get<PerformanceSummary[]>('/api/performances')
```

로드맵에는 "목록 (페이징)"이라고 적혀 있지만, 프론트는 `Page` 객체(`content`, `totalPages` …)를 받을 준비가 안 되어 있습니다. **지금은 배열로 맞추고**, 공연 수가 늘어나면 SP2에서 A와 합의해 페이징으로 전환하는 것이 순서상 맞습니다.

### ② 단순 엔티티 조회로는 만들 수 없습니다

`venueName`은 조인이 필요하고, `periodStart`/`periodEnd`는 `session` 테이블의 MIN/MAX, `minPrice`/`maxPrice`는 `seat_grade` 테이블의 MIN/MAX입니다. **엔티티를 그대로 반환하면 공연 수만큼 추가 쿼리가 나가는 N+1 문제가 생깁니다.** 해결책은 4-①에서 설명합니다.

### ③ `posterImageUrl`이 `null`이면 화면이 깨집니다

```tsx
// frontend/src/features/catalog/components/PerformanceCard.tsx:14
const hasImage = performance.posterImageUrl !== '' && !imageFailed
```

프론트는 **빈 문자열**로 "이미지 없음"을 판정합니다. 백엔드가 `null`을 주면 `null !== ''`이 참이 되어 `<img src={null}>`이 되고 깨진 이미지가 뜹니다.

현재 시드에도 `poster_image_url`이 채워져 있지 않습니다(스키마에는 컬럼이 있습니다). **DTO에서 `null → ""` 변환**을 해주고, 가능하면 시드에도 더미 URL을 넣어두세요.

### ④ 비로그인 상태로 호출됩니다 — 지금은 401이 납니다

`frontend/src/api/client.ts`는 토큰이 없어도 그냥 요청을 보냅니다. 그런데 현재 `SecurityConfig`는 이렇게 되어 있습니다.

```java
.requestMatchers("/api/auth/**", "/actuator/health").permitAll()
.requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
.anyRequest().authenticated()   // ← /api/performances 는 여기 걸립니다
```

**즉 API를 완벽하게 만들어도 홈 화면에서 401이 납니다.** 아래 3-1단계에서 A에게 요청해야 합니다.

---

## 3. 실행 순서

### 0단계 — 브랜치 만들고 엔티티 정리

```bash
# 현재 브랜치(feat/base-entity-performance)에 커밋되지 않은 시드 변경분이 있습니다
git add -A
git commit -m "feat: 시드 데이터에 공연 2건 및 ADMIN 계정 추가"

# 카탈로그 API는 새 브랜치에서 작업합니다 (master 직접 커밋 금지 — CLAUDE.md)
git checkout -b feature/performance-catalog-api
```

그다음 1-2절의 ①②③④⑥을 수정합니다. ⑤(Payment)는 A에게 전달만 하세요.

### 1단계 — A에게 먼저 요청 (블로킹이므로 가장 먼저)

`global/` 패키지는 A 소유 공유 기반이라 B가 임의로 바꾸면 안 됩니다(`CLAUDE.md`). **A가 다른 작업 중이면 대기가 생기므로, 코드를 짜기 전에 먼저 던져두세요.**

요청 내용:

```java
// SecurityConfig.java — 공연/회차 조회는 비로그인 공개
.requestMatchers(HttpMethod.GET, "/api/performances/**", "/api/sessions/**").permitAll()
```

함께 전달할 것: 1-2절 ⑤번(`Payment.booking`을 `@OneToOne`으로).

### 2단계 — 만들 파일 목록

```text
domain/performance/repository/PerformanceRepository.java
domain/performance/repository/PerformanceSessionRepository.java
domain/performance/repository/PerformanceSessionSeatRepository.java
domain/performance/service/PerformanceService.java
domain/performance/service/PerformanceSessionService.java
domain/performance/controller/PerformanceController.java          # /api/performances
domain/performance/controller/PerformanceSessionController.java   # /api/sessions
domain/performance/dto/PerformanceSummaryResponse.java
domain/performance/dto/PerformanceDetailResponse.java
domain/performance/dto/SessionSeatResponse.java
domain/performance/exception/PerformanceErrorCode.java
```

### 3단계 — 따라야 할 코드 패턴

A가 `user` 도메인에서 이미 패턴을 확립해뒀습니다. **새로 발명하지 말고 그대로 따라 하세요.**

| 항목 | 패턴 | 참고 파일 |
|---|---|---|
| 응답 | `return ApiResponse.success(data);` — **`ResponseEntity`를 쓰지 않습니다.** 반환 타입은 `ApiResponse<T>` | `domain/user/controller/UserController.java` |
| DTO | **`record`** + 정적 팩토리 `from(Entity)`. Lombok 안 씁니다 | `domain/user/dto/UserResponse.java` |
| Service | 조회 메서드에는 `@Transactional`을 **아예 안 붙입니다**. 변경 메서드에만 메서드 레벨로 붙입니다 | `domain/user/service/UserService.java` |
| 예외 | `throw new BusinessException(PerformanceErrorCode.XXX)` — 예외 핸들러는 전역에 이미 있으니 **새로 만들지 마세요** | `global/exception/GlobalExceptionHandler.java` |
| Repository | `interface extends JpaRepository<T, Long>` — `@Repository` 안 붙입니다 | `domain/user/repository/UserRepository.java` |
| 주입 | `@RequiredArgsConstructor` + `private final` (`@Autowired` 안 씁니다) | 전역 |

`ApiResponse`의 정확한 시그니처는 아래가 전부입니다. `of()`나 `ok()` 같은 메서드는 **없습니다**.

```java
ApiResponse.success(data)          // 성공
ApiResponse.error(errorCode)       // 예외 핸들러가 사용
ApiResponse.fail(code, message)    // 예외 핸들러가 사용
```

ErrorCode는 도메인별로 파일을 나눕니다(단일 enum으로 만들면 A와 매번 충돌합니다).

```java
// domain/performance/exception/PerformanceErrorCode.java
@Getter
@RequiredArgsConstructor
public enum PerformanceErrorCode implements ErrorCode {
    PERFORMANCE_NOT_FOUND("PERFORMANCE_001", HttpStatus.NOT_FOUND, "공연을 찾을 수 없습니다."),
    SESSION_NOT_FOUND("PERFORMANCE_002", HttpStatus.NOT_FOUND, "회차를 찾을 수 없습니다.");

    private final String code;      // 필드 순서 고정
    private final HttpStatus httpStatus;
    private final String message;
}
```

컨트롤러 형태:

```java
@RestController
@RequestMapping("/api/performances")
@RequiredArgsConstructor
public class PerformanceController {

    private final PerformanceService performanceService;

    @GetMapping
    public ApiResponse<List<PerformanceSummaryResponse>> getPerformances() {
        return ApiResponse.success(performanceService.getPerformances());
    }
}
```

### 4단계 — API별 구현

#### ① `GET /api/performances` — 공연 목록

2절에서 본 것처럼 집계가 필요합니다. **JPQL DTO projection**을 쓰면 쿼리 한 번으로 끝나고 N+1이 원천 차단됩니다.

```java
// PerformanceRepository.java
@Query("""
    SELECT new com.ticket.ticketflow.domain.performance.dto.PerformanceSummaryResponse(
        p.id, p.title, p.posterImageUrl, p.genre, p.status, v.name,
        MIN(s.sessionAt), MAX(s.sessionAt), MIN(g.price), MAX(g.price))
    FROM Performance p
      JOIN p.venue v
      LEFT JOIN PerformanceSession s ON s.performance = p
      LEFT JOIN SeatGrade g ON g.performance = p
    GROUP BY p.id, p.title, p.posterImageUrl, p.genre, p.status, v.name
    ORDER BY p.id DESC
    """)
List<PerformanceSummaryResponse> findAllSummaries();
```

**초보자가 자주 막히는 지점:**

- `new` 뒤에는 **패키지 전체 경로**를 써야 합니다. `new PerformanceSummaryResponse(...)`처럼 짧게 쓰면 JPQL이 클래스를 못 찾습니다
- record의 생성자 파라미터 순서와 SELECT 절의 순서가 **정확히** 일치해야 합니다. 틀려도 컴파일은 되고 **실행할 때** 터집니다
- 회차가 아직 없는 공연도 목록에 남기려면 `LEFT JOIN`을 씁니다(`JOIN`을 쓰면 그 공연이 목록에서 사라집니다)

`null → ""` 변환은 record의 compact constructor에서 합니다.

```java
public record PerformanceSummaryResponse(
        Long id, String title, String posterImageUrl,
        PerformanceGenre genre, PerformanceStatus status, String venueName,
        OffsetDateTime periodStart, OffsetDateTime periodEnd,
        Integer minPrice, Integer maxPrice
) {
    public PerformanceSummaryResponse {   // 파라미터 목록 없는 이 형태가 compact constructor
        posterImageUrl = posterImageUrl == null ? "" : posterImageUrl;
    }
}
```

#### ② `GET /api/performances/{id}` — 상세 + 회차 목록

```java
// PerformanceService.java
public PerformanceDetailResponse getPerformance(Long id) {
    Performance performance = performanceRepository.findById(id)
            .orElseThrow(() -> new BusinessException(PerformanceErrorCode.PERFORMANCE_NOT_FOUND));

    List<PerformanceSession> sessions =
            performanceSessionRepository.findByPerformanceIdOrderBySessionAtAsc(id);

    return PerformanceDetailResponse.from(performance, sessions);
}
```

- 회차 목록은 **별도 조회**합니다. 양방향 매핑(`Performance`에 `@OneToMany`)을 새로 만들지 마세요 — 엔티티 규약이 "`@ManyToOne` 단방향 중심"입니다
- 좌석 등급(가격표)도 함께 내려주면 프론트 상세 화면에서 바로 씁니다
- ⚠️ **`open-in-view: false`이므로 LAZY 필드 접근은 반드시 서비스 메서드 안에서 끝내야 합니다.** 컨트롤러에서 `performance.getVenue().getName()`을 호출하면 `LazyInitializationException`이 납니다. DTO 변환을 서비스에서 끝내세요

#### ③ `GET /api/sessions/{id}/seats` — 좌석 배치도

**성능상 가장 중요한 API입니다.** 회차 1개당 좌석이 1,200석이고, 5~6주차에 대기실이 붙으면 통과한 사용자 전원이 동시에 이 API를 때립니다.

응답을 **2단으로 나눕니다.**

```json
{
  "success": true,
  "data": {
    "grades": [
      { "name": "VIP", "price": 180000, "total": 600, "available": 587 },
      { "name": "R",   "price": 140000, "total": 600, "available": 592 }
    ],
    "seats": [
      { "id": 1, "section": "FLOOR-A", "row": "A", "no": "1", "x": 1, "y": 1, "grade": "VIP", "status": "AVAILABLE" }
    ]
  }
}
```

- 등급별 요약만 먼저 보여주고 개별 좌석은 필요할 때 받게 하면 초기 로딩이 수 KB로 끝납니다
- **필드명을 짧게 유지**하는 것만으로도 JSON 크기가 크게 줄어듭니다. 1,200석 × 필드 8개면 통짜 JSON이 수백 KB입니다

등급별 요약 집계:

```java
@Query("""
    SELECT new com.ticket.ticketflow.domain.performance.dto.SeatGradeSummary(
        g.name, g.price, COUNT(ss),
        SUM(CASE WHEN ss.status = 'AVAILABLE' THEN 1 ELSE 0 END))
    FROM PerformanceSessionSeat ss
      JOIN ss.seatGrade g
    WHERE ss.session.id = :sessionId
    GROUP BY g.name, g.price
    """)
List<SeatGradeSummary> findGradeSummaries(@Param("sessionId") Long sessionId);
```

`V1__init.sql:137`에 `idx_session_seat_lookup (session_id, status)` 인덱스가 이미 있으므로 이 조회는 인덱스를 탑니다.

### 5단계 — OpenAPI 명세를 A에게 전달 (SP2 마감: 4주차 말)

`build.gradle`에 `springdoc-openapi-starter-webmvc-ui`는 이미 추가돼 있지만, **`@Tag`/`@Operation`을 쓴 코드는 아직 하나도 없습니다.** B가 첫 도입자가 됩니다.

```java
@Tag(name = "공연 카탈로그", description = "공연 목록/상세/좌석 조회")
@RestController
public class PerformanceController {

    @Operation(summary = "공연 목록 조회", description = "판매 중인 공연 목록을 반환합니다.")
    @GetMapping
    public ApiResponse<List<PerformanceSummaryResponse>> getPerformances() { ... }
}
```

앱을 띄우고 `http://localhost:8080/swagger-ui/index.html`에서 확인한 뒤, A가 `openapi-typescript`로 타입을 생성할 수 있도록 `/v3/api-docs`를 알려주세요. 이게 SP2의 실질적인 산출물입니다.

### 6단계 (여유가 있으면) — 관리자 카탈로그 CRUD

`FR-M1~M3` (`/api/admin/**`)는 로드맵이 **"밀리면 가장 먼저 포기할 후보"**로 명시한 P1 항목입니다. 위 5단계를 다 끝낸 뒤에 착수하세요.

이때 `SecurityConfig`에 `.requestMatchers("/api/admin/**").hasRole("ADMIN")`을 추가해야 하는데, 이것도 A와 합의가 필요합니다. 시드로 만들어 둔 `admin@ticketflow.com` 계정으로 인가 테스트를 할 수 있습니다.

---

## 4. 완료 확인

```bash
docker compose up -d
./gradlew bootRun --args='--spring.profiles.active=local'
```

```bash
# 목록
curl -s localhost:8080/api/performances | jq

# 상세
curl -s localhost:8080/api/performances/1 | jq

# 좌석
curl -s localhost:8080/api/sessions/1/seats | jq '.data | {grades: (.grades|length), seats: (.seats|length)}'
```

체크리스트:

- [ ] **비로그인 상태에서 200이 나오는가** — 401이면 3-1단계(SecurityConfig)가 아직 반영 안 된 것입니다
- [ ] `data`가 배열인가 (객체로 감싸져 있으면 프론트가 못 읽습니다)
- [ ] `venueName`, `periodStart`, `minPrice`가 `null`이 아니라 값이 채워져 있는가
- [ ] `posterImageUrl`이 `null`이 아니라 `""`인가
- [ ] 앱이 기동되는가 — `ddl-auto: validate`라서 **기동에 성공했다는 것 자체가 엔티티↔스키마 매핑이 맞다는 증거**입니다
- [ ] `./gradlew test` — 기존 `VenueSeatTest`가 깨지지 않았는가
- [ ] SQL 로그(`format_sql: true`)에서 목록 API가 **쿼리 1번**으로 끝나는가 — 공연 수만큼 쿼리가 나가면 N+1이 살아있는 것입니다
- [ ] 프론트 연동 — `cd frontend && npm run dev` 후 `localhost:5173` 홈 화면에 시드 공연 2건이 카드로 보이는가

---

## 5. 자주 만날 에러

| 증상 | 원인 | 해결 |
|---|---|---|
| `LazyInitializationException` | 컨트롤러에서 LAZY 필드에 접근 (`open-in-view: false`) | DTO 변환을 서비스 메서드 안에서 끝내기 |
| `Unable to locate class [PerformanceSummaryResponse]` | JPQL `new` 뒤에 패키지 경로를 안 씀 | 전체 경로로 작성 |
| 401 Unauthorized | `SecurityConfig`에 permitAll 미등록 | 3-1단계 참고 (A에게 요청) |
| `Schema-validation: missing column` | 엔티티와 `V1__init.sql` 불일치 | `V1__init.sql`이 정답지입니다 |
| 목록 API 응답에 공연이 하나도 안 나옴 | `JOIN`을 써서 회차 없는 공연이 제외됨 | `LEFT JOIN`으로 변경 |
| 프론트 카드에 깨진 이미지 | `posterImageUrl`이 `null` | compact constructor에서 `""`로 변환 |

막혔을 때는 **에러 메시지 첫 줄과 `Caused by:` 마지막 줄**을 먼저 읽으세요. 30분 넘게 혼자 붙잡지 말고 A에게 물어보는 편이 2인 팀에서는 훨씬 쌉니다.
