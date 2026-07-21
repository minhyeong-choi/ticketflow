# SQL 테이블을 보고 JPA 엔티티를 만드는 방법

이 문서는 JPA를 처음 쓰는 개발자가 `V1__init.sql`을 보면서 엔티티를 작성할 수 있도록 설명합니다.

현재 프로젝트에서는 DB 테이블 설계가 이미 정해져 있습니다.

```text
src/main/resources/db/migration/V1__init.sql
```

따라서 엔티티 작업은 "테이블을 새로 설계하는 일"이 아니라, **이미 정해진 테이블 구조를 Java 클래스로 정확히 옮기는 일**입니다.

---

## 1. 전체 흐름

이 프로젝트의 스키마 주인은 Flyway입니다.

```text
V1__init.sql
→ PostgreSQL에 실제 테이블 생성
→ JPA 엔티티 작성
→ Hibernate가 엔티티와 실제 테이블이 맞는지 검증
```

`application-local.yml`에는 다음 설정이 있습니다.

```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: validate
```

`validate`는 Hibernate가 테이블을 만들거나 수정하지 않고, **이미 있는 DB 테이블과 엔티티가 맞는지만 확인한다**는 뜻입니다.

그래서 엔티티가 SQL과 다르면 앱이 실행되지 않습니다.

예를 들어 실제 테이블명은 `booking`인데 엔티티에 아래처럼 쓰면 실패합니다.

```java
@Table(name = "bookings") // 틀림. 실제 테이블은 booking
```

정답은 아래입니다.

```java
@Table(name = "booking")
```

---

## 2. 엔티티란 무엇인가

JPA 엔티티는 DB 테이블 한 개를 Java 클래스 한 개로 표현한 것입니다.

```text
DB 테이블        Java 엔티티
users           User.java
booking         Booking.java
payment         Payment.java
```

DB 컬럼은 Java 필드가 됩니다.

```text
DB 컬럼                    Java 필드
id BIGSERIAL               private Long id;
email VARCHAR(255)         private String email;
total_amount INTEGER       private Integer totalAmount;
created_at TIMESTAMPTZ     private OffsetDateTime createdAt;
```

외래 키, 즉 FK는 Java 객체 참조로 표현합니다.

```text
booking.user_id
→ Booking 엔티티 안의 User user 필드
```

```java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "user_id", nullable = false)
private User user;
```

---

## 3. 작업 전에 할 일

먼저 작업 브랜치를 만듭니다.

```bash
git checkout -b feat/jpa-entities
```

IntelliJ에서는 다음 순서로 만들 수 있습니다.

```text
오른쪽 아래 브랜치명 클릭
→ New Branch
→ feat/jpa-entities 입력
→ Create
```

그다음 `V1__init.sql`을 옆에 열어두고 작업합니다.

```text
src/main/resources/db/migration/V1__init.sql
```

IntelliJ에서는 다음 경로입니다.

```text
src
→ main
→ resources
→ db
→ migration
→ V1__init.sql
```

---

## 4. SQL을 Java로 바꾸는 기본 규칙

### 테이블명

SQL:

```sql
CREATE TABLE users
(
    ...
);
```

Java:

```java
@Entity
@Table(name = "users")
public class User {
}
```

클래스명은 Java 관례에 맞게 단수형 PascalCase로 씁니다.

```text
users           → User
venue_seat      → VenueSeat
session_seat    → SessionSeat
booking_seat    → BookingSeat
```

### 기본 키

SQL:

```sql
id BIGSERIAL PRIMARY KEY
```

Java:

```java
@Id
@GeneratedValue(strategy = GenerationType.IDENTITY)
private Long id;
```

`BIGSERIAL`은 PostgreSQL에서 자동 증가하는 큰 정수입니다. Java에서는 보통 `Long`으로 매핑합니다.

### 문자열

SQL:

```sql
email VARCHAR(255) NOT NULL
name VARCHAR(50) NOT NULL
description TEXT
```

Java:

```java
@Column(nullable = false)
private String email;

@Column(nullable = false, length = 50)
private String name;

@Column(columnDefinition = "TEXT")
private String description;
```

`VARCHAR(50)`처럼 길이가 명확하면 `length = 50`을 써줍니다.

`TEXT`는 길이 제한이 없는 긴 문자열입니다. 이 프로젝트에서는 `columnDefinition = "TEXT"`로 명시하면 이해하기 쉽습니다.

### 숫자

SQL:

```sql
price INTEGER NOT NULL
total_amount INTEGER NOT NULL
```

Java:

```java
@Column(nullable = false)
private Integer price;

@Column(name = "total_amount", nullable = false)
private Integer totalAmount;
```

DB 컬럼명이 `snake_case`이면 Java 필드는 `camelCase`로 씁니다.

```text
total_amount → totalAmount
created_at   → createdAt
```

이때 컬럼명이 Java 필드명과 다르므로 `@Column(name = "...")`를 적습니다.

### 시간

SQL:

```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
booked_at TIMESTAMPTZ
```

Java:

```java
@Column(name = "created_at", nullable = false)
private OffsetDateTime createdAt;

@Column(name = "booked_at")
private OffsetDateTime bookedAt;
```

`TIMESTAMPTZ`는 타임존 정보를 포함한 시간입니다. 이 프로젝트에서는 `OffsetDateTime`을 사용합니다.

### enum

SQL:

```sql
status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
CONSTRAINT ck_booking_status CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED'))
```

Java enum:

```java
public enum BookingStatus {
    PENDING,
    CONFIRMED,
    CANCELLED
}
```

엔티티 필드:

```java
@Enumerated(EnumType.STRING)
@Column(nullable = false, length = 20)
private BookingStatus status;
```

반드시 `@Enumerated(EnumType.STRING)`을 붙입니다.

이걸 빼면 JPA가 enum 순서 번호를 저장할 수 있습니다. 그러면 `PENDING`이 아니라 `0` 같은 값이 들어가서 SQL의 `CHECK` 제약과 맞지 않습니다.

---

## 5. FK는 어떻게 엔티티로 옮기는가

SQL에서 FK는 다른 테이블을 참조하는 컬럼입니다.

예를 들어 `booking` 테이블에는 이런 FK가 있습니다.

```sql
user_id BIGINT NOT NULL,
session_id BIGINT NOT NULL,
CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES users (id),
CONSTRAINT fk_booking_session FOREIGN KEY (session_id) REFERENCES session (id)
```

이 말은 다음 뜻입니다.

```text
booking 한 건은 users 한 명에 속한다.
booking 한 건은 session 한 회차에 속한다.
```

JPA에서는 이것을 `@ManyToOne`으로 표현합니다.

```java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "user_id", nullable = false)
private User user;

@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "session_id", nullable = false)
private PerformanceSession session;
```

이 프로젝트에서는 모든 `@ManyToOne`에 `fetch = FetchType.LAZY`를 붙입니다.

```java
@ManyToOne(fetch = FetchType.LAZY)
```

`LAZY`는 필요한 순간에 연관 객체를 조회한다는 뜻입니다. 처음부터 연관 객체를 전부 가져오면 쿼리가 커지고 성능 문제가 생기기 쉽습니다.

---

## 6. Base 엔티티를 먼저 만든다

여러 테이블에 `created_at`, `updated_at`이 반복됩니다.

반복 필드는 공통 부모 클래스로 뺍니다.

만들 파일:

```text
src/main/java/com/ticket/ticketflow/global/common/BaseCreatedEntity.java
src/main/java/com/ticket/ticketflow/global/common/BaseTimeEntity.java
```

`BaseCreatedEntity`는 `created_at`만 있는 테이블에서 사용합니다.

```java
package com.ticket.ticketflow.global.common;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import java.time.OffsetDateTime;
import lombok.Getter;

@Getter
@MappedSuperclass
public abstract class BaseCreatedEntity {

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }
}
```

`BaseTimeEntity`는 `created_at`, `updated_at`이 둘 다 있는 테이블에서 사용합니다.

```java
package com.ticket.ticketflow.global.common;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import java.time.OffsetDateTime;
import lombok.Getter;

@Getter
@MappedSuperclass
public abstract class BaseTimeEntity extends BaseCreatedEntity {

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreateTime() {
        super.onCreate();
        if (updatedAt == null) {
            updatedAt = OffsetDateTime.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
```

주의할 점이 있습니다.

`session_seat`, `venue_seat`, `seat_grade`, `booking_seat`처럼 시간 컬럼이 없는 테이블에는 이 부모 클래스를 상속하면 안 됩니다. 실제 테이블에 없는 `created_at` 컬럼을 찾게 되어 앱이 실패합니다.

---

## 7. 이 프로젝트의 엔티티 작성 순서

FK 의존성 때문에 아래 순서대로 작성하는 것이 편합니다.

```text
1. Venue
2. VenueSeat
3. User
4. Performance
5. SeatGrade
6. PerformanceSession
7. SessionSeat
8. Booking
9. BookingSeat
10. Payment
```

먼저 참조 대상이 되는 엔티티를 만들고, 그다음 참조하는 엔티티를 만듭니다.

예를 들어 `VenueSeat`는 `Venue`를 참조하므로 `Venue`가 먼저 있어야 합니다.

---

## 8. 이 프로젝트에서 만들 enum

SQL의 `CHECK` 제약을 보고 enum 값을 그대로 옮깁니다.

```text
users.role
→ Role: USER, ADMIN

performance.status
→ PerformanceStatus: SCHEDULED, ON_SALE, CLOSED

performance.genre
→ Genre: CONCERT, MUSICAL, PLAY

session.status
→ SessionStatus: SCHEDULED, ON_SALE, SOLD_OUT, CLOSED

session_seat.status
→ SessionSeatStatus: AVAILABLE, SOLD

booking.status
→ BookingStatus: PENDING, CONFIRMED, CANCELLED

booking_seat.status
→ BookingSeatStatus: ACTIVE, CANCELLED

payment.status
→ PaymentStatus: SUCCESS, FAILED
```

`SessionSeatStatus`에 `HELD`를 추가하지 마세요. 이 프로젝트에서 좌석 선점 중 상태는 DB가 아니라 Redis TTL 락으로 관리합니다.

---

## 9. 테이블별 상속 기준

`V1__init.sql`을 기준으로 시간 컬럼이 있는지 확인합니다.

| 테이블 | 엔티티 | 상속 |
|---|---|---|
| `users` | `User` | `BaseTimeEntity` |
| `venue` | `Venue` | `BaseCreatedEntity` |
| `venue_seat` | `VenueSeat` | 상속 없음 |
| `performance` | `Performance` | `BaseTimeEntity` |
| `seat_grade` | `SeatGrade` | 상속 없음 |
| `session` | `PerformanceSession` | `BaseCreatedEntity` |
| `session_seat` | `SessionSeat` | 상속 없음 |
| `booking` | `Booking` | `BaseCreatedEntity` |
| `booking_seat` | `BookingSeat` | 상속 없음 |
| `payment` | `Payment` | `BaseCreatedEntity` |

상속 기준은 단순합니다.

```text
created_at만 있다        → BaseCreatedEntity
created_at + updated_at  → BaseTimeEntity
둘 다 없다               → 상속 없음
```

---

## 10. 예시 1: User 엔티티 만들기

SQL:

```sql
CREATE TABLE users
(
    id         BIGSERIAL PRIMARY KEY,
    email      VARCHAR(255) NOT NULL,
    password   VARCHAR(255) NOT NULL,
    name       VARCHAR(50)  NOT NULL,
    phone      VARCHAR(20),
    role       VARCHAR(20)  NOT NULL DEFAULT 'USER',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_role CHECK (role IN ('USER', 'ADMIN'))
);
```

Java:

```java
package com.ticket.ticketflow.domain.user.entity;

import com.ticket.ticketflow.global.common.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "users")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(length = 20)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;
}
```

여기서 `created_at`, `updated_at`은 `BaseTimeEntity`가 가지고 있으므로 `User`에 다시 쓰지 않습니다.

---

## 11. 예시 2: VenueSeat 엔티티 만들기

SQL:

```sql
CREATE TABLE venue_seat
(
    id          BIGSERIAL PRIMARY KEY,
    venue_id    BIGINT      NOT NULL,
    section     VARCHAR(20) NOT NULL,
    row_label   VARCHAR(10) NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    pos_x       INTEGER,
    pos_y       INTEGER,
    CONSTRAINT fk_venue_seat_venue FOREIGN KEY (venue_id) REFERENCES venue (id),
    CONSTRAINT uq_venue_seat UNIQUE (venue_id, section, row_label, seat_number)
);
```

Java:

```java
package com.ticket.ticketflow.domain.performance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "venue_seat")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VenueSeat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "venue_id", nullable = false)
    private Venue venue;

    @Column(nullable = false, length = 20)
    private String section;

    @Column(name = "row_label", nullable = false, length = 10)
    private String rowLabel;

    @Column(name = "seat_number", nullable = false, length = 10)
    private String seatNumber;

    @Column(name = "pos_x")
    private Integer posX;

    @Column(name = "pos_y")
    private Integer posY;
}
```

`venue_id`는 `Long venueId`로 두는 것이 아니라 `Venue venue`로 둡니다. 그래야 JPA가 테이블 관계를 이해할 수 있습니다.

---

## 12. 예시 3: Booking 엔티티 만들기

SQL:

```sql
CREATE TABLE booking
(
    id             BIGSERIAL PRIMARY KEY,
    booking_number VARCHAR(30) NOT NULL,
    user_id        BIGINT      NOT NULL,
    session_id     BIGINT      NOT NULL,
    total_amount   INTEGER     NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    booked_at      TIMESTAMPTZ,
    cancelled_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_booking_number UNIQUE (booking_number),
    CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_booking_session FOREIGN KEY (session_id) REFERENCES session (id),
    CONSTRAINT ck_booking_status CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
    CONSTRAINT ck_booking_total_amount CHECK (total_amount >= 0)
);
```

Java:

```java
package com.ticket.ticketflow.domain.booking.entity;

import com.ticket.ticketflow.domain.performance.entity.PerformanceSession;
import com.ticket.ticketflow.domain.user.entity.User;
import com.ticket.ticketflow.global.common.BaseCreatedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "booking")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Booking extends BaseCreatedEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "booking_number", nullable = false, length = 30)
    private String bookingNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private PerformanceSession session;

    @Column(name = "total_amount", nullable = false)
    private Integer totalAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BookingStatus status;

    @Column(name = "booked_at")
    private OffsetDateTime bookedAt;

    @Column(name = "cancelled_at")
    private OffsetDateTime cancelledAt;

    public void confirm() {
        status = BookingStatus.CONFIRMED;
        bookedAt = OffsetDateTime.now();
    }

    public void cancel() {
        status = BookingStatus.CANCELLED;
        cancelledAt = OffsetDateTime.now();
    }
}
```

`booking` 테이블에는 `created_at`만 있으므로 `BaseCreatedEntity`를 상속합니다.

---

## 13. 각 테이블을 엔티티로 옮길 때 확인할 것

테이블 하나를 볼 때마다 아래 순서로 체크합니다.

```text
1. 테이블명은 무엇인가?
2. 엔티티 클래스명은 무엇으로 할 것인가?
3. id 컬럼이 있는가?
4. 일반 컬럼은 어떤 타입인가?
5. nullable false가 붙은 컬럼은 무엇인가?
6. VARCHAR 길이는 얼마인가?
7. TIMESTAMPTZ 컬럼이 있는가?
8. CHECK 제약으로 enum 후보가 있는가?
9. FK가 있는가?
10. created_at, updated_at이 있는가?
```

이 순서대로 보면 빠뜨리는 필드가 줄어듭니다.

---

## 14. 이 프로젝트의 전체 엔티티 목록

아래 파일들을 만들면 1차 엔티티 작업이 끝납니다.

```text
src/main/java/com/ticket/ticketflow/global/common/BaseCreatedEntity.java
src/main/java/com/ticket/ticketflow/global/common/BaseTimeEntity.java

src/main/java/com/ticket/ticketflow/domain/user/entity/User.java
src/main/java/com/ticket/ticketflow/domain/user/entity/Role.java

src/main/java/com/ticket/ticketflow/domain/performance/entity/Venue.java
src/main/java/com/ticket/ticketflow/domain/performance/entity/VenueSeat.java
src/main/java/com/ticket/ticketflow/domain/performance/entity/Performance.java
src/main/java/com/ticket/ticketflow/domain/performance/entity/PerformanceStatus.java
src/main/java/com/ticket/ticketflow/domain/performance/entity/Genre.java
src/main/java/com/ticket/ticketflow/domain/performance/entity/SeatGrade.java
src/main/java/com/ticket/ticketflow/domain/performance/entity/PerformanceSession.java
src/main/java/com/ticket/ticketflow/domain/performance/entity/SessionStatus.java
src/main/java/com/ticket/ticketflow/domain/performance/entity/SessionSeat.java
src/main/java/com/ticket/ticketflow/domain/performance/entity/SessionSeatStatus.java

src/main/java/com/ticket/ticketflow/domain/booking/entity/Booking.java
src/main/java/com/ticket/ticketflow/domain/booking/entity/BookingStatus.java
src/main/java/com/ticket/ticketflow/domain/booking/entity/BookingSeat.java
src/main/java/com/ticket/ticketflow/domain/booking/entity/BookingSeatStatus.java

src/main/java/com/ticket/ticketflow/domain/payment/entity/Payment.java
src/main/java/com/ticket/ticketflow/domain/payment/entity/PaymentStatus.java
```

---

## 15. IntelliJ에서 실제로 작성하는 방법

예를 들어 `User.java`를 만든다면:

```text
src/main/java/com/ticket/ticketflow/domain/user/entity
→ 우클릭
→ New
→ Java Class
→ User 입력
```

enum을 만든다면:

```text
src/main/java/com/ticket/ticketflow/domain/user/entity
→ 우클릭
→ New
→ Java Class
→ Kind를 Enum으로 선택
→ Role 입력
```

작성 중 import가 필요하면 macOS 기준 `Option + Enter`를 누르면 IntelliJ가 import를 제안합니다.

정렬은 macOS 기준 다음 단축키를 사용합니다.

```text
Code Reformat: Option + Command + L
Optimize Imports: Control + Option + O
```

---

## 16. 작성 후 검증

엔티티를 모두 만든 뒤 DB 컨테이너를 실행합니다.

```bash
docker compose up -d
```

앱을 실행합니다.

```bash
./gradlew bootRun
```

정상이라면 아래와 비슷한 로그가 나옵니다.

```text
Started TicketflowApplication
```

실패하면 에러 메시지에서 아래 표현을 찾습니다.

```text
missing table
missing column
wrong column type
Schema-validation
```

대부분 원인은 다음 중 하나입니다.

| 에러 원인 | 확인할 것 |
|---|---|
| 테이블명을 잘못 씀 | `@Table(name = "...")` |
| 컬럼명을 잘못 씀 | `@Column(name = "...")` |
| FK 이름을 잘못 씀 | `@JoinColumn(name = "...")` |
| enum 매핑 누락 | `@Enumerated(EnumType.STRING)` |
| 시간 타입 오류 | `OffsetDateTime` 사용 여부 |
| 시간 컬럼 없는 테이블이 Base 엔티티 상속 | 상속 제거 |

---

## 17. 커밋하기

검증이 끝나면 변경사항을 확인합니다.

```bash
git status
```

커밋합니다.

```bash
git add .
git commit -m "feat: JPA 엔티티 10종 및 공통 시간 매핑 클래스 추가"
```

GitHub에 올립니다.

```bash
git push origin feat/jpa-entities
```

그다음 GitHub에서 PR을 만듭니다.

```text
base: main
compare: feat/jpa-entities
```

PR 본문에는 `./gradlew bootRun` 성공 로그를 적어두면 좋습니다.

---

## 18. 처음 작업할 때 가장 많이 하는 실수

1. `users` 테이블을 `@Table(name = "user")`로 적는 실수
2. `session` 테이블 엔티티 이름을 `Session`으로 만드는 실수
3. `TIMESTAMPTZ`를 `LocalDateTime`으로 매핑하는 실수
4. enum 필드에 `@Enumerated(EnumType.STRING)`을 빼먹는 실수
5. 모든 엔티티에 무조건 `BaseTimeEntity`를 상속하는 실수
6. FK를 객체가 아니라 `Long userId`로만 두는 실수
7. `SessionSeatStatus`에 `HELD`를 추가하는 실수
8. `@ManyToOne(fetch = FetchType.LAZY)`를 빼먹는 실수

처음에는 빠르게 많이 만드는 것보다, `V1__init.sql`과 한 줄씩 대조하면서 정확하게 만드는 것이 더 중요합니다.
