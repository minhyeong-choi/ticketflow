# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

ticketFlow — 콘서트/뮤지컬 티켓팅 플랫폼. 3개월짜리 학습/포트폴리오 프로젝트이며 실서비스 운영을 목표로 하지 않습니다. 핵심 기술 챌린지는 **동시 대량 접속 시 좌석 선점/중복 예매 방지**입니다. 전체 마일스톤 계획, 현재 진행 상황, 각 단계별 상세 설계 결정은 `docs/ROADMAP.md`에 정리되어 있으니, 어느 도메인이든 작업을 시작하기 전에 반드시 확인하세요 — 마일스톤별 함정과 미결정 사항이 문서화되어 있습니다.

현재 상태: 스캐폴딩과 Flyway 스키마(V1)는 완료·검증되었고, JPA 엔티티·공통 인프라(`global/`)·인증은 아직 미착수 상태입니다(`domain/*`, `global/*` 하위는 `.gitkeep`만 존재).

팀 협업 방식(2026-07 재편): 개발자 A는 프론트엔드 전체(AI 도구로 생성/유지보수) + `user`(인증/JWT), `payment`(Mock 결제), `global`(공통 인프라)을 담당하고, 개발자 B는 동시성 코어와 카탈로그 — `performance`/`venue`/`seat`(카탈로그), `booking`(예매/좌석 선점/확정), `waitingroom`(가상 대기실), `notification`(Kafka consumer)을 담당합니다. 대기실·좌석 락·예매 확정이 하나의 동시성 흐름이라 B가 일관되게 소유합니다. 주차별 병렬 트랙과 Sync Point는 `docs/ROADMAP.md`의 "역할 분담" / "Sync Point" 표가 기준입니다.

## 자주 쓰는 명령어

```bash
# 로컬 인프라 기동 (Postgres 16, Redis 7, Kafka KRaft 단일 브로커)
docker compose up -d

# 빌드
./gradlew build

# 앱 실행 (기본적으로 'local' Spring 프로필 사용)
./gradlew bootRun

# 전체 테스트 실행
./gradlew test

# 단일 테스트 클래스 실행
./gradlew test --tests "com.ticket.ticketflow.TicketflowApplicationTests"

# 단일 테스트 메서드 실행
./gradlew test --tests "com.ticket.ticketflow.TicketflowApplicationTests.contextLoads"

# 앱 기동 후 헬스체크
curl localhost:8080/actuator/health
```

**`./gradlew build`는 인프라가 떠 있어야 성공합니다.** `TicketflowApplicationTests.contextLoads()`가 실제 Postgres에 붙어 Flyway를 실행하므로, `docker compose up -d`를 먼저 하지 않으면 `FlywaySqlUnableToConnectToDbException`으로 빌드가 실패합니다. 테스트 명령을 안내하거나 CI를 구성할 때 이 의존성을 반드시 고려하세요(Testcontainers 도입 전까지의 제약이며, 로드맵에 기록됨).

로컬 인프라 접속 정보(Postgres `ticketflow`/`ticketflow`, Redis 6379, Kafka 9092)는 `docker-compose.yml`과 `src/main/resources/application-local.yml`에 있습니다. DB 비밀번호는 로컬 전용 목적으로 평문 커밋되어 있으며, JWT secret을 추가하기 전에 환경변수 방식으로 전환이 필요합니다(로드맵에 기록됨).

## 아키텍처

**스택**: **Java 26**(toolchain 확정 — 팀 전원 JDK 26 사용, 다른 버전으로 낮추지 마세요), Spring Boot 4.1.0, Spring Security 7.1, Gradle 9.5.1(Groovy DSL), PostgreSQL 16, Redis 7, Kafka(KRaft), Flyway, Lombok, jjwt 0.12.6.

**패키지 구조** (`com.ticket.ticketflow`): 도메인 주도 구조로, `domain/` 하위 각 도메인 패키지(`booking`, `payment`, `performance`, `user`, `notification`)마다 `controller/dto/entity/repository/service` 서브패키지를 둡니다. 횡단 관심사 코드는 `global/`(`common`, `config`, `exception`, `security`) 하위에 위치합니다.

**스키마 소유권은 Flyway**: `spring.jpa.hibernate.ddl-auto: validate`로 설정되어 있어 Hibernate는 스키마를 변경하지 않고 기동 시 엔티티와 스키마 일치 여부만 검증합니다. 즉 **JPA 엔티티가 Flyway 마이그레이션과 정확히 일치하지 않으면 앱이 아예 뜨지 않습니다**. `src/main/resources/db/migration/V1__init.sql`을 엔티티 필드/제약조건의 근거로 삼고, V1을 직접 수정하지 말고 새 마이그레이션을 추가하세요(파일명은 아래 "Flyway 마이그레이션 버전 규칙" 준수).

### 핵심 스키마/설계 결정 (전체 근거는 V1__init.sql과 로드맵 참고)

- **공연(`performance`) 1건 = 공연장 1곳.** 투어 공연은 하나의 공연을 여러 공연장에 매핑하는 대신 별도의 `performance` 행으로 등록합니다.
- **`booking`(주문)과 `booking_seat`(개별 좌석)를 분리**한 이유는 한 번의 예매가 2~4석을 함께 포함하기 때문입니다 — 이렇게 하면 하나의 결제/취소가 주문 전체에 적용됩니다.
- **`session_seat`에 `HELD` 상태 없음.** 임시 좌석 선점은 오직 Redis(TTL 락)에만 존재하며, DB는 영구 상태(`AVAILABLE`/`SOLD`)만 기록합니다. 임시 락 상태를 DB에 섞으면 Redis/DB 간 상태 불일치 버그 위험이 커지므로 의도적으로 배제한 설계입니다.
- **`uq_booking_seat_active`**는 `booking_seat.session_seat_id`에 대한 부분 유니크 인덱스(`WHERE status = 'ACTIVE'`)로, Redis 락이 어떤 이유로든 뚫리더라도 중복 예매를 막는 최후 방어선입니다. 좌석 예약 로직은 이 제약 위반(→ `DataIntegrityViolationException`으로 포착)을 Redis 락과는 별개의 최종 검증 수단으로 취급해야 합니다.
- 테이블명은 `user`가 아닌 `users`입니다(Postgres 예약어 회피). `session` 도메인 개념(공연 회차)은 Hibernate의 `Session`, HTTP 세션과 이름이 겹치므로, JPA 엔티티 작성 시 클래스명을 다르게(예: `PerformanceSession`) 지어 구분해야 합니다.

### 예매 확정 트랜잭션 흐름 (설계는 확정, 구현은 아직)

**결제 전후로 트랜잭션을 2개로 나누는 것이 이 설계의 핵심입니다.** 중복 예매 검증(`uq_booking_seat_active`)을 결제보다 **앞으로** 배치해, "결제는 성공했는데 좌석은 뺏긴" 상태가 구조적으로 발생하지 않게 합니다. 결제를 먼저 호출하는 순서로 되돌리지 마세요 — `payment.booking_id`가 NOT NULL FK라 물리적으로도 불가능합니다.

1. 가상 대기실 입장 토큰을 검증합니다.
2. 좌석별로 Redis 분산 락을 획득합니다: `seat:lock:{session_seat_id}` (TTL 5~10분). 여러 좌석을 동시에 잠글 때는 **좌석 ID를 정렬한 순서대로 락을 획득**하여 요청 간 데드락을 방지하고, 배치 내 어느 좌석이라도 실패하면 이미 획득한 락을 모두 해제하고 실패 응답합니다.
3. **트랜잭션 T1**: `booking` INSERT(`PENDING`) → `booking_seat` INSERT(`ACTIVE`). 여기서 `uq_booking_seat_active` 위반(→ `DataIntegrityViolationException`)이 발생하면 중복 예매이므로 즉시 거절합니다. **아직 결제 전이므로 보상 처리가 필요 없습니다.**
4. Mock 결제 API를 호출합니다. 실패 시 T1을 되돌립니다(`booking` → `CANCELLED`, `booking_seat` → `CANCELLED`).
5. **트랜잭션 T2**: `payment` INSERT → `booking.status = 'CONFIRMED'` → `session_seat.status = 'SOLD'` UPDATE.
6. 커밋 후 Redis 락을 해제하고 Kafka 이벤트를 발행합니다.

`session_seat`는 T2에서만 `SOLD`가 되므로, PENDING 상태로 이탈한 예매는 `booking_seat`만 `CANCELLED`로 바꾸면 좌석이 자동으로 반환됩니다(`session_seat`는 그대로 `AVAILABLE`).

### Spring Security 7.1 / jjwt 0.12.6 API 주의사항

인터넷의 예제 대부분은 구버전 기준이라 그대로 쓰면 컴파일되지 않습니다.
- `WebSecurityConfigurerAdapter` 없음 — `SecurityFilterChain` 빈 등록 방식만 사용.
- `antMatchers()` 제거됨 — `requestMatchers()` 사용.
- 람다 DSL이 기본: `http.csrf(csrf -> csrf.disable())`.
- jjwt: `Jwts.parserBuilder()` → `Jwts.parser()`, `parseClaimsJws()` → `parseSignedClaims()`, 키 생성은 `Keys.hmacShaKeyFor(byte[])`. 문서/예제 검색 시 "jjwt 0.12" 버전을 명시하세요 — 0.11 예제는 제거된 메서드를 사용합니다.

## 팀 협업 규칙 (2인 병렬 개발 — 반드시 준수)

백엔드 2인이 같은 레포에서 병렬 작업하므로, 아래 규칙은 스타일 취향이 아니라 **머지 충돌과 상호 블로킹을 구조적으로 없애기 위한 제약**입니다. 코드를 생성할 때 이 규칙을 어기는 형태를 제안하지 마세요.

### Flyway 마이그레이션 버전 규칙

새 마이그레이션 파일명은 **타임스탬프 버전**을 사용합니다: `V{yyyyMMddHHmm}__설명.sql` (예: `V202607211530__add_notification.sql`).

순차 번호(`V2__`, `V3__`)를 쓰면 두 사람이 각자 브랜치에서 같은 번호를 만들어 머지 시점에 반드시 깨집니다. 타임스탬프는 충돌하지 않습니다. **기존 `V1__init.sql`은 그대로 두고, 신규 파일부터 이 규칙을 적용하세요.**

### 도메인 간 접근 규칙

`domain/` 하위 패키지는 담당자가 나뉘어 있으므로 경계를 넘는 방식이 정해져 있습니다.

1. **다른 도메인의 Repository를 직접 주입하지 마세요.** 반드시 그 도메인의 Service를 경유합니다.
2. 다른 도메인의 **엔티티 참조는 읽기 목적의 `@ManyToOne(fetch = LAZY)`까지만** 허용합니다.
3. **다른 도메인의 상태 변경은 그 도메인이 제공하는 Service 메서드로만** 수행합니다.

예: 예매 확정 시 `session_seat.status = 'SOLD'` UPDATE는 `booking`이 실행하지만 대상은 `performance` 소유입니다(`booking`/`performance` 둘 다 B 담당이지만 도메인 패키지는 분리되어 있으므로 규칙은 동일하게 적용됩니다). `booking` 코드에서 `SessionSeatRepository`를 직접 쓰지 말고, `performance`가 제공하는 `SessionSeatService.markAsSold(List<Long> sessionSeatIds)`를 호출하세요. 같은 이유로 `booking`의 좌석 선점 API는 `waitingroom`이 제공하는 대기실 입장 토큰 검증 인터페이스를 호출합니다.

이 규칙의 실질적 이점은 **한쪽이 인터페이스 시그니처만 먼저 커밋하면 상대는 구현 완료를 기다리지 않고 병렬로 작업할 수 있다**는 점입니다.

### ErrorCode 분리 규칙

`ErrorCode`를 단일 enum으로 만들지 마세요. 두 사람이 기능마다 같은 파일을 수정해 충돌이 반복됩니다.

```
global/exception/ErrorCode.java          # interface (code, httpStatus, message)
global/exception/CommonErrorCode.java    # enum implements ErrorCode — 공통만
domain/user/exception/UserErrorCode.java         # A
domain/booking/exception/BookingErrorCode.java   # B
```

도메인별 enum은 담당자 본인만 수정하므로 충돌이 발생하지 않습니다.

### `global/` 패키지 변경

`global/` 하위(`ApiResponse`, `ErrorCode` 계열, `GlobalExceptionHandler`, `SecurityConfig`, `BaseTimeEntity`)는 **두 사람 모두가 의존하는 공유 기반**입니다. 최초 1회 한 사람이 스켈레톤을 확정해 머지한 뒤에는, 변경 시 반드시 상대 리뷰를 거칩니다. 기능 개발 중 편의를 위해 임의로 시그니처를 바꾸지 마세요.

### API 경로 소유권

경로 prefix로 담당을 나눠 `SecurityConfig` 화이트리스트 관리와 충돌 방지를 겸합니다.

| prefix | 담당 |
|---|---|
| `/api/auth/**`, `/api/users/**` | A |
| `/api/payments/**` | A |
| `/api/performances/**`, `/api/sessions/**` | B |
| `/api/waiting/**` | B |
| `/api/bookings/**` | B |

좌석 **조회**는 `/api/sessions/{id}/seats`(B), 좌석 **선점/확정**은 `/api/bookings/**`(B)로 분리합니다(둘 다 B 담당이지만 조회는 카탈로그, 선점/확정은 예매 도메인 소유이므로 패키지 경계는 유지합니다).

### 네이밍 확정 사항

- 회차 엔티티 클래스명은 **`PerformanceSession`**입니다(테이블은 `session`). Hibernate의 `Session`·HTTP 세션과 혼동되므로 `Session`으로 짓지 마세요.
- 가상 대기실은 `domain/waitingroom/` 패키지를 신설해 사용합니다(`booking` 하위 아님).

### Kafka 이벤트 DTO 위치

이벤트 DTO는 `booking`(발행)과 `notification`(소비)이 공유하는 계약입니다. 둘 다 B 담당이지만 서로 다른 도메인 패키지이므로, 어느 한쪽 도메인 패키지에 두면 반대쪽이 그 패키지를 import하게 됩니다. **`global/event/` 중립 패키지**에 정의하세요.

### 브랜치 / 커밋

- `master` 직접 커밋 금지. `feature/{도메인}-{작업}` 브랜치 + PR 리뷰를 거칩니다. 프론트 코드도 리뷰 대상입니다.
- 커밋 메시지는 `feat/fix/chore/docs:` prefix + 한국어 본문(현재 정착된 관행).
