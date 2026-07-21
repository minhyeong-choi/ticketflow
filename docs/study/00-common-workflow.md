# 00. 공통 개발 워크플로우 (A/B 필수)

> 이 문서는 **"Spring으로 API 하나를 만든다"가 구체적으로 어떤 작업들의 연속인지**를 처음부터 설명합니다.
> 각 절은 `왜 이렇게 하는가` → `어떻게 하는가` → `틀리면 어떻게 되는가` 순서로 되어 있습니다.

---

## 목차

1. [요청 하나가 지나가는 길 (레이어 구조)](#1-요청-하나가-지나가는-길-레이어-구조)
2. [기능 하나를 만드는 8단계 사이클](#2-기능-하나를-만드는-8단계-사이클)
3. [Entity 작성법 — 이 프로젝트에서 가장 조심할 부분](#3-entity-작성법--이-프로젝트에서-가장-조심할-부분)
4. [Repository 작성법](#4-repository-작성법)
5. [DTO 작성법](#5-dto-작성법)
6. [Service 작성법과 @Transactional](#6-service-작성법과-transactional)
7. [Controller 작성법](#7-controller-작성법)
8. [공통 응답 · 예외 처리 규격](#8-공통-응답--예외-처리-규격)
9. [도메인 경계를 넘는 방법](#9-도메인-경계를-넘는-방법)
10. [Git 브랜치 · 커밋 · PR](#10-git-브랜치--커밋--pr)
11. [자주 만나는 에러와 읽는 법](#11-자주-만나는-에러와-읽는-법)
12. [테스트 작성 최소 기준](#12-테스트-작성-최소-기준)

---

## 1. 요청 하나가 지나가는 길 (레이어 구조)

`POST /api/auth/signup` 요청 하나가 서버 안에서 어떻게 흐르는지 먼저 그림으로 잡으세요. 이 그림이 머릿속에 있으면 "이 코드를 어느 파일에 써야 하지?"라는 질문의 90%가 해결됩니다.

```
[브라우저]
   │  HTTP POST /api/auth/signup  { "email": "...", "password": "..." }
   ▼
[Spring Security 필터체인]      ← JWT 검증. 화이트리스트면 그냥 통과
   │
   ▼
[Controller]  AuthController     ← HTTP를 아는 유일한 계층
   │  · JSON → SignupRequest(DTO) 변환 (Spring이 자동으로 해줌)
   │  · @Valid 로 형식 검증 (이메일 형식, 필수값)
   │  · "비즈니스 판단은 절대 안 함"
   ▼
[Service]  AuthService           ← 비즈니스 로직 + 트랜잭션 경계
   │  · 이메일 중복인가?  · 비밀번호 해싱  · 엔티티 생성
   │  · 여기서만 @Transactional 을 붙인다
   ▼
[Repository]  UserRepository     ← DB 접근. 인터페이스만 만들면 Spring이 구현
   │
   ▼
[Entity]  User → DB의 users 테이블
```

### 각 계층의 "하지 말아야 할 일" (이게 더 중요합니다)

| 계층 | 해야 할 일 | **절대 하면 안 되는 일** |
|---|---|---|
| Controller | HTTP 입출력, 형식 검증, Service 호출 | `if (userRepository.existsBy...)` 같은 판단, Repository 직접 주입, **Entity를 그대로 반환** |
| Service | 비즈니스 규칙, 트랜잭션, Entity ↔ DTO 변환 | `HttpServletRequest`·`ResponseEntity` 같은 HTTP 타입 다루기 |
| Repository | 쿼리 | 비즈니스 판단, 여러 테이블을 조합한 복잡한 계산 |
| Entity | 자기 상태를 지키는 것 | `@Setter` 열어두기, DTO 필드 섞기 |

### 왜 Entity를 Controller에서 반환하면 안 되는가 (이 프로젝트 한정 이유)

`application.yml`에 `spring.jpa.open-in-view: false`가 설정되어 있습니다. 이건 **트랜잭션이 끝나면(= Service 메서드가 리턴되면) DB 커넥션을 즉시 반납한다**는 뜻입니다.

그래서 Controller에서 Entity의 지연 로딩 필드를 건드리면:

```
org.hibernate.LazyInitializationException: could not initialize proxy - no Session
```

이 에러가 납니다. **DTO 변환은 반드시 Service 안에서 끝내세요.** (이건 취향이 아니라 이 설정에서의 필수 규칙입니다)

---

## 2. 기능 하나를 만드는 8단계 사이클

어떤 API를 만들든 **항상 이 순서**입니다. 순서를 바꾸면(예: Controller부터 만들면) 나중에 갈아엎게 됩니다.

```
0. 브랜치 생성          git switch -c feature/user-signup
1. 스키마 확인          V1__init.sql 에서 관련 테이블/제약조건 읽기
2. Entity              (없으면) 엔티티 작성 → 앱 기동으로 validate 통과 확인
3. Repository          인터페이스 + 필요한 쿼리 메서드
4. DTO                 Request(입력) / Response(출력) 분리해서 작성
5. Service             비즈니스 로직 + @Transactional + DTO 변환
6. Controller          경로 매핑 + @Valid
7. 수동 검증            앱 띄우고 curl 로 성공/실패 케이스 각각 호출
8. 테스트 + PR          테스트 작성 → ./gradlew build → push → PR
```

**1번(스키마 확인)을 건너뛰지 마세요.** 이 프로젝트는 `ddl-auto: validate`라 스키마가 절대 기준이고, 엔티티가 스키마와 다르면 **앱이 아예 뜨지 않습니다**.

---

## 3. Entity 작성법 — 이 프로젝트에서 가장 조심할 부분

### 3-1. 대전제: 스키마가 정답, 엔티티가 답안지

보통의 Spring 프로젝트는 엔티티를 쓰면 Hibernate가 테이블을 만들어줍니다(`ddl-auto: update`). **이 프로젝트는 정반대입니다.**

```yaml
spring.jpa.hibernate.ddl-auto: validate
```

- 테이블은 **Flyway**(`V1__init.sql`)가 만듭니다.
- Hibernate는 기동할 때 "엔티티와 테이블이 일치하는가"만 **검사**합니다.
- 하나라도 어긋나면 → `SchemaManagementException` → **앱 기동 실패**.

무섭게 들리지만 실제로는 **선물**입니다. 오타나 타입 실수를 배포 후가 아니라 기동 3초 만에 잡아주니까요.

### 3-2. 스키마 → 엔티티 변환 표 (이 표대로만 하세요)

| V1__init.sql | Java 타입 | 어노테이션 |
|---|---|---|
| `BIGSERIAL PRIMARY KEY` | `Long` | `@Id @GeneratedValue(strategy = GenerationType.IDENTITY)` |
| `BIGINT NOT NULL` (FK) | 상대 엔티티 타입 | `@ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "venue_id", nullable = false)` |
| `VARCHAR(n) NOT NULL` | `String` | `@Column(nullable = false, length = n)` |
| `VARCHAR(n)` + `CHECK (x IN (...))` | **enum** | `@Enumerated(EnumType.STRING) @Column(nullable = false, length = n)` |
| `INTEGER` | `Integer` | `@Column` |
| `TEXT` | `String` | `@Column(columnDefinition = "TEXT")` |
| `TIMESTAMPTZ` | **`OffsetDateTime`** | `@Column(nullable = false)` |

> **`TIMESTAMPTZ`는 반드시 `OffsetDateTime`으로 매핑하세요.**
> `LocalDateTime`은 "타임존 없는 시각"이라 Postgres의 `timestamp with time zone`과 타입이 어긋납니다. `Date`, `LocalDateTime`으로 매핑하면 validate에서 걸리거나, 통과하더라도 시간이 9시간씩 밀리는 버그가 나중에 터집니다. **팀 전체가 `OffsetDateTime` 하나로 통일합니다.**

### 3-3. ⚠️ 최대 함정: 테이블마다 시간 컬럼이 다릅니다

블로그를 보면 무조건 `BaseTimeEntity`를 만들어 전부 상속시키라고 합니다. **이 프로젝트에서 그렇게 하면 절반의 엔티티가 기동에 실패합니다.** 테이블마다 시간 컬럼 유무가 다르기 때문입니다.

| 테이블 | `created_at` | `updated_at` | 상속할 것 |
|---|---|---|---|
| `users` | ✅ | ✅ | `BaseTimeEntity` |
| `performance` | ✅ | ✅ | `BaseTimeEntity` |
| `venue` | ✅ | ❌ | `BaseCreatedEntity` |
| `session` | ✅ | ❌ | `BaseCreatedEntity` |
| `booking` | ✅ | ❌ | `BaseCreatedEntity` |
| `payment` | ✅ | ❌ | `BaseCreatedEntity` |
| `venue_seat` | ❌ | ❌ | **상속 안 함** |
| `seat_grade` | ❌ | ❌ | **상속 안 함** |
| `session_seat` | ❌ | ❌ | **상속 안 함** |
| `booking_seat` | ❌ | ❌ | **상속 안 함** |

`session_seat`에 시간 컬럼이 없는 건 실수가 아닙니다. 회차당 수천 건이 벌크로 생성되는 테이블이라 행 크기를 줄인 의도적 설계입니다.

그래서 **공통 부모를 두 개** 만듭니다.

```java
// global/common/BaseCreatedEntity.java — created_at 만 있는 테이블용
@Getter
@MappedSuperclass
public abstract class BaseCreatedEntity {

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void onCreate() {
        this.createdAt = OffsetDateTime.now();
    }
}
```

```java
// global/common/BaseTimeEntity.java — created_at + updated_at 둘 다 있는 테이블용
@Getter
@MappedSuperclass
public abstract class BaseTimeEntity extends BaseCreatedEntity {

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void onSave() {
        this.updatedAt = OffsetDateTime.now();
    }
}
```

> **왜 `@EnableJpaAuditing` + `@CreatedDate`를 안 쓰나?**
> 그것도 정답입니다. 다만 (1) 설정 클래스가 하나 더 필요하고 (2) `OffsetDateTime` 변환기가 버전에 따라 다르게 동작해 초심자가 원인을 찾기 어려운 에러를 만듭니다. 위의 `@PrePersist`/`@PreUpdate`는 **순수 JPA 기능이라 설정이 필요 없고 동작이 눈에 보입니다.** 나중에 "누가 만들었는지(`@CreatedBy`)"가 필요해지면 그때 Auditing으로 갈아타면 됩니다.
> (`docs/ROADMAP.md`의 `JpaAuditingConfig` 항목은 이 결정으로 선택 사항이 됩니다.)

### 3-4. 엔티티 표준 형태

`users` 테이블을 예로, 이 프로젝트에서 쓰는 표준 형태입니다.

```java
package com.ticket.ticketflow.domain.user.entity;

@Entity
@Table(name = "users")              // ① 테이블명이 클래스명과 다르면 반드시 명시
@Getter                             // ② Getter 만. @Setter 는 금지
@NoArgsConstructor(access = AccessLevel.PROTECTED)   // ③ JPA용 기본 생성자
public class User extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(nullable = false, length = 255)
    private String password;        // BCrypt 해시가 들어감. 평문 절대 금지

    @Column(nullable = false, length = 50)
    private String name;

    @Column(length = 20)
    private String phone;           // NULL 허용 컬럼 → nullable 옵션 생략

    @Enumerated(EnumType.STRING)    // ④ ORDINAL 절대 금지
    @Column(nullable = false, length = 20)
    private Role role;

    @Builder                        // ⑤ 생성은 빌더로
    private User(String email, String password, String name, String phone, Role role) {
        this.email = email;
        this.password = password;
        this.name = name;
        this.phone = phone;
        this.role = role;
    }

    // ⑥ 상태 변경은 "의미가 드러나는 메서드"로만
    public void changePhone(String phone) {
        this.phone = phone;
    }
}
```

각 번호의 이유:

1. **`@Table(name = "users")`** — 클래스는 `User`, 테이블은 `users`입니다. 안 붙이면 Hibernate가 `user` 테이블을 찾다가 실패합니다. (`user`는 Postgres 예약어라 일부러 복수형으로 만든 테이블입니다)
2. **`@Setter` 금지** — Setter가 열려 있으면 아무 데서나 `booking.setStatus(CONFIRMED)`를 호출할 수 있고, "언제 누가 상태를 바꿨는지"를 추적할 수 없게 됩니다. 이 프로젝트의 핵심이 상태 전이(AVAILABLE→SOLD, PENDING→CONFIRMED)라 특히 치명적입니다.
3. **`@NoArgsConstructor(access = PROTECTED)`** — JPA는 리플렉션으로 객체를 만들 때 기본 생성자가 필요합니다. 하지만 개발자가 `new User()`로 빈 객체를 만드는 건 막아야 하므로 `PROTECTED`로 막습니다.
4. **`EnumType.STRING`** — 기본값인 `ORDINAL`은 enum을 **순서 번호(0,1,2)**로 저장합니다. 나중에 enum 상수 순서만 바꿔도 기존 데이터가 전부 다른 의미가 됩니다. 게다가 DB 컬럼이 `VARCHAR`라 ORDINAL이면 애초에 저장도 안 됩니다.
5. **빌더 생성자는 `private`** — 필드가 5개 넘어가면 `new User(a,b,c,d,e)`는 순서를 실수하기 쉽습니다. 빌더는 이름으로 넣으니 안전합니다.
6. **의미 있는 메서드** — `setStatus(CANCELLED)`가 아니라 `cancel()`. 코드를 읽을 때 "무슨 일이 일어나는지"가 드러납니다.

### 3-5. enum은 CHECK 제약과 1:1로 만듭니다

`V1__init.sql`의 `CHECK (role IN ('USER','ADMIN'))`이 곧 enum 정의서입니다.

```java
package com.ticket.ticketflow.domain.user.entity;

public enum Role {
    USER, ADMIN
}
```

**이름이 겹치는 enum은 반드시 구분해서 지으세요.** `booking.status`와 `booking_seat.status`는 값 집합이 다릅니다.

| 테이블 | 값 | enum 이름 |
|---|---|---|
| `users.role` | USER, ADMIN | `Role` |
| `performance.status` | SCHEDULED, ON_SALE, CLOSED | `PerformanceStatus` |
| `performance.genre` | CONCERT, MUSICAL, PLAY | `Genre` |
| `session.status` | SCHEDULED, ON_SALE, SOLD_OUT, CLOSED | `SessionStatus` |
| `session_seat.status` | AVAILABLE, SOLD | `SessionSeatStatus` |
| `booking.status` | PENDING, CONFIRMED, CANCELLED | `BookingStatus` |
| `booking_seat.status` | ACTIVE, CANCELLED | `BookingSeatStatus` |
| `payment.status` | SUCCESS, FAILED | `PaymentStatus` |

### 3-6. 연관관계는 `@ManyToOne(LAZY)`만

```java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "venue_id", nullable = false)
private Venue venue;
```

- **`fetch = LAZY`를 빼먹지 마세요.** `@ManyToOne`의 기본값은 `EAGER`라서, 공연 1건 조회에 공연장·좌석까지 줄줄이 딸려옵니다. 좌석 조회 API에서 이게 터지면 쿼리 수천 개가 나갑니다.
- **`@OneToMany`는 기본적으로 만들지 마세요.** `Performance`에 `List<PerformanceSession> sessions`를 넣고 싶은 유혹이 있지만, 양방향은 관리 지점이 두 곳이 되고 N+1의 주범입니다. **필요한 조회는 Repository 쿼리로 해결**하고, 정말 필요할 때만 추가하세요.
- 다른 사람 도메인의 엔티티는 **읽기 목적의 `@ManyToOne`까지만** 허용됩니다 (`CLAUDE.md` 규칙).

### 3-7. 엔티티를 다 쓴 뒤 반드시 하는 검증

```bash
docker compose up -d          # 인프라 먼저 (안 하면 무조건 실패)
./gradlew bootRun
```

`Started TicketflowApplication`이 뜨면 **엔티티 10종이 스키마와 완전히 일치한다는 증명**입니다. 이게 이 프로젝트에서 가장 확실한 자체 검증 수단입니다.

---

## 4. Repository 작성법

인터페이스만 만들면 Spring Data JPA가 구현체를 자동 생성합니다. 클래스를 직접 만들지 마세요.

```java
package com.ticket.ticketflow.domain.user.repository;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);   // 메서드 이름이 곧 쿼리

    boolean existsByEmail(String email);
}
```

### 규칙

- 반환 타입이 단건이면 **`Optional<T>`**를 쓰세요. `null`을 반환하면 호출부에서 NPE가 납니다.
- 메서드 이름 규칙: `findBy` + 필드명. 중첩도 됩니다 — `findBySessionId(Long sessionId)`는 `session_seat.session_id` 조회.
- 이름이 3~4단어를 넘어가면(`findBySessionIdAndStatusOrderByIdAsc`) 읽기 어려우니 `@Query`로 바꾸세요.

```java
@Query("""
       select ss from SessionSeat ss
       join fetch ss.seatGrade
       where ss.performanceSession.id = :sessionId
       """)
List<SessionSeat> findAllForSeatMap(@Param("sessionId") Long sessionId);
```

- `@Query` 안은 **SQL이 아니라 JPQL**입니다. **테이블명이 아니라 엔티티 클래스명**, 컬럼명이 아니라 필드명을 씁니다. (`session_seat` ❌ / `SessionSeat` ✅)
- `join fetch`는 N+1을 막는 도구입니다. 3~4주차 조회 API에서 반드시 필요합니다.

---

## 5. DTO 작성법

### 왜 Entity를 그대로 주고받으면 안 되는가

1. `User` 엔티티를 그대로 응답하면 **비밀번호 해시가 그대로 노출**됩니다.
2. 요청 JSON에 `"role": "ADMIN"`을 넣으면 아무나 관리자가 됩니다.
3. 지연 로딩 필드에 접근하다 `LazyInitializationException`이 납니다 (OSIV false).
4. 엔티티 필드를 바꾸면 API 스펙이 소리 없이 바뀌어 프론트가 깨집니다.

### 형태: Java 26이므로 `record`를 씁니다

```java
// domain/user/dto/SignupRequest.java
public record SignupRequest(
        @NotBlank @Email
        String email,

        @NotBlank @Size(min = 8, max = 30)
        String password,

        @NotBlank @Size(max = 50)
        String name,

        @Pattern(regexp = "^01[0-9]-?\\d{3,4}-?\\d{4}$", message = "휴대폰 번호 형식이 아닙니다")
        String phone
) {}
```

```java
// domain/user/dto/UserResponse.java
public record UserResponse(Long id, String email, String name, String phone) {

    public static UserResponse from(User user) {          // 변환 메서드는 DTO 쪽에
        return new UserResponse(user.getId(), user.getEmail(), user.getName(), user.getPhone());
    }
}
```

### 규칙

- **Request와 Response를 한 클래스로 합치지 마세요.** 입력과 출력의 필드는 항상 달라집니다(비밀번호는 입력에만, id는 출력에만).
- 검증 어노테이션은 **Request DTO에만** 붙입니다. Entity에 `@NotBlank`를 붙이는 건 흔한 실수입니다 (엔티티는 이미 DB 제약으로 보호됨).
- `from(Entity)` 정적 팩토리를 만들어 두면 Service가 깔끔해집니다.
- DTO 이름은 `{동작}Request` / `{대상}Response`로 통일합니다. (`SeatHoldRequest`, `BookingDetailResponse`)

### 자주 쓰는 검증 어노테이션

| 어노테이션 | 용도 | 주의 |
|---|---|---|
| `@NotNull` | null 금지 | 빈 문자열 `""`은 통과함 |
| `@NotBlank` | 문자열 필수 | 문자열 전용 |
| `@NotEmpty` | 컬렉션/문자열 비어있음 금지 | 좌석 ID 목록에 사용 |
| `@Size(min=, max=)` | 길이 | `@Size(min=1, max=4)` → 좌석 1~4석 제한에 유용 |
| `@Positive` | 양수 | 금액, ID |
| `@Email` | 이메일 형식 | |

---

## 6. Service 작성법과 `@Transactional`

### 표준 형태

```java
@Service
@RequiredArgsConstructor                 // ① 생성자 주입
@Transactional(readOnly = true)          // ② 클래스는 읽기 전용이 기본
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional                       // ③ 쓰기 메서드에만 다시 붙인다
    public UserResponse signup(SignupRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BusinessException(UserErrorCode.DUPLICATE_EMAIL);
        }

        User user = User.builder()
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))  // 반드시 해싱
                .name(request.name())
                .phone(request.phone())
                .role(Role.USER)
                .build();

        return UserResponse.from(userRepository.save(user));   // ④ DTO로 변환해서 반환
    }
}
```

1. **`@RequiredArgsConstructor` + `final` 필드** — `@Autowired` 필드 주입은 쓰지 않습니다. 생성자 주입이어야 테스트에서 가짜 객체를 넣을 수 있고, 순환 참조를 기동 시점에 잡아냅니다.
2. **클래스에 `readOnly = true`** — 읽기 전용 트랜잭션은 Hibernate가 변경 감지(더티 체킹)를 생략해서 더 빠릅니다.
3. **쓰기 메서드에만 `@Transactional`** — 메서드 어노테이션이 클래스 것을 덮어씁니다.
4. **반환은 DTO** — Entity를 반환하면 Controller에서 지연 로딩 에러가 납니다.

### `@Transactional`에서 초심자가 100% 겪는 함정

#### 함정 1 — 같은 클래스 안에서 호출하면 트랜잭션이 안 걸립니다

```java
@Service
public class BookingService {

    public void confirm() {
        createPending();   // ❌ @Transactional 이 동작하지 않음!
        pay();
        finish();
    }

    @Transactional
    public void createPending() { ... }
}
```

Spring은 **프록시 객체**로 트랜잭션을 겁니다. 그런데 `confirm()` 안에서 `createPending()`을 부르면 프록시를 거치지 않고 자기 자신의 메서드를 직접 호출하는 것이라 어노테이션이 무시됩니다. 에러도 안 나고 조용히 트랜잭션 없이 실행됩니다.

**해결: 트랜잭션 경계를 나눠야 하면 클래스를 나누세요.** (개발자 A의 예매 확정 T1/T2 분리가 정확히 이 케이스입니다 — `01-developer-a-workflow.md` 참고)

#### 함정 2 — 외부 API 호출을 트랜잭션 안에 넣지 마세요

```java
@Transactional
public void confirm() {
    bookingRepository.save(booking);
    paymentClient.pay(...);        // ❌ 이 호출이 3초 걸리면 DB 커넥션을 3초 잡고 있음
}
```

동시 접속이 몰리는 프로젝트에서 이건 커넥션 풀 고갈로 직결됩니다. 결제 호출은 **트랜잭션 밖**에 두세요.

#### 함정 3 — 엔티티 수정에는 `save()`가 필요 없습니다

```java
@Transactional
public void cancel(Long bookingId) {
    Booking booking = bookingRepository.findById(bookingId)
            .orElseThrow(() -> new BusinessException(BookingErrorCode.BOOKING_NOT_FOUND));
    booking.cancel();          // 이것만으로 UPDATE 쿼리가 나갑니다 (변경 감지)
    // bookingRepository.save(booking);  ← 불필요
}
```

트랜잭션 안에서 조회한 엔티티는 영속 상태라, 필드를 바꾸면 커밋 시점에 Hibernate가 자동으로 UPDATE를 날립니다. 단, **`readOnly = true`인 메서드에서는 동작하지 않습니다.**

---

## 7. Controller 작성법

```java
@RestController
@RequestMapping("/api/auth")             // ① 담당 prefix (CLAUDE.md의 경로 소유권)
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/signup")
    public ApiResponse<UserResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ApiResponse.success(authService.signup(request));   // ② 로직 없음
    }

    @GetMapping("/{id}")
    public ApiResponse<UserResponse> get(@PathVariable Long id) {
        return ApiResponse.success(userService.get(id));
    }
}
```

### 규칙

- **`@Valid`를 빼먹지 마세요.** 붙이지 않으면 DTO의 `@NotBlank`가 전혀 동작하지 않습니다. (가장 흔한 실수 1위)
- **경로 prefix는 담당자가 정해져 있습니다.** `CLAUDE.md`의 "API 경로 소유권" 표를 어기면 `SecurityConfig` 화이트리스트에서 충돌합니다.

| prefix | 담당 |
|---|---|
| `/api/auth/**`, `/api/users/**`, `/api/performances/**`, `/api/sessions/**`, `/api/waiting/**` | B |
| `/api/bookings/**`, `/api/payments/**` | A |

- **HTTP 메서드 선택**: 조회=GET, 생성=POST, 전체수정=PUT, 부분수정=PATCH, 삭제=DELETE.
- **로그인 사용자 정보는 파라미터로 받지 마세요.** `userId`를 요청 바디로 받으면 남의 ID를 넣어 남의 예매를 취소할 수 있습니다. 인증 컨텍스트에서 꺼냅니다:

```java
@PostMapping
public ApiResponse<BookingResponse> create(
        @AuthenticationPrincipal CustomUserDetails principal,   // ← JWT에서 추출된 사용자
        @Valid @RequestBody BookingCreateRequest request) {
    return ApiResponse.success(bookingService.create(principal.getUserId(), request));
}
```

---

## 8. 공통 응답 · 예외 처리 규격

> ⚠️ `global/` 하위는 **A/B가 모두 의존하는 공유 기반**입니다. 1주차에 한 사람(B)이 확정해 머지한 뒤에는 **변경 시 상대 리뷰 필수**입니다. 기능 개발 중 편의로 시그니처를 바꾸지 마세요.

### 8-1. `ApiResponse<T>`

모든 API가 같은 껍데기로 응답해야 프론트가 한 곳에서 처리할 수 있습니다.

```java
// global/common/ApiResponse.java
public record ApiResponse<T>(boolean success, T data, ErrorBody error) {

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, data, null);
    }

    public static ApiResponse<Void> fail(String code, String message) {
        return new ApiResponse<>(false, null, new ErrorBody(code, message));
    }

    public record ErrorBody(String code, String message) {}
}
```

성공 응답:
```json
{ "success": true, "data": { "id": 1, "email": "a@b.com" }, "error": null }
```

실패 응답:
```json
{ "success": false, "data": null, "error": { "code": "U002", "message": "이미 가입된 이메일입니다" } }
```

### 8-2. `ErrorCode`는 **interface**입니다 (enum 아님)

단일 enum으로 만들면 A와 B가 기능을 추가할 때마다 같은 파일을 고쳐 **머지 충돌이 무한 반복**됩니다. 그래서 인터페이스로 쪼갭니다.

```java
// global/exception/ErrorCode.java
public interface ErrorCode {
    String getCode();
    HttpStatus getHttpStatus();
    String getMessage();
}
```

```java
// global/exception/CommonErrorCode.java  — 공통만
@Getter
@RequiredArgsConstructor
public enum CommonErrorCode implements ErrorCode {

    INVALID_INPUT("C001", HttpStatus.BAD_REQUEST, "입력값이 올바르지 않습니다"),
    UNAUTHORIZED("C002", HttpStatus.UNAUTHORIZED, "인증이 필요합니다"),
    FORBIDDEN("C003", HttpStatus.FORBIDDEN, "권한이 없습니다"),
    INTERNAL_ERROR("C999", HttpStatus.INTERNAL_SERVER_ERROR, "서버 오류가 발생했습니다");

    private final String code;
    private final HttpStatus httpStatus;
    private final String message;
}
```

도메인별 파일은 **담당자 본인만** 수정합니다.

```
domain/user/exception/UserErrorCode.java          (B)   U001~
domain/performance/exception/PerformanceErrorCode.java (B) P001~
domain/waitingroom/exception/WaitingRoomErrorCode.java (B) W001~
domain/booking/exception/BookingErrorCode.java    (A)   B001~
domain/payment/exception/PaymentErrorCode.java    (A)   Y001~
```

코드 접두어를 도메인별로 다르게 하면 코드값도 충돌하지 않습니다.

### 8-3. `BusinessException`

```java
// global/exception/BusinessException.java
@Getter
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}
```

**던지기만 하면 됩니다.** `try-catch`로 감싸서 직접 응답을 만들지 마세요 — 아래 핸들러가 전부 처리합니다.

```java
throw new BusinessException(UserErrorCode.DUPLICATE_EMAIL);
```

### 8-4. `GlobalExceptionHandler`

```java
// global/exception/GlobalExceptionHandler.java
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 우리가 의도적으로 던진 예외
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusiness(BusinessException e) {
        ErrorCode code = e.getErrorCode();
        return ResponseEntity.status(code.getHttpStatus())
                .body(ApiResponse.fail(code.getCode(), code.getMessage()));
    }

    // @Valid 실패 (DTO 형식 오류)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return ResponseEntity.badRequest()
                .body(ApiResponse.fail(CommonErrorCode.INVALID_INPUT.getCode(), message));
    }

    // ★ 이 프로젝트의 핵심 — 유니크 제약 위반 = 중복 예매
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleIntegrity(DataIntegrityViolationException e) {
        log.warn("무결성 제약 위반", e);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiResponse.fail("B409", "이미 예매된 좌석입니다"));
    }

    // 나머지 전부 (예상 못 한 버그)
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception e) {
        log.error("처리되지 않은 예외", e);      // 여기서 반드시 로그를 남긴다
        ErrorCode code = CommonErrorCode.INTERNAL_ERROR;
        return ResponseEntity.status(code.getHttpStatus())
                .body(ApiResponse.fail(code.getCode(), code.getMessage()));
    }
}
```

> `DataIntegrityViolationException` 핸들러는 **`uq_booking_seat_active`(중복 예매 방지 최후 방어선)가 걸렸을 때** 사용자에게 "이미 예매된 좌석"이라고 알려주는 통로입니다. 이 프로젝트에서 가장 중요한 예외 처리입니다. 다만 여기서만 처리하면 어떤 제약이 걸렸는지 구분이 안 되므로, 개발자 A는 **Service 안에서 직접 잡아 도메인 예외로 바꾸는 편이 더 정확합니다** (A 문서 참고). 여기 있는 건 그물망입니다.

---

## 9. 도메인 경계를 넘는 방법

`domain/` 하위는 **담당자가 정해진 남의 집**입니다. 규칙은 세 줄로 끝납니다.

1. 다른 도메인의 **Repository를 주입하지 마세요.**
2. 다른 도메인의 **엔티티는 읽기용 `@ManyToOne(LAZY)` 참조까지만.**
3. 다른 도메인의 **상태 변경은 그 도메인의 Service 메서드로만.**

### 예시 — 예매 확정 시 좌석을 SOLD로 바꾸기

```java
// ❌ A의 코드에서
private final SessionSeatRepository sessionSeatRepository;   // B 소유 Repository 직접 주입
sessionSeatRepository.updateStatusToSold(ids);
```

```java
// ✅ A의 코드에서
private final SessionSeatService sessionSeatService;         // B가 제공한 Service
sessionSeatService.markAsSold(sessionSeatIds);
```

### 이 규칙의 진짜 이득: **기다리지 않아도 됩니다**

B가 아직 `markAsSold`를 구현하지 않았어도, **시그니처만 먼저 커밋하면** A는 바로 다음 코드를 쓸 수 있습니다.

```java
// B가 1일차에 이것만 먼저 커밋 → A는 즉시 병렬 작업 시작
@Service
public class SessionSeatService {
    public void markAsSold(List<Long> sessionSeatIds) {
        throw new UnsupportedOperationException("구현 예정");   // 껍데기라도 먼저!
    }
}
```

2인 개발에서 **인터페이스 선(先)커밋은 선택이 아니라 필수 기술**입니다. "구현 다 하고 올릴게"라고 하면 상대는 그동안 아무것도 못 합니다.

### 서로 합의가 필요한 지점 (미리 알아두세요)

| 계약 | 제공자 | 사용자 | 언제까지 |
|---|---|---|---|
| `SessionSeatService.markAsSold(List<Long>)` | B | A | 5주차 전 |
| `SessionSeatService.findAllForBooking(List<Long>)` (가격/유효성 조회) | B | A | 5주차 전 |
| 대기실 입장 토큰 검증 메서드 | B | A | 5주차 전 |
| Kafka 이벤트 DTO (`global/event/`) | B가 정의 | A가 발행 | 7주차 전 |
| 좌석 락 TTL ↔ 입장 토큰 TTL 수치 | **A/B 공동 결정** | | 5주차 |

---

## 10. Git 브랜치 · 커밋 · PR

### 절대 규칙

**`master`에 직접 커밋하지 않습니다.** 지금까지는 그렇게 해왔지만 1주차부터 전환합니다. 2인이 같은 브랜치에 직접 푸시하면 서로의 미완성 코드 때문에 앱이 안 뜨는 상황이 반복됩니다.

### 브랜치 이름

```
feature/{도메인}-{작업}
```

예: `feature/user-signup`, `feature/booking-seat-hold`, `feature/performance-seat-api`

### 작업 흐름

```bash
# 1. 최신 master 에서 시작 (이걸 안 하면 나중에 충돌이 커집니다)
git switch master
git pull

# 2. 브랜치 생성
git switch -c feature/user-signup

# 3. 작업 → 커밋 (작게, 자주)
git add .
git commit -m "feat: 회원가입 API 구현"

# 4. 푸시 전에 반드시 빌드
docker compose up -d
./gradlew build

# 5. 푸시 & PR
git push -u origin feature/user-signup
gh pr create           # 또는 GitHub 웹에서
```

### 커밋 메시지

`prefix: 한국어 설명` 형식입니다 (현재 팀 관행).

| prefix | 언제 |
|---|---|
| `feat:` | 기능 추가 |
| `fix:` | 버그 수정 |
| `refactor:` | 동작 변화 없는 구조 개선 |
| `test:` | 테스트 추가/수정 |
| `chore:` | 빌드/설정/의존성 |
| `docs:` | 문서 |

```
feat: 좌석 선점 API 및 Redis TTL 락 구현
fix: 예매 취소 시 booking_seat 상태가 갱신되지 않던 문제 수정
```

**한 커밋에 한 가지 일만.** "회원가입 + 로그인 + 리팩토링"을 한 커밋에 담으면 나중에 되돌릴 수 없습니다.

### PR 올릴 때 본문에 쓸 것

```markdown
## 무엇을
- 회원가입 / 로그인 API 구현

## 어떻게 확인했는지
- curl 로 가입 → 로그인 → /api/users/me 200 확인
- 중복 이메일 가입 시 409 확인

## 리뷰어가 봐줬으면 하는 것
- BCrypt strength 기본값(10)으로 둬도 될지
```

**"어떻게 확인했는지"를 반드시 쓰세요.** 초급 개발자끼리의 리뷰에서 가장 도움이 되는 정보입니다.

### 리뷰 규칙

- 프론트 코드도 리뷰 대상입니다 (AI 생성물 방치 방지).
- `global/` 하위를 건드린 PR은 **반드시 상대 승인 후** 머지합니다.
- CI(`.github/workflows/ci.yml`)가 빨간불이면 머지 금지. CI는 "상대 코드가 머지된 뒤 앱이 안 뜨는 상황"을 잡아주는 유일한 장치입니다.

---

## 11. 자주 만나는 에러와 읽는 법

### 에러 읽는 법 (먼저 이것부터)

스택트레이스가 300줄이어도 **읽을 곳은 두 군데**입니다.
1. **맨 위 첫 줄** — 예외 타입과 메시지
2. **`Caused by:` 중 가장 마지막 것** — 진짜 원인

가운데 200줄은 Spring 내부 호출이라 볼 필요 없습니다.

### 자주 만나는 에러 표

| 증상 | 원인 | 해결 |
|---|---|---|
| `FlywaySqlUnableToConnectToDbException` | 인프라가 안 떠 있음 | `docker compose up -d` 먼저 |
| `SchemaManagementException: Schema-validation: missing column [xxx]` | 엔티티 필드가 테이블에 없음 | `V1__init.sql` 확인. 컬럼명 오타 or `@Column(name=)` 누락 |
| `Schema-validation: missing table [user]` | `@Table(name = "users")` 누락 | 테이블명 명시 |
| `Schema-validation: wrong column type ... found [timestamp], expected [timestamptz]` | `LocalDateTime`으로 매핑함 | `OffsetDateTime`으로 변경 |
| `LazyInitializationException: no Session` | Controller/뷰에서 LAZY 필드 접근 | Service 안에서 DTO 변환 완료 |
| `@Valid`가 동작 안 함 | Controller에 `@Valid` 안 붙임 | `@Valid @RequestBody` |
| `NullPointerException` on `@Autowired` 필드 | 생성자 주입 안 씀 / `new`로 직접 생성 | `@RequiredArgsConstructor` + `final` |
| 401만 계속 나옴 | `SecurityConfig` 화이트리스트 누락 | `requestMatchers("/api/auth/**").permitAll()` |
| 401인데 응답이 HTML | `AuthenticationEntryPoint` 미설정 | JSON 반환하도록 커스터마이징 |
| `DataIntegrityViolationException` | 유니크/체크 제약 위반 | **정상 동작**일 수 있음 (중복 예매 차단). 메시지의 제약 이름 확인 |
| `could not execute statement ... ck_xxx_status` | enum 값이 CHECK 제약에 없는 값 | enum 상수명과 SQL의 `IN (...)` 비교 |
| 테스트만 실패 | 테스트가 실제 DB를 씀 | 인프라 기동 확인. 3~4주차에 Testcontainers로 해결 예정 |

### 디버깅 도구

```yaml
# application-local.yml 에 추가하면 실행되는 SQL 이 보입니다
spring:
  jpa:
    properties:
      hibernate:
        format_sql: true
logging:
  level:
    org.hibernate.SQL: debug
    org.hibernate.orm.jdbc.bind: trace   # 바인딩 파라미터 값까지
```

N+1 문제를 찾을 때는 이걸 켜고 **쿼리가 몇 번 나가는지 세어보는 게** 가장 확실합니다.

---

## 12. 테스트 작성 최소 기준

3개월 프로젝트에 "테스트 커버리지 80%"는 비현실적입니다. **최소한 이것만** 지킵니다.

### 12-1. 기능 하나당 성공 1개 + 실패 1개

```java
@SpringBootTest
@Transactional            // 테스트 후 롤백되어 DB가 더러워지지 않음
class AuthServiceTest {

    @Autowired AuthService authService;

    @Test
    void 회원가입에_성공한다() {
        SignupRequest request = new SignupRequest("a@b.com", "password1", "홍길동", null);

        UserResponse response = authService.signup(request);

        assertThat(response.email()).isEqualTo("a@b.com");
    }

    @Test
    void 중복_이메일이면_예외가_발생한다() {
        authService.signup(new SignupRequest("a@b.com", "password1", "홍길동", null));

        assertThatThrownBy(() -> authService.signup(
                new SignupRequest("a@b.com", "password2", "김철수", null)))
                .isInstanceOf(BusinessException.class);
    }
}
```

- 테스트 메서드 이름은 **한국어로** 쓰세요. `test1()`보다 `중복_이메일이면_예외가_발생한다()`가 실패했을 때 훨씬 유용합니다.
- `@Transactional`을 붙이면 테스트가 끝날 때 롤백됩니다.

### 12-2. 동시성은 반드시 테스트로 증명해야 합니다 (A, 9~10주차)

이 프로젝트의 핵심 주장은 **"동시 요청에도 중복 예매가 0건"**입니다. 이건 말이 아니라 코드로 증명해야 포트폴리오가 됩니다.

```java
@Test
void 동일_좌석에_100명이_동시_요청해도_1건만_성공한다() throws Exception {
    int threadCount = 100;
    ExecutorService executor = Executors.newFixedThreadPool(32);
    CountDownLatch latch = new CountDownLatch(threadCount);
    AtomicInteger success = new AtomicInteger();

    for (int i = 0; i < threadCount; i++) {
        executor.submit(() -> {
            try {
                bookingFacade.confirm(...);
                success.incrementAndGet();
            } catch (Exception ignored) {
            } finally {
                latch.countDown();
            }
        });
    }
    latch.await();

    assertThat(success.get()).isEqualTo(1);
}
```

> ⚠️ 이 테스트에는 `@Transactional`을 **붙이면 안 됩니다.** 테스트 트랜잭션이 롤백되면 다른 스레드가 커밋된 데이터를 못 봐서 동시성 검증이 무의미해집니다. 대신 `@AfterEach`에서 직접 데이터를 정리하세요. (초심자가 반드시 한 번 빠지는 함정입니다)

### 12-3. 빌드 실행

```bash
docker compose up -d              # 필수! 안 하면 빌드 실패
./gradlew build                   # 컴파일 + 전체 테스트
./gradlew test --tests "com.ticket.ticketflow.domain.user.service.AuthServiceTest"
```

---

## 정리 — 매일 아침 확인할 것

```bash
git switch master && git pull     # 상대 작업 받아오기
docker compose up -d              # 인프라 기동
./gradlew bootRun                 # 앱이 뜨는가? (= 스키마/엔티티 정합성 OK)
```

**앱이 안 뜨면 그날의 첫 번째 일은 그것을 고치는 것입니다.** `ddl-auto: validate` 환경에서 앱이 안 뜨면 두 사람 다 아무것도 못 합니다.
