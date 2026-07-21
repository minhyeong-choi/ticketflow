# 01. 개발자 A 워크플로우 — `booking` / `payment`

> ⚠️ **역할 분담 변경 주의 (2026-07-21)**: 이 문서는 **구 분담**(A=`booking`/`payment`) 기준입니다. 현재는 `booking`이 **B** 담당으로 이관되었습니다(`payment`는 A 유지, A는 대신 프론트엔드 전체+`user`+`global`을 담당). 최신 담당은 `docs/ROADMAP.md`의 "역할 분담" 섹션을 확인하세요. 이 문서의 `booking` 관련 내용은 **B가**, `payment` 관련 내용은 **A가** 참고하면 됩니다 — 엔티티 작성법·함정 해결 방법 등 기술적 how-to는 여전히 유효합니다.

> **먼저 [00-common-workflow.md](00-common-workflow.md)를 읽으세요.** 이 문서는 그 내용을 안다고 가정합니다.

## A가 맡은 것

| 도메인 | 내용 |
|---|---|
| `domain/booking` | 좌석 선점, 예매 확정, 예매 취소, 예매 내역 |
| `domain/payment` | Mock 결제 |
| 부수 작업 | 프론트 기본 화면, Testcontainers 도입, 동시성 통합 테스트 |
| API 경로 | `/api/bookings/**`, `/api/payments/**` |

**A는 이 프로젝트에서 가장 어려운 부분(분산 락 + 다중 좌석 + 트랜잭션 분리)을 맡습니다.** 대신 3~4주차까지는 상대적으로 여유가 있으니, 그 기간에 5주차 이후를 준비하는 게 이 문서의 전략입니다.

## 전체 일정

| 주차 | 할 일 | 산출물 |
|---|---|---|
| 1~2 | **엔티티 10종 일괄 작성** + API 문서화 도구 | 앱이 뜬다 = 스키마 정합성 증명 |
| 3~4 | 프론트 기본 화면 + Testcontainers + **Redis 락 PoC** | 락 동작 원리를 손으로 확인 |
| 5~6 | **좌석 선점 API** (Redis TTL 락) | 동시 요청에 1건만 성공 |
| 7~8 | Mock 결제 + **예매 확정 T1/T2** + 취소 | 예매 플로우 완성 |
| 9~10 | 예매 내역 API + **동시성 통합 테스트** | "중복 예매 0건" 증명 |
| 11~12 | 부하 테스트 / 마무리 (공동) | |

---

# 1~2주차 — 엔티티 10종 일괄 작성 (기반 동결)

## 왜 A가 10개 전부 쓰는가

`ddl-auto: validate`에서는 **엔티티 하나만 스키마와 어긋나도 앱이 안 뜹니다.** A/B가 5개씩 나눠서 각자 PR을 올리면, 한쪽만 머지된 중간 상태에서 **두 사람 다 아무것도 실행하지 못합니다.** 그래서 1주차는 병렬 구간이 아니라 "기반 동결" 구간입니다.

같은 기간에 B는 `global/` 공통 인프라와 시드 데이터를 만듭니다. **파일이 겹치지 않으니 충돌 없이 병렬 진행됩니다.**

> `domain/user/entity/User.java`도 A가 작성하지만, 머지 이후 **소유권은 B**입니다. 이후 수정은 B가 합니다.

## Day 1~2: 엔티티 작성

### 작업 순서 (FK 의존 순서대로)

의존하는 쪽을 먼저 만들어야 참조할 대상이 있습니다.

```
1. Venue                 (의존 없음)
2. VenueSeat             → Venue
3. User                  (의존 없음)
4. Performance           → Venue
5. SeatGrade             → Performance
6. PerformanceSession    → Performance      ★ 클래스명 주의
7. SessionSeat           → PerformanceSession, VenueSeat, SeatGrade
8. Booking               → User, PerformanceSession
9. BookingSeat           → Booking, SessionSeat
10. Payment              → Booking
```

### 만들 파일

```
global/common/BaseCreatedEntity.java        # created_at 만 있는 테이블용
global/common/BaseTimeEntity.java           # created_at + updated_at 용

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

domain/user/entity/User.java
domain/user/entity/Role.java

domain/booking/entity/Booking.java
domain/booking/entity/BookingStatus.java
domain/booking/entity/BookingSeat.java
domain/booking/entity/BookingSeatStatus.java

domain/payment/entity/Payment.java
domain/payment/entity/PaymentStatus.java
```

> `Venue`, `VenueSeat`는 `performance` 도메인에 둡니다. 공연장은 B의 공연 카탈로그에 속한 마스터 데이터이고, 별도 패키지를 만들면 소유가 애매해집니다.

### 반드시 지킬 것 (00번 문서 3장 요약)

- `@Table(name = "users")` — 클래스명과 테이블명이 다르면 명시
- `TIMESTAMPTZ` → **`OffsetDateTime`**
- 시간 컬럼 유무에 따라 `BaseTimeEntity` / `BaseCreatedEntity` / 상속 없음 (00번 문서의 표를 그대로 따르세요)
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

`Started TicketflowApplication in X seconds`가 뜨면 **엔티티 10종이 스키마와 100% 일치한다는 증명**입니다. 이 로그를 PR 본문에 붙이세요.

에러가 나면 00번 문서의 [에러 표](00-common-workflow.md#11-자주-만나는-에러와-읽는-법)를 보세요. 대부분 `missing column` 또는 `wrong column type`이고, `V1__init.sql`과 한 줄씩 대조하면 5분 안에 찾습니다.

**PR**: `feat: JPA 엔티티 10종 및 공통 시간 매핑 클래스 추가` → B 리뷰 후 즉시 머지

---

## Day 3~5: API 문서 도구 도입 (springdoc-openapi)

로드맵상 3~4주차 항목이지만 **1~2주차로 당깁니다.** 이유는 문서화가 아니라 **A와 B 사이의 인터페이스 계약** 때문입니다. 2인 병렬 개발에서 API 스펙은 문서가 아니라 "개발 순서를 푸는 도구"입니다.

```gradle
// build.gradle
implementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.5'
```

> 버전은 Spring Boot 4.x 호환 최신 버전을 확인하고 넣으세요. 호환이 안 되면 **억지로 맞추지 말고 넘어가세요.** 대신 `docs/api.md`에 요청/응답 예시를 손으로 적는 것으로 대체합니다. 목적은 도구가 아니라 "상대가 내 API 스펙을 미리 아는 것"입니다.

기동 후 `http://localhost:8080/swagger-ui.html` 접속 확인.

**PR**: `chore: springdoc-openapi 도입 및 Swagger UI 설정`

---

# 3~4주차 — 프론트 기본 화면 + Testcontainers + Redis 락 PoC

이 기간에 B는 조회 API를 만듭니다. A는 **5주차 좌석 선점을 위한 준비**에 집중하세요. 여기서 준비를 안 하면 5주차에 Redis를 처음 만지면서 동시에 분산 락을 설계해야 하는 최악의 상황이 됩니다.

## (1) Testcontainers 도입 — 최우선

### 문제

지금은 `docker compose up -d`를 안 하면 `./gradlew build`가 실패합니다. 테스트가 실제 Postgres에 붙기 때문입니다. 팀원이 clone하고 바로 빌드하면 깨지고, CI에서도 service container를 따로 띄워야 합니다.

### 해결

테스트가 **스스로** 컨테이너를 띄우게 만듭니다.

```gradle
// build.gradle
testImplementation 'org.springframework.boot:spring-boot-testcontainers'
testImplementation 'org.testcontainers:junit-jupiter'
testImplementation 'org.testcontainers:postgresql'
```

```java
// src/test/java/com/ticket/ticketflow/support/IntegrationTestSupport.java
@SpringBootTest
@Testcontainers
public abstract class IntegrationTestSupport {

    @Container
    @ServiceConnection                       // ★ 이것만으로 datasource URL이 자동 주입됨
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @Container
    @ServiceConnection
    static GenericContainer<?> redis = new GenericContainer<>("redis:7").withExposedPorts(6379);
}
```

`@ServiceConnection`이 컨테이너의 랜덤 포트를 알아서 `spring.datasource.url`에 연결해줍니다. 예전처럼 `@DynamicPropertySource`로 직접 주입할 필요가 없습니다.

이후 모든 통합 테스트는 이 클래스를 상속합니다.

```java
class BookingServiceTest extends IntegrationTestSupport { ... }
```

### 완료 후

- `docker compose` 없이 `./gradlew build`가 성공하는지 확인
- 성공하면 `.github/workflows/ci.yml`의 `services:` 블록을 제거 (더 이상 필요 없음)

**PR**: `test: Testcontainers 도입 및 CI service container 제거`

> Docker Desktop이 실행 중이어야 합니다. 첫 실행은 이미지 다운로드로 몇 분 걸립니다.

## (2) Redis 락 PoC — 5주차 준비의 핵심

**5주차에 처음 Redis를 만지면 늦습니다.** 지금 작은 실험으로 원리를 확인해 두세요.

### 먼저 알아야 할 것: 왜 `RLock`이 아닌가 ★★★

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

정리하면:

| 상황 | 쓸 것 |
|---|---|
| 한 요청 안에서 시작·종료되는 짧은 임계 구역 | `RLock` (Redisson) |
| **요청을 넘어 유지되는 점유** (= 좌석 선점) | **`SET key value NX PX ttl`** (소유자 값 비교 방식) |

우리 좌석 선점은 후자입니다. 그래서 다음 형태를 씁니다.

```
키:   seat:hold:{sessionSeatId}
값:   {userId}                     ← "누가 잡았는지"를 값에 기록
TTL:  7분
```

- **획득** = `SET seat:hold:12 100 NX EX 420` → 성공하면 내가 주인
- **확인** = `GET seat:hold:12` 값이 내 userId인가
- **해제** = 값이 내 것일 때만 삭제 (Lua로 원자적 처리)

### PoC로 만들 것

```
global/config/RedisConfig.java              # StringRedisTemplate 설정
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

테스트로 확인하세요.

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

**PR**: `feat: Redis 좌석 선점 락 저장소 PoC 구현`

## (3) 프론트 기본 화면

B의 조회 API에 맞춰 목록/상세/좌석 배치도 화면을 AI 도구로 생성합니다.

- **위치 결정 필요**: 같은 레포 `frontend/` 하위 vs 별도 레포 (팀 합의 사항, 로드맵 미결정)
- **CORS 설정**이 필요합니다. B의 `SecurityConfig`에 추가해야 하므로 B에게 요청하세요 (`global/`은 공유 기반이라 임의 수정 금지)
- AI 생성 코드도 **PR 리뷰 대상**입니다. 읽지 않고 머지하지 마세요

---

# 5~6주차 — 좌석 선점 API ★ 핵심 구간

## 시작 전 체크

- [ ] `build.gradle`의 `redisson-spring-boot-starter` 주석 해제 (필요 시)
- [ ] B에게 **대기실 입장 토큰 검증 메서드 시그니처**를 받았는가? (없으면 지금 요청 → 껍데기라도 커밋해달라고 하세요)
- [ ] B에게 **`SessionSeatService` 조회/변경 시그니처**를 받았는가?
- [ ] **락 TTL을 B와 함께 결정했는가?** (아래 참고)

### A/B가 함께 결정해야 하는 유일한 수치

```
대기실 입장 토큰 TTL   >   좌석 락 TTL   >   결제 제한 시간
       (예: 15분)            (예: 7분)          (예: 5분)
```

**순서가 뒤집히면 버그가 납니다.**
- 락 TTL < 결제 시간 → 결제 중에 락이 풀려 남이 같은 좌석을 잡습니다
- 입장 토큰 TTL < 락 TTL → 좌석은 잡았는데 입장 자격이 만료되어 확정을 못 합니다

## 만들 파일

```
domain/booking/controller/SeatHoldController.java
domain/booking/service/SeatHoldService.java
domain/booking/service/SeatHoldRedisRepository.java     # 3~4주차 PoC 승격
domain/booking/dto/SeatHoldRequest.java
domain/booking/dto/SeatHoldResponse.java
domain/booking/exception/BookingErrorCode.java
```

## API 설계

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

## 구현 순서

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
    private final SessionSeatService sessionSeatService;      // B 제공
    private final WaitingRoomService waitingRoomService;      // B 제공

    public SeatHoldResponse hold(Long userId, SeatHoldRequest request) {
        // ① 대기열 우회 차단 — 이게 없으면 대기실이 무의미해집니다
        waitingRoomService.validateEntryToken(request.entryToken(), request.sessionId(), userId);

        // ② 좌석이 실제로 예매 가능한 상태인지 (B의 Service 경유)
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

**PR**: `feat: 좌석 선점/해제 API 및 Redis 분산 락 구현`

---

# 7~8주차 — Mock 결제 + 예매 확정 + 취소 ★ 최난도 구간

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

> **순차 번호(`V2__`)를 쓰지 마세요.** A와 B가 각자 브랜치에서 `V2__`를 만들면 머지 시점에 반드시 깨집니다. 타임스탬프는 충돌하지 않습니다.

마이그레이션을 추가했으면 **엔티티에도 `expiresAt` 필드를 추가**해야 합니다(안 그러면 validate는 통과하지만 코드에서 못 씁니다).

## 예매 확정 흐름 — 왜 이 순서인가

```
1. 입장 토큰 검증 (B의 Service)
2. 좌석 락 소유 확인 (내가 잡은 좌석이 맞는가)
3. ── 트랜잭션 T1 ──  booking INSERT(PENDING) → booking_seat INSERT(ACTIVE)
                      ★ 여기서 uq_booking_seat_active 위반 = 중복 예매 → 즉시 거절
4. Mock 결제 호출     ← 트랜잭션 밖!
                      실패하면 T1 되돌림 (booking/booking_seat → CANCELLED)
5. ── 트랜잭션 T2 ──  payment INSERT → booking CONFIRMED → session_seat SOLD
6. 커밋 후: Redis 락 해제 + Kafka 이벤트 발행
```

### 이 순서의 핵심 (면접에서 설명할 수 있어야 합니다)

**중복 예매 검증(3번)을 결제(4번)보다 앞에 뒀습니다.** 그래서 "결제는 성공했는데 좌석은 남에게 뺏긴" 상태가 **구조적으로 발생할 수 없습니다.** 결제 실패 시 되돌릴 것은 DB 안의 상태뿐이고, 이건 DB 안에서 끝납니다.

반대로 "결제 먼저 → 예매 생성" 순서였다면, 결제 후 좌석이 이미 팔린 것을 발견하면 **환불이라는 외부 시스템 보상**이 필요해집니다. 애초에 `payment.booking_id`가 NOT NULL FK라 물리적으로도 불가능한 순서입니다.

### 왜 트랜잭션을 T1/T2 두 개로 나누나

결제 호출(수백 ms~수 초)이 트랜잭션 안에 들어가면 그동안 **DB 커넥션을 붙잡고 있습니다.** 동시 접속이 몰리는 프로젝트에서 이건 커넥션 풀 고갈로 직결됩니다.

## ★ 구현상 가장 큰 함정: 클래스를 나눠야 합니다

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

Spring의 `@Transactional`은 **프록시**로 동작합니다. 같은 클래스 안에서 호출하면 프록시를 거치지 않아 어노테이션이 무시됩니다. **에러도 안 나고 조용히 트랜잭션 없이 실행됩니다.**

### 해결: Facade(흐름) + TransactionService(트랜잭션) 분리

```java
// domain/booking/service/BookingFacade.java  ← @Transactional 없음! 흐름만 담당
@Service
@RequiredArgsConstructor
public class BookingFacade {

    private final SeatHoldRedisRepository holdRepository;
    private final BookingTransactionService txService;      // ★ 별도 빈
    private final PaymentService paymentService;
    private final WaitingRoomService waitingRoomService;    // B 제공
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

        // 4. 결제 (트랜잭션 밖)
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

        // Kafka 발행은 이벤트로 위임 (7~10주차 B와 연동)
        eventPublisher.publishEvent(new BookingConfirmedEvent(bookingId, ...));

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
    private final SessionSeatService sessionSeatService;     // B 제공
    private final PaymentRepository paymentRepository;

    /** T1 — 결제 전. 여기서 중복 예매가 물리적으로 차단된다 */
    @Transactional
    public Long createPending(Long userId, Long sessionId, List<Long> seatIds) {
        List<SeatPriceInfo> seats = sessionSeatService.findForBooking(sessionId, seatIds);  // B 제공
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
        sessionSeatService.markAsSold(seatIdsOf(bookingId));      // ★ B의 Service 경유
        return BookingResponse.from(booking);
    }
}
```

### 여기서 배울 포인트 4가지

1. **`flush()`를 명시적으로 호출하는 이유** — JPA는 보통 커밋 시점에 INSERT를 보냅니다. 그러면 `DataIntegrityViolationException`이 메서드 밖에서 터져 `catch`가 안 잡힙니다. `flush()`로 그 자리에서 쿼리를 보내야 잡을 수 있습니다.
2. **`uq_booking_seat_active`가 진짜 방어선** — Redis 락은 "대부분의 경우 빠르게 막는" 장치이고, 네트워크 지연·TTL 만료·Redis 장애에서는 뚫립니다. **DB 유니크 제약은 절대 뚫리지 않습니다.** "락이 있으니 제약은 없어도 되지 않나?"는 틀린 생각입니다.
3. **`session_seat` 변경은 B의 Service 경유** — `SessionSeatRepository`를 직접 주입하면 `CLAUDE.md` 규칙 위반입니다.
4. **락 해제는 커밋 이후** — 해제 후 커밋하면 그 사이에 남이 좌석을 잡을 수 있습니다.

## Mock 결제

```java
// domain/payment/service/PaymentService.java
@Service
public class PaymentService {

    public PaymentResult pay(Long bookingId, int amount) {
        // 실제 PG 대신 즉시 성공 응답. transaction_id 는 UUID 로 발급해두면
        // 나중에 실 PG 연동 시 구조가 그대로 유지된다.
        return new PaymentResult(true, UUID.randomUUID().toString(), OffsetDateTime.now());
    }
}
```

**실패 케이스를 테스트할 수 있게 만드세요.** 예: 금액이 특정 값이면 실패 반환, 또는 `local` 프로필 설정으로 실패율 지정. 실패 경로를 한 번도 안 돌려보면 4번 롤백 코드가 동작하는지 알 수 없습니다.

## PENDING 만료 스케줄러

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

`@Scheduled`를 쓰려면 설정 클래스에 `@EnableScheduling`이 필요합니다.

> **`session_seat`는 건드리지 않습니다.** T2에서만 SOLD가 되므로 PENDING 예매의 좌석은 여전히 `AVAILABLE`입니다. `booking_seat`만 CANCELLED로 바꾸면 부분 유니크 인덱스가 풀려 좌석이 자동 반환됩니다. **이게 `session_seat`에 HELD를 두지 않은 설계의 보상입니다.**

## 취소 API

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
    sessionSeatService.markAsAvailable(seatIds);               // ③ session_seat (B 경유)
}
```

**소유자 확인을 빼먹지 마세요.** 경로의 `{id}`만 보고 취소하면 남의 예매를 취소할 수 있습니다.

**PR**: `feat: Mock 결제 및 예매 확정/취소 트랜잭션 구현`

---

# 9~10주차 — 예매 내역 API + 동시성 통합 테스트

## (1) 예매 내역 API

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/api/bookings` | 내 예매 목록 (페이징, 최신순) |
| `GET` | `/api/bookings/{id}` | 예매 상세 (좌석·결제 정보 포함) |

`idx_booking_user (user_id, created_at DESC)` 인덱스가 이미 있으니 정렬은 `created_at DESC`로 하세요.

상세 조회는 `booking` → `booking_seat` → `session_seat` → `venue_seat`까지 이어져 **N+1이 발생하기 쉽습니다.** `join fetch`로 한 번에 가져오세요. `format_sql`을 켜고 쿼리 개수를 직접 세어 확인하는 게 확실합니다.

## (2) 동시성 통합 테스트 ★ 포트폴리오의 핵심 산출물

이 프로젝트가 주장하는 것은 **"동시 요청에도 중복 예매 0건"**입니다. 이건 코드로 증명해야 합니다.

```java
class BookingConcurrencyTest extends IntegrationTestSupport {

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

**PR**: `test: 좌석 예매 동시성 통합 테스트 추가`

---

# 11~12주차 — 공동 작업

- k6 시나리오: ① 동일 좌석 동시 요청 ② 대기실 동시 진입
- **목표 수치를 미리 정하세요.** "동시 500명에서 p95 < 500ms, 중복 예매 0건" 같은 기준이 없으면 성공/실패 판정이 불가능합니다
- 검증 SQL:
  ```sql
  SELECT session_seat_id, count(*) FROM booking_seat
  WHERE status = 'ACTIVE' GROUP BY 1 HAVING count(*) > 1;
  -- 0행이어야 함
  ```
- 앱과 k6를 같은 노트북에서 돌리면 서로 자원을 뺏습니다. **"로컬 단일 머신 측정"이라는 한계를 리포트에 명시**하세요 (숨기는 것보다 훨씬 좋은 인상을 줍니다)

---

# A가 반드시 기억할 5가지

1. **좌석 ID는 정렬해서 락을 잡는다** — 데드락 방지
2. **부분 실패 시 획득한 락 전량 해제** — 좌석 증발 방지
3. **`@Transactional`은 같은 클래스 내부 호출에서 동작하지 않는다** — Facade / TransactionService 분리
4. **`uq_booking_seat_active`가 최후 방어선** — Redis 락은 뚫릴 수 있고 DB 제약은 안 뚫린다
5. **락 해제는 커밋 이후, 결제는 트랜잭션 밖**
