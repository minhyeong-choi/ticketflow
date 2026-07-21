# ticketFlow 로드맵 & 진행 체크리스트

> 프로젝트 전체 계획과 완료 현황을 추적하는 문서입니다. 마일스톤을 끝낼 때마다 체크박스를 갱신하세요.
> 각 단계의 **"보완 필요"** 항목은 초기 계획에서 누락됐던 작업들입니다. 착수 전에 반드시 확인하세요.
>
> 📘 **"어떻게 만드는가"는 [`docs/study/`](study/README.md)에 있습니다.** 이 문서(무엇을 언제) → `docs/study/`(어떤 순서로 어떻게) 순서로 보세요.
> — [공통 워크플로우](study/00-common-workflow.md) / [개발자 A](study/01-developer-a-workflow.md) / [개발자 B](study/02-developer-b-workflow.md)

## 진행 현황 요약

| 단계 | 기간 | 담당 | 상태 |
|---|---|---|---|
| 0. 프로젝트 스캐폴딩 | - | 공동 | ✅ 완료 (2026-07-21 동작 검증 완료) |
| 1. 도메인 모델링 & 인증 | 1~2주차 | 공동 | 🔨 진행 중 (스키마 완료 / 엔티티·인증 미착수) |
| 2. 공연·좌석 조회 + 프론트 | 3~4주차 | B(API) / A(프론트·CI) | ⬜ 대기 |
| 3. 가상 대기실 | 5~6주차 | **B** | ⬜ 대기 |
| 4. 좌석 선점 + 결제 + 예매 확정 | 5~8주차 | **A** | ⬜ 대기 |
| 5. Kafka 이벤트 연동 | 7~10주차 | B | ⬜ 대기 |
| 6. 부하 테스트 | 11주차 | 공동 | ⬜ 대기 |
| 7. 마무리 | 12주차 | 공동 | ⬜ 대기 |

## 착수 전 반드시 읽을 함정 6가지 (2026-07-21 추가)

스키마·버전·프레임워크 동작을 실제로 대조하면서 발견한, **그대로 진행하면 반드시 막히는 지점**들입니다. 각 단계 본문에 상세 설명이 있습니다.

| # | 함정 | 언제 터지는가 | 위치 |
|---|---|---|---|
| ① | `BaseTimeEntity`를 모든 엔티티에 상속시키면 **절반이 기동 실패** — 테이블마다 시간 컬럼이 다름 | 1~2주차 첫날 | 1~2주차 "(1) JPA 엔티티 작성" |
| ② | `TIMESTAMPTZ`를 `LocalDateTime`으로 매핑 → validate 실패 or **시간이 9시간 밀림** | 1~2주차 첫날 | 1~2주차 "(1) JPA 엔티티 작성" |
| ③ | 좌석 선점에 Redisson **`RLock`을 쓸 수 없음** (요청 간 스레드가 달라 `unlock()` 불가) | 5~6주차, 설계 다 짠 뒤 | 5~8주차 |
| ④ | T1/T2를 한 클래스에 두면 **`@Transactional`이 조용히 무시됨** (프록시 self-invocation) | 7~8주차, "롤백이 안 된다"로 발견 | 5~8주차 |
| ⑤ | 시드 벌크 INSERT에서 **`saveAll()`도 배치가 안 먹음** (`IDENTITY` 때문) | 1~2주차, 14,400행 생성 시 | 1~2주차 "(4) 시드 데이터" |
| ⑥ | 1~2주차 "(공동) 기반 동결"이 모호 → **A/B 분담 확정** | 1주차 착수 시점 | "A/B 병렬 트랙" |

> 각 함정의 **코드 수준 해결 방법**은 [`docs/study/`](study/README.md)에 있습니다. 작업 착수 전에 본인 담당 문서를 먼저 읽으세요.

## 프로젝트 개요

- **목표**: 공연(콘서트/뮤지컬) 티켓팅 플랫폼. 핵심 기술 챌린지는 "동시 대량 접속 시 좌석 선점/중복 예매 방지"
- **목적**: 학습/포트폴리오 (실서비스 운영 목표 아님)
- **기간**: 3개월 MVP
- **팀**: 백엔드 2인(기능 단위 수직 분담) + 프론트는 AI 도구로 백엔드 개발자 1인이 겸임
- **스택**: **Java 26**(toolchain 확정), Spring Boot 4.1.0, Spring Security 7.1, Gradle 9.5.1(Groovy), PostgreSQL 16, Redis 7, Kafka(KRaft)
- **MVP 제외**: 스포츠 도메인, 실제 PG 연동, 실명인증/소셜로그인, 실서비스급 배포

## 역할 분담

| 담당 | 도메인 |
|---|---|
| 개발자 A | `booking`(예매/좌석 선점/예매 확정), `payment`(Mock 결제) |
| 개발자 B | `user`, `performance`(공연/좌석 카탈로그), `waitingroom`(가상 대기실), `notification`(Kafka consumer) |
| 프론트엔드 | 팀원 1인이 AI 도구로 생성/유지보수 |

### A/B 병렬 트랙 (담당 배정의 기준)

초기 계획은 마일스톤을 주차별로 한 사람씩 배정해서, **A가 5~8주차 4주간 프로젝트 난이도의 전부(대기열 + 분산 락 + 결제 + 확정 트랜잭션)를 혼자 맡고 그동안 B는 유휴**가 되는 구조였습니다. 아래처럼 재배분해 두 사람 모두 동시성 주제를 하나씩 담당하도록 조정했습니다.

| 주차 | 개발자 A | 개발자 B |
|---|---|---|
| 1~2 | **엔티티 10종 일괄 작성** + springdoc 도입 | `global/` 확정 → **시드 데이터** → 인증(JWT) |
| 3~4 | 프론트 기본 화면 + CI 구축 + Redis 락 PoC | 공연/좌석 조회 API |
| 5~6 | 좌석 선점 (Redisson 분산 락) | 가상 대기실 (Redis ZSET) |
| 7~8 | Mock 결제 + 예매 확정 트랜잭션 + 취소 API | Kafka 연동 + `notification` 스키마 |
| 9~10 | 예매 내역 API + 동시성 통합 테스트 | 프론트 예매 플로우 연동 + DLQ/멱등성 |
| 11 | 부하 테스트 (공동) | 부하 테스트 (공동) |
| 12 | 마무리 (공동) | 마무리 (공동) |

**⚠️ 함정 ⑥ — 1~2주차 분담 확정 (기존 표기 "(공동) 기반 동결"의 모호함 해소)**

"엔티티는 한 사람이 몰아서"와 "1~2주차도 A/B 병렬"이 서로 충돌해 보였습니다. 실제로는 **파일이 겹치지 않아 아래처럼 나누면 충돌 없이 병렬 진행됩니다.**

| | A | B |
|---|---|---|
| Day 1~2 | 엔티티 10종 전부 (`domain/*/entity/`) — `User.java` 포함 | `global/` 공통 인프라 (`ApiResponse`, `ErrorCode` 계열, 예외 핸들러) |
| Day 3~5 | springdoc-openapi 도입 (**3~4주차 → 1~2주차로 당김**) | **시드 데이터** ← A의 블로커라 인증보다 먼저 |
| Day 6~10 | 3~4주차 준비 (Testcontainers, Redis 락 PoC) | 인증 / JWT |

- `domain/user/entity/User.java`도 **A가 작성**하지만 머지 이후 **소유권은 B**입니다. B의 인증 작업은 A가 Day 2에 머지하는 `User` 엔티티에만 의존합니다.
- **springdoc을 1~2주차로 당기는 이유**는 문서화가 아니라 **A/B 사이의 인터페이스 계약**입니다. 2인 병렬 개발에서 API 스펙은 문서가 아니라 개발 순서를 푸는 도구입니다.

**가상 대기실을 B로 이관한 근거**: 대기실은 Redis ZSET 기반 독립 모듈이고 A와의 접점이 "입장 토큰 검증 인터페이스" 하나뿐이라 병렬화 비용이 가장 낮습니다. B가 인터페이스 시그니처만 먼저 커밋하면 A는 구현 완료를 기다리지 않고 좌석 선점을 진행할 수 있습니다.

> 담당 경계를 넘는 호출 규칙, Flyway 버전 규칙, ErrorCode 분리 등 **병렬 개발을 위한 강제 규칙은 `CLAUDE.md`의 "팀 협업 규칙" 섹션**에 명문화되어 있습니다. 작업 시작 전에 반드시 읽으세요.

---

# 0단계 — 프로젝트 스캐폴딩 ✅

- [x] Spring Initializr로 프로젝트 생성 (Gradle Groovy, Spring Boot 4.1.0, group `com.ticket` → 패키지 `com.ticket.ticketflow`)
- [x] build.gradle 의존성 구성 (web, actuator, jpa, redis, kafka, security, validation, flyway, postgresql, lombok, jjwt)
- [x] 도메인별 패키지 구조 생성 및 `src/main/java/com/ticket/ticketflow/` 하위로 위치 정정
- [x] docker-compose.yml 작성 (postgres:16, redis:7, kafka KRaft 단일 브로커)
- [x] `docker compose up -d`로 3개 컨테이너 정상 기동 확인
- [x] application.yml(local 프로필) / application-local.yml(DB·Redis·Kafka 접속 설정) 작성
- [x] `./gradlew build` 성공, `GET /actuator/health` → `{"status":"UP"}` 확인

### 스캐폴딩 동작 검증 (2026-07-21 실측)

| 항목 | 결과 |
|---|---|
| `docker compose up -d` — 컨테이너 3종 | ✅ postgres 16.14 / redis 7 / kafka 모두 Up |
| `./gradlew build` (인프라 기동 상태) | ✅ BUILD SUCCESSFUL |
| Flyway V1 적용 | ✅ `flyway_schema_history` v1 success, 테이블 10개 + 이력 테이블 생성 확인 |
| `ddl-auto: validate` | ✅ 엔티티가 아직 없어 검증 대상 없음 — 통과 |
| 앱 기동 | ✅ `Started TicketflowApplication in 1.952 seconds` |
| `GET /actuator/health` | ✅ `{"status":"UP"}` (인증 없이 200) |
| Spring Security 기본 동작 | ✅ `GET /` → 401 (기본 필터체인 활성, `SecurityConfig` 작성 전이므로 정상) |
| Redis 연결 | ✅ `PING` → `PONG` |

**결론: 스캐폴딩은 정상입니다.** 다만 아래 미해결 항목 2건이 실측 과정에서 새로 드러났습니다.

### 미해결 항목
- [ ] 🔴 **`./gradlew build`가 인프라 없이는 실패함** — `TicketflowApplicationTests.contextLoads()`가 실제 Postgres에 붙어 Flyway를 실행하므로, 컨테이너가 꺼진 상태에서는 `FlywaySqlUnableToConnectToDbException`으로 빌드가 깨집니다.
      → **CI 쪽은 해결됨**: `.github/workflows/ci.yml`이 postgres/redis service container를 띄웁니다
      → **로컬은 미해결**: clone 직후 `docker compose up -d` 없이 빌드하면 여전히 실패합니다. 근본 해결은 `@ServiceConnection` + Testcontainers(3~4주차). 도입하면 CI의 services 블록도 함께 제거 가능
- [x] ~~`spring.jpa.open-in-view` 기본값 true~~ → **`application.yml`에 `false` 명시 완료.** OSIV는 요청 종료까지 DB 커넥션을 점유해 좌석 경합 구간에서 커넥션 풀 고갈을 유발할 수 있어 껐습니다. **부수효과: 지연 로딩이 트랜잭션(서비스 계층) 안에서만 동작하므로, 컨트롤러/뷰에서 LAZY 필드에 접근하면 `LazyInitializationException`이 납니다. DTO 변환을 서비스 계층에서 끝내세요**
- [ ] `redisson-spring-boot-starter` 주석 처리 상태 → **5~6주차(좌석 선점) 착수 전** 활성화
- [x] ~~Java toolchain 버전 불일치~~ → **Java 26으로 확정.** 팀 전원 JDK 26 사용하며 21로 낮추지 않습니다
- [x] ~~팀원 JDK 26 온보딩~~ → **`settings.gradle`에 foojay-resolver-convention 1.0.0 추가 완료.** 로컬에 JDK 26이 없어도 Gradle이 자동으로 받아옵니다
- [x] ~~Docker 이미지 태그 고정~~ → **`apache/kafka:latest` → `apache/kafka:4.3.1` 고정 완료** (기동 확인)
- [ ] `application-local.yml`에 DB 비밀번호가 평문으로 커밋되어 있음 → 로컬 전용이라 당장은 무해하나, JWT secret이 추가되기 전에 환경변수 방식으로 전환 권장

---

# 1~2주차 — 도메인 모델링 & 인증 🔨

## 완료

- [x] ERD 확정 — 총 10개 테이블
      `users / venue / venue_seat / performance / seat_grade / session / session_seat / booking / booking_seat / payment`
- [x] Flyway 마이그레이션 작성 (`src/main/resources/db/migration/V1__init.sql`)
- [x] 마이그레이션 적용 확인 (`flyway_schema_history` v1 success)
- [x] 중복 예매 방지 제약 동작 검증 — 동일 좌석 2건 INSERT 시 `uq_booking_seat_active` 위반으로 거부, 취소 후 재예매는 정상 통과
- [x] `spring.jpa.hibernate.ddl-auto: validate` 설정 (스키마 소유권을 Flyway로 고정)

### 스키마 설계 핵심 결정 (면접/문서화용 근거)

- **공연 1건 = 공연장 1곳** (투어는 별도 공연으로 등록). 좌석 등급 매핑을 공연 단위로 한 번만 정의하기 위함
- **예매는 주문(booking) + 좌석(booking_seat) 분리**. 한 번에 2~4석 예매가 실제 요구사항이라 1좌석=1예매 구조로는 합산 결제·전체 취소가 불가능
- **`session_seat.status`에 HELD 없음**. 임시 점유는 Redis TTL 락, 영구 상태만 DB. 두 저장소 간 상태 동기화 버그를 원천 차단
- **`uq_booking_seat_active`** (부분 유니크 인덱스): 취소되지 않은 예매는 좌석당 1건만 허용. Redis 락이 뚫려도 DB가 물리적으로 거부하는 최후 방어선

## 남은 작업

### (1) JPA 엔티티 작성 — ⚠️ 초기 계획에 누락됐던 항목

마이그레이션과 별개로 엔티티 클래스를 직접 작성해야 합니다. `ddl-auto: validate`이므로 **엔티티와 스키마가 어긋나면 앱이 아예 뜨지 않습니다** (조기 발견 장치로 유용).

> ⚠️ **엔티티 10종은 A/B로 분담하지 말고 한 사람이 몰아서 작성한 뒤 머지하세요.** `ddl-auto: validate` 환경에서는 엔티티 하나만 스키마와 어긋나도 앱이 뜨지 않으므로, 절반만 머지된 중간 상태에서는 **두 사람 다 아무것도 실행하지 못합니다.** 1주차는 병렬 개발 구간이 아니라 "기반 동결" 구간으로 취급하세요.

- [ ] `global/common/BaseCreatedEntity` / `BaseTimeEntity` — **공통 부모는 2개로 나눠야 합니다** (아래 함정 ① 참고)
- [ ] ~~`global/config/JpaAuditingConfig`~~ → **선택 사항으로 강등.** `@PrePersist`/`@PreUpdate`(순수 JPA)로 처리하면 설정 클래스와 `OffsetDateTime` 변환기 이슈가 사라집니다. `@CreatedBy`가 필요해지면 그때 Auditing으로 전환
- [ ] 도메인별 엔티티 10종 — **한 사람이 일괄 작성 → 앱 기동 확인 → 머지** (분담 금지)
- [ ] 연관관계는 **전부 `LAZY`**, `@ManyToOne`만 사용 — 양방향 매핑은 필요할 때만 추가

#### ⚠️ 함정 ① — `BaseTimeEntity`를 전부 상속시키면 엔티티 절반이 기동에 실패합니다

블로그 예제는 모든 엔티티에 `BaseTimeEntity`를 상속시키라고 하지만, **이 스키마는 테이블마다 시간 컬럼이 다릅니다.** `validate` 환경에서 없는 컬럼을 선언하면 `Schema-validation: missing column` 으로 앱이 뜨지 않습니다.

| `created_at` + `updated_at` | `created_at` 만 | 시간 컬럼 없음 |
|---|---|---|
| `users`, `performance` | `venue`, `session`, `booking`, `payment` | `venue_seat`, `seat_grade`, `session_seat`, `booking_seat` |
| → `BaseTimeEntity` 상속 | → `BaseCreatedEntity` 상속 | → **상속하지 않음** |

`session_seat`·`booking_seat`에 시간 컬럼이 없는 건 누락이 아니라, 회차당 수천 건이 벌크 생성되는 테이블이라 행 크기를 줄인 의도적 설계입니다. **나중에 편의를 위해 상속시키지 마세요.**

#### ⚠️ 함정 ② — `TIMESTAMPTZ`는 반드시 `OffsetDateTime`으로 매핑합니다

`LocalDateTime`은 "타임존 없는 시각"이라 Postgres의 `timestamp with time zone`과 타입이 어긋납니다. `wrong column type ... found [timestamp], expected [timestamptz]` 로 걸리거나, 통과하더라도 **시간이 9시간씩 밀리는 버그가 나중에 터집니다.** `Date`·`LocalDateTime` 금지, **팀 전체가 `OffsetDateTime` 하나로 통일**합니다.

**네이밍 확정**: 회차 엔티티 클래스명은 **`PerformanceSession`**으로 확정합니다(테이블명은 `session` 유지). Java 클래스명 `Session`은 Hibernate의 `Session`·HTTP 세션과 겹쳐 import 혼동이 잦고, A/B 양쪽이 모두 참조하는 엔티티라 나중에 이름을 바꾸면 두 사람 코드가 동시에 흔들립니다.

### (2) 공통 인프라 — ⚠️ 초기 계획에 누락됐던 항목

`global/` 패키지를 만들어뒀지만 계획에는 없던 작업입니다. 인증보다 **먼저** 잡아두면 이후 모든 API가 일관됩니다. 엔티티와 마찬가지로 **한 사람이 스켈레톤을 확정해 머지한 뒤 병렬 작업을 시작**하고, 이후 변경은 상대 리뷰를 거칩니다.

- [ ] `global/common/ApiResponse<T>` — 공통 응답 포맷
- [ ] `global/exception/ErrorCode` (**enum이 아니라 interface**) + `BusinessException`
      - ⚠️ 단일 enum으로 만들면 A/B가 기능마다 같은 파일을 수정해 충돌이 반복됩니다. `interface ErrorCode` + `CommonErrorCode`(공통) + 도메인별 enum(`UserErrorCode`, `BookingErrorCode` …)으로 분리하세요. 상세 규칙은 `CLAUDE.md` 참고
- [ ] `global/exception/GlobalExceptionHandler` — `@RestControllerAdvice`
      - Bean Validation 실패(`MethodArgumentNotValidException`) 처리 포함
      - **5~8주차 대비**: `DataIntegrityViolationException`(유니크 제약 위반)을 "이미 예매된 좌석"으로 변환하는 처리가 여기 들어감
- [ ] `global/event/` 패키지 신설 — Kafka 이벤트 DTO의 중립 지대. A(발행)와 B(소비)가 공유하는 계약이라 어느 한쪽 도메인에 두면 반대쪽이 그 패키지를 import하게 됩니다

### (3) 회원가입 / 로그인 + JWT — 직접 구현 예정

#### 만들 파일

```
global/config/SecurityConfig.java          # 필터체인, PasswordEncoder 빈
global/security/JwtTokenProvider.java      # 토큰 생성/파싱/검증
global/security/JwtAuthenticationFilter.java  # OncePerRequestFilter
global/security/CustomUserDetails.java     # (선택) UserDetails 구현
domain/user/entity/User.java
domain/user/repository/UserRepository.java
domain/user/service/AuthService.java
domain/user/controller/AuthController.java
domain/user/dto/{SignupRequest, LoginRequest, TokenResponse}.java
```

#### 먼저 정해야 할 것

| 결정 항목 | 권장안 | 이유 |
|---|---|---|
| Access Token 만료 | 30분 | 티켓팅 세션 길이 고려 |
| Refresh Token | **MVP에서는 생략 가능** | 3개월 일정상 핵심(동시성)이 아님. 넣는다면 Redis에 저장 |
| 토큰 전달 방식 | `Authorization: Bearer` 헤더 | 프론트가 별도 오리진이라 쿠키보다 단순 |
| 서명 알고리즘 | HS256 (대칭키) | 단일 서버 구조라 RS256 불필요 |
| secret 관리 | 환경변수 주입 | yml 하드코딩 시 git에 그대로 남음 |
| 비밀번호 해싱 | BCrypt (`BCryptPasswordEncoder`) | 스키마의 `password VARCHAR(255)`가 이미 이를 전제 |

#### ⚠️ 버전 관련 함정 두 가지

**1. Spring Security 7.1** — 인터넷 예제 대부분이 5.x 기준이라 그대로 쓰면 컴파일되지 않습니다.
- `WebSecurityConfigurerAdapter` 상속 방식: **제거됨**(6.0~). `SecurityFilterChain` 빈 등록 방식만 유효
- `antMatchers()`: **제거됨**. `requestMatchers()` 사용
- 람다 DSL이 기본 (`http.csrf(csrf -> csrf.disable())` 형태)
- JWT는 stateless이므로 `SessionCreationPolicy.STATELESS` + CSRF 비활성 조합이 표준

**2. jjwt 0.12.6** — 0.11.x에서 API가 크게 바뀌었습니다.
- 파싱: `Jwts.parserBuilder()` → **`Jwts.parser()`**, `parseClaimsJws()` → **`parseSignedClaims()`**
- 서명: `signWith(key, alg)` 시그니처 변경, `Keys.hmacShaKeyFor(byte[])`로 키 생성
- 검색 시 **"jjwt 0.12" 버전을 명시**해서 찾으세요. 0.11 예제를 그대로 쓰면 메서드가 없습니다

#### 체크리스트

- [ ] `SecurityConfig` — 필터체인, 화이트리스트(`/api/auth/**`, `/actuator/health`), STATELESS 설정
- [ ] `JwtTokenProvider` — 생성/검증/클레임 추출, 만료·위조 예외 구분
- [ ] `JwtAuthenticationFilter` — 헤더 파싱 → `SecurityContext` 주입
- [ ] `POST /api/auth/signup` — 이메일 중복 검사(`uq_users_email` 위반도 함께 처리)
- [ ] `POST /api/auth/login` — 비밀번호 검증 → 토큰 발급
- [ ] `GET /api/users/me` — 인증 필요 API로 동작 확인
- [ ] 인증 실패 응답이 HTML이 아닌 JSON으로 나오는지 확인 (`AuthenticationEntryPoint` 커스터마이징)

### (4) 시드 데이터 — ⚠️ 초기 계획에 누락됐던 항목

3주차부터 조회 API를 만들려면 공연·좌석 데이터가 있어야 합니다. **공연장 좌석은 수백~수천 건**이라 수동 INSERT가 불가능합니다.

> ⚠️ **이 항목은 1~2주차 안에서 최우선입니다.** 시드는 B 담당이지만 실제로는 **A의 블로커**입니다 — `session_seat` 데이터가 없으면 A는 좌석 선점 로직을 개발도 테스트도 할 수 없습니다. 인증보다 먼저 끝내도 무방합니다.

- [ ] 방식 결정: Flyway 마이그레이션 vs `local` 프로필 전용 `CommandLineRunner`
      → 반복 초기화가 잦으므로 **CommandLineRunner 권장** (Flyway는 한 번 적용되면 재실행 불가)
      → Flyway로 갈 경우 파일명은 타임스탬프 규칙(`V{yyyyMMddHHmm}__seed.sql`)을 따르세요
- [ ] 공연장 1곳 + 좌석 500~2000석 생성 (`generate_series` 또는 반복문)
- [ ] 공연 2~3건, 회차 각 3~5개, 등급 4종
- [ ] `session_seat` 생성 로직 — **회차 1개당 좌석 전체를 복제**하므로 벌크 INSERT 필요 (공연 3건 × 회차 4개 × 1200석 = 14,400행)

#### ⚠️ 함정 ⑤ — `saveAll()`도 느립니다. JDBC batch가 아예 동작하지 않습니다

건별 `save()`가 느린 건 알려져 있지만, **`saveAll()`로 바꾸거나 `hibernate.jdbc.batch_size`를 키워도 소용없습니다.** 엔티티가 `GenerationType.IDENTITY`(= `BIGSERIAL`)를 쓰기 때문입니다. IDENTITY는 INSERT를 실행해야 ID를 알 수 있어서 **Hibernate가 JDBC 배치를 사용할 수 없습니다.** JPA를 아는 사람도 잘 모르는 함정입니다.

→ **해결: `INSERT ... SELECT`로 DB 안에서 끝냅니다.** 데이터가 네트워크를 한 번도 건너오지 않습니다.

```sql
-- 물리 좌석 1,200석 (4구역 × 10열 × 30번)
INSERT INTO venue_seat (venue_id, section, row_label, seat_number, pos_x, pos_y)
SELECT ?, sec.name, chr(64 + r)::varchar, n::varchar, n, r
FROM (VALUES ('FLOOR-A'), ('FLOOR-B'), ('2F-L'), ('2F-R')) AS sec(name),
     generate_series(1, 10) AS r, generate_series(1, 30) AS n;

-- 회차별 판매 좌석 복제 (한 방 쿼리) — section 기준으로 등급 매핑
INSERT INTO session_seat (session_id, venue_seat_id, seat_grade_id, status)
SELECT s.id, vs.id, sg.id, 'AVAILABLE'
FROM session s
JOIN performance p ON p.id = s.performance_id
JOIN venue_seat vs ON vs.venue_id = p.venue_id
JOIN seat_grade sg ON sg.performance_id = p.id AND sg.name = CASE
        WHEN vs.section LIKE 'FLOOR%' THEN 'VIP'
        WHEN vs.section LIKE '2F%'    THEN 'R'
        ELSE 'S' END
WHERE s.id = ?;
```

- [ ] 시드 생성기는 **멱등**해야 합니다 — 앱을 재시작할 때마다 데이터가 두 배로 늘면 안 됩니다 (`SELECT count(*) FROM venue > 0` 이면 skip)
- [ ] `booking_open_at`을 **과거 / 몇 분 후 / 내일**로 섞어 두세요. 5~6주차 대기실 로직 테스트에 필요합니다

## 완료 기준
회원가입 → 로그인 → `GET /api/users/me` 호출 성공 + 시드 데이터로 공연/좌석 조회 가능

---

# 3~4주차 — 공연/좌석 조회 (B) + 프론트 기본 화면 (A)

> B가 조회 API를, **A가 프론트 기본 화면 + CI 구축 + Redis 락 PoC**를 병행합니다. 기존 계획에서 이 구간은 B 단독이라 A가 유휴 상태였습니다.

- [ ] `GET /api/performances` — 목록 (페이징)
- [ ] `GET /api/performances/{id}` — 상세 + 회차 목록
- [ ] `GET /api/sessions/{id}/seats` — 좌석 배치도 + 잔여 상태
- [ ] 프론트 목록/상세/좌석 화면 (AI 생성) + API 연동

### 보완 필요 (초기 계획 누락)
- [ ] **좌석 조회 응답 크기** — 2000석이면 JSON이 수백KB. 등급/구역 단위 요약 + 개별 좌석 분리 응답 고려. 대기실 뒤에 붙는 최고 트래픽 API이므로 **Redis 캐싱 대상 1순위**
- [ ] **CORS 설정** — 프론트가 별도 포트/오리진이면 필수. `SecurityConfig`와 함께 설정
- [ ] **API 문서화** — `springdoc-openapi` 도입. ⚠️ **3~4주차가 아니라 1~2주차에 넣으세요.** 프론트 생성 품질도 이유지만, 더 큰 이유는 **A와 B 사이의 인터페이스 계약**입니다. 2인 병렬 개발에서 API 스펙은 문서가 아니라 개발 순서를 푸는 도구입니다
- [ ] **프론트 코드 위치** — 같은 레포 `frontend/` 하위 vs 별도 레포. 미결정 상태
- [ ] **N+1 쿼리** — 공연 목록에서 회차·등급을 함께 조회할 때 발생. `fetch join` 또는 `@BatchSize`

**완료 기준**: 프론트에서 목록 → 상세 → 좌석 배치도 조회 가능

---

# 5~6주차 — 가상 대기실 (B)

> 담당이 A → **B**로 변경되었습니다. 같은 기간에 A는 좌석 선점(분산 락)을 병렬로 진행합니다. 패키지는 `booking` 하위가 아니라 **`domain/waitingroom/`을 신설**해 사용하세요.
>
> **A와의 접점은 입장 토큰 검증 인터페이스 하나뿐입니다.** B는 구현보다 **인터페이스 시그니처를 먼저 커밋**하세요 — A의 좌석 선점 API가 이 검증을 호출해야 하므로, 시그니처가 없으면 A가 블로킹됩니다.

- [ ] Redis 기반 대기열 진입 API (순번 발급)
- [ ] 순번 조회 API (내 앞에 몇 명)
- [ ] 입장 토큰 발급/검증
- [ ] 처리율에 따라 대기열에서 입장 허용

### 보완 필요 (초기 계획 누락)
- [ ] **자료구조 선택** — ZSET(score=진입시각) vs List vs Stream. ZSET이 순번 조회(`ZRANK`)에 유리
- [ ] **이탈자 처리** — 대기 중 브라우저를 닫으면 큐에 유령이 남음. 순번 조회 폴링을 heartbeat로 활용해 TTL 갱신, 미갱신 시 제거
- [ ] **중복 진입 방지** — 새로고침/멀티탭으로 여러 순번을 받으면 순서가 무의미해짐. 유저 ID 기준 멱등 처리 필요
- [ ] **순번 전달 방식** — 폴링(단순) vs SSE(실시간). 폴링 주기가 짧으면 그 자체가 부하가 됨
- [ ] **처리율 결정 기준** — "초당 N명 입장"의 N을 뭘 근거로 정할지. 11주차 부하 테스트 결과와 연동되어야 함
- [ ] **입장 토큰 TTL** — 입장 후 좌석 선택까지 유효 시간. A가 같은 기간에 정하는 좌석 락 TTL과 정합성 필요 (**A/B가 함께 결정해야 하는 유일한 수치**)
- [ ] **대기열 우회 경로 차단** — 입장 토큰 없이 좌석 API를 직접 호출하면 대기실이 무의미. 좌석 선점 API에 토큰 검증 필수
- [ ] **저트래픽 회차** — 대기 인원이 없으면 즉시 통과시키는 fast-path

**완료 기준**: 동시 요청 시 순번대로 토큰 발급됨을 로컬에서 확인

---

# 5~8주차 — 좌석 선점 + Mock 결제 + 예매 확정 (A)

기간이 7~8주차 → **5~8주차 4주**로 확장되었습니다(대기실이 B로 이관되면서 A가 앞당겨 착수). 5~6주차에 좌석 선점, 7~8주차에 결제·확정·취소를 진행합니다.

- [ ] 좌석 선점 API — 분산 락(TTL 자동 해제)
- [ ] 선점 해제 API (사용자가 좌석 선택 취소)
- [ ] Mock 결제 API
- [ ] 예매 확정 트랜잭션

### ⚠️ 함정 ③ — 좌석 선점에 Redisson `RLock`을 쓸 수 없습니다 (설계 변경)

기존 계획의 "`redisson-spring-boot-starter` 활성화 + `RedissonConfig`" 항목은 **재검토가 필요합니다.**

인터넷의 "Redisson 분산 락" 예제는 전부 `lock.lock()` → `finally { lock.unlock(); }` 형태인데, **`RLock`은 획득한 스레드가 해제하는 재진입 락**입니다. 그런데 우리의 좌석 선점은:

```
HTTP 요청 A: 좌석 락 획득  →  (사용자가 5분간 결제 진행)  →  HTTP 요청 B: 확정 후 해제
     ↑ 스레드 1                                                      ↑ 스레드 2
```

**요청마다 스레드가 다르므로 요청 B에서 `unlock()`을 부르면 `IllegalMonitorStateException`이 납니다.** 요청 간에 걸쳐 유지되는 점유는 `RLock`으로 구현할 수 없습니다.

| 상황 | 쓸 것 |
|---|---|
| 한 요청 안에서 시작·종료되는 짧은 임계 구역 | `RLock` (Redisson) |
| **요청을 넘어 유지되는 점유 (= 우리의 좌석 선점)** | **`SET key {userId} NX EX {ttl}`** (소유자 값 비교 방식) |

→ **결정 필요**: 좌석 선점은 `StringRedisTemplate`의 `setIfAbsent(key, userId, TTL)`로 구현하고, 해제는 **Lua 스크립트로 "값이 내 userId일 때만 DEL"** 처리합니다(`GET` 후 `DEL`로 나누면 그 사이 TTL 만료 시 **남의 락을 지웁니다** — 분산 락에서 가장 유명한 버그).
그 결과 **Redisson 의존성 자체가 불필요해질 수 있습니다.** 학습 목적으로 남긴다면 "짧은 임계 구역용"으로 용도를 한정하고, 그렇지 않다면 주석 처리된 의존성을 그대로 두는 편이 낫습니다.

- [ ] 좌석 선점 구현 방식 결정 (`SETNX + Lua` 확정 / Redisson 유지 여부)
- [ ] 결정에 따라 `redisson-spring-boot-starter` 활성화 or 제거

### 예매 확정 트랜잭션 흐름 (설계 확정본 — 2026-07-21 개정)

> **개정 사유**: 기존 흐름은 "3. 결제 → 4. `booking` INSERT" 순서였는데, `payment.booking_id`가 **NOT NULL FK**라 booking이 없는 상태에서 payment를 INSERT할 수 없습니다. 스키마상 실행이 불가능한 순서였습니다.
>
> 이를 고치면서 **중복 예매 검증을 결제보다 앞으로** 옮겼습니다. 그 결과 아래 "결제 실패 시 보상" 문제가 설계 단계에서 사라집니다.

1. 입장 토큰 검증 (B가 제공하는 검증 인터페이스 호출)
2. Redis 락 획득 — `seat:lock:{session_seat_id}`, TTL 5~10분. **좌석 ID 정렬 순으로 획득**, 하나라도 실패하면 획득분 전량 해제 후 거절
3. **트랜잭션 T1** — `booking` INSERT(`PENDING`) → `booking_seat` INSERT(`ACTIVE`)
      - 여기서 `uq_booking_seat_active` 위반(`DataIntegrityViolationException`)이 나면 중복 예매이므로 즉시 거절
      - **아직 결제 전이므로 보상 처리가 필요 없음** ← 이 배치가 개정의 핵심
4. Mock 결제 호출. 실패 시 T1 되돌림(`booking`·`booking_seat` → `CANCELLED`)
5. **트랜잭션 T2** — `payment` INSERT → `booking.status = 'CONFIRMED'` → `session_seat.status = 'SOLD'` UPDATE
6. 커밋 후 Redis 락 해제 + Kafka 이벤트 발행

`session_seat`는 T2에서만 `SOLD`가 되므로, PENDING으로 이탈한 예매는 `booking_seat`만 `CANCELLED`로 바꾸면 좌석이 자동 반환됩니다(`session_seat`는 계속 `AVAILABLE`). 만료 처리 로직이 단순해집니다.

### ⚠️ 함정 ④ — T1/T2 분리는 **클래스를 나눠야** 실제로 동작합니다

위 흐름을 한 클래스 안에 그대로 옮기면 **트랜잭션이 전혀 걸리지 않습니다.**

```java
@Service
public class BookingService {
    public void confirm() {
        createPending();   // ❌ 자기 자신 호출 → 프록시를 안 거침 → @Transactional 무시됨
        paymentService.pay();
        confirmBooking();  // ❌ 마찬가지
    }
    @Transactional public void createPending()  { ... }
    @Transactional public void confirmBooking() { ... }
}
```

Spring의 `@Transactional`은 **프록시 객체**로 동작하는데, 같은 클래스 내부 호출은 프록시를 거치지 않습니다. **컴파일 에러도 런타임 예외도 없이 조용히 트랜잭션 없이 실행**되므로, 나중에 "롤백이 안 된다"로 발견하게 됩니다.

→ **해결: 흐름 담당과 트랜잭션 담당 클래스를 분리합니다.**

| 클래스 | `@Transactional` | 역할 |
|---|---|---|
| `BookingFacade` | **없음** | 1~6단계 흐름 조율. 토큰 검증 → 락 확인 → T1 호출 → **결제 호출(트랜잭션 밖)** → T2 호출 → 락 해제 |
| `BookingTransactionService` | 메서드마다 있음 | `createPending()`(T1) / `cancelPending()`(보상) / `confirmBooking()`(T2) |

- [ ] `BookingFacade` / `BookingTransactionService` 2개 클래스로 분리
- [ ] T1에서 `bookingSeatRepository.flush()` **명시 호출** — JPA는 기본적으로 커밋 시점에 INSERT를 보내므로, `flush()` 없이는 `DataIntegrityViolationException`이 메서드 밖에서 터져 `catch`가 잡지 못합니다
- [ ] 결제 호출은 **반드시 트랜잭션 밖** — 수백 ms~수 초 동안 DB 커넥션을 점유하면 좌석 경합 구간에서 커넥션 풀이 고갈됩니다
- [ ] Redis 락 해제는 **커밋 이후** — 해제 후 커밋하면 그 사이에 다른 사용자가 좌석을 잡습니다

### 필요한 스키마 보강 (마이그레이션 추가 — 파일명은 타임스탬프 규칙)

- [ ] **`booking.expires_at TIMESTAMPTZ`** — PENDING 만료 스케줄러가 기준 삼을 컬럼이 현재 없습니다. `created_at + 고정시간`으로 대체할 수도 있지만, 락 TTL과의 정합성을 코드가 아닌 데이터로 남기는 편이 낫습니다
- [ ] **`uq_payment_booking` 재설계** — 현재 `UNIQUE(booking_id)`라 **결제 실패 후 재시도 시 두 번째 `payment` INSERT가 막힙니다.** `ck_payment_status`에 `FAILED`가 있는데 실패 행이 자리를 차지해버리는 구조입니다. `uq_booking_seat_active`와 같은 패턴으로 `WHERE status = 'SUCCESS'` 부분 유니크 인덱스로 전환 권장

### 보완 필요 (초기 계획 누락)
- [ ] **다중 좌석 선점 시 데드락** — 사용자1이 A→B 순으로, 사용자2가 B→A 순으로 락을 잡으면 데드락. **좌석 ID를 정렬한 뒤 순서대로 획득**하는 규칙 필수
- [ ] **부분 실패 처리** — 3석 중 2석만 락 획득 성공 시 이미 잡은 락을 모두 해제하고 실패 응답
- [ ] **락 TTL vs 결제 제한시간** — 락이 결제 도중 만료되면 다른 사람이 같은 좌석을 잡는다. **세 값의 대소 관계가 뒤집히면 반드시 버그가 납니다.**
      `입장 토큰 TTL(B, 15분) > 좌석 락 TTL(A, 7분) > 결제 제한시간(A, 5분)`
      (Redisson watchdog은 함정 ③에 따라 `RLock`을 쓰지 않으므로 검토 대상에서 제외 — TTL을 명시 지정합니다)
- [ ] **PENDING 예매 만료 처리** — 결제를 안 끝내고 이탈한 `booking`이 PENDING으로 영구히 남음. 스케줄러로 만료 처리 + `booking_seat`를 CANCELLED로 전환해 좌석 반환 (위 `expires_at` 컬럼 필요)
- [x] ~~**결제 실패 시 보상**~~ — **트랜잭션을 T1/T2로 분리하면서 해소됨.** 중복 예매 검증이 결제보다 앞에 오므로 "결제는 성공했는데 좌석은 뺏긴" 상태가 구조적으로 발생하지 않습니다. 남는 건 4번의 결제 실패 시 T1 롤백뿐이며, 이건 DB 안에서 끝납니다
- [ ] **락 해제 실패** — 커밋 후 락 해제 전에 서버가 죽으면 TTL 만료까지 좌석이 잠김. TTL이 최후 안전장치임을 문서화
- [ ] **취소 API** — 예매 취소 시 `booking`/`booking_seat`/`session_seat` 3곳을 함께 되돌려야 함
- [ ] **`session_seat` 상태 변경은 B의 Service 경유** — `SOLD` UPDATE 대상은 `performance` 도메인 소유입니다. `SessionSeatRepository`를 직접 주입하지 말고 B가 제공하는 `SessionSeatService.markAsSold(...)`를 호출하세요 (`CLAUDE.md` 도메인 간 접근 규칙)

**완료 기준**: 동일 좌석 동시 요청 시 정확히 1건만 성공

---

# 7~10주차 — Kafka 연동 (B)

대기실을 끝낸 B가 7주차부터 착수합니다(A는 같은 기간 결제·확정 진행). 이벤트 DTO는 `global/event/`에 두고, **A가 발행부를 붙이기 전에 B가 DTO를 먼저 확정**해야 양쪽이 병렬로 움직입니다.

- [ ] 토픽 설계 및 생성
- [ ] `booking` → 예매 확정/취소 이벤트 발행 (발행 코드는 A, 이벤트 스키마는 B가 정의)
- [ ] `notification` → consumer 소비 및 적재

### 보완 필요 (초기 계획 누락)
- [ ] **notification 테이블 미설계** — ERD에서 제외됐음. 알림 이력을 남기려면 마이그레이션 추가 필요 (파일명은 타임스탬프 규칙: `V{yyyyMMddHHmm}__add_notification.sql`)
- [ ] **토픽/파티션 키 설계** — `booking.confirmed`, `booking.cancelled` 등. 파티션 키를 `session_id`로 두면 회차별 순서 보장
- [ ] **이벤트 발행 실패 처리** — DB 커밋은 됐는데 Kafka 발행이 실패하면 알림이 유실됨. 트랜잭셔널 아웃박스 패턴 도입 여부 결정 (학습 목적상 좋은 소재이나 일정 부담 있음)
- [ ] **consumer 멱등성** — Kafka는 at-least-once라 중복 소비가 발생함. 이벤트 ID 기준 중복 처리 방지
- [ ] **DLQ(Dead Letter Queue)** — 소비 실패가 무한 재시도로 이어지지 않도록
- [ ] **로컬 Kafka 토픽 자동 생성** — `auto.create.topics.enable` 의존 대신 `NewTopic` 빈으로 명시 생성 권장

**완료 기준**: 예매 확정 시 이벤트 발행 및 consumer 수신 로그 확인

---

# 11주차 — 부하 테스트 (공동)

- [ ] k6 시나리오 작성 — ① 동일 좌석 동시 요청 ② 대기실 동시 진입
- [ ] 측정 및 리포트 정리

### 보완 필요 (초기 계획 누락)
- [ ] **목표 수치가 없음** — "동시 접속 N명에서 p95 응답 Nms 이내, 중복 예매 0건" 같은 기준을 **미리** 정해야 성공/실패 판정이 가능. 지금은 판정 기준이 없는 상태
- [ ] **테스트 환경의 한계** — 앱과 k6를 같은 노트북에서 돌리면 서로 자원을 뺏어 수치 신뢰도가 낮음. "로컬 단일 머신 측정"이라는 한계를 리포트에 명시하거나, k6를 별도 머신/컨테이너에서 실행
- [ ] **테스트 데이터 준비** — 동시 사용자 수천 명 시나리오라면 유저 계정과 토큰을 미리 대량 생성해둬야 함
- [ ] **측정 지표 수집 수단** — 락 경합·대기시간을 무엇으로 볼 것인지. Actuator + Micrometer 커스텀 메트릭, 필요 시 Prometheus/Grafana
- [ ] **검증 쿼리** — 테스트 후 "중복 예매 0건"을 실제로 확인하는 SQL 준비
      (예: `SELECT session_seat_id, count(*) FROM booking_seat WHERE status='ACTIVE' GROUP BY 1 HAVING count(*) > 1`)
- [ ] **비교군 설정** — 락 없는 버전 vs Redis 락 버전을 비교하면 포트폴리오 설득력이 크게 올라감

---

# 12주차 — 마무리

- [ ] 버그 픽스
- [ ] 데모 배포 (단일 서버 docker compose)
- [ ] README / 아키텍처 다이어그램 / 부하 테스트 리포트 문서화

### 보완 필요 (초기 계획 누락)
- [ ] **애플리케이션 Dockerfile** — 현재 compose에는 인프라 3종만 있고 앱 자체는 없음. 배포하려면 앱 이미지 빌드 필요
- [ ] **prod 프로필 + 시크릿 분리** — DB 비밀번호·JWT secret을 환경변수로
- [ ] **배포 위치 미정** — "단일 서버"가 어디인지(개인 서버/클라우드 프리티어/로컬 데모) 결정 필요

---

# 전 구간 공통

## 협업 체계 — ✅ 규칙 확정됨 (2026-07-21)

병렬 개발용 강제 규칙은 **`CLAUDE.md`의 "팀 협업 규칙 (2인 병렬 개발)" 섹션에 명문화**되었습니다. 요약:

| 규칙 | 내용 |
|---|---|
| Flyway 버전 | `V{yyyyMMddHHmm}__설명.sql` 타임스탬프. 순차 번호(`V2__`)는 두 사람이 같은 번호를 만들어 반드시 충돌 |
| 도메인 간 접근 | 타 도메인 Repository 직접 주입 금지 / 엔티티는 읽기 참조만 / 상태 변경은 해당 도메인 Service 경유 |
| ErrorCode | 단일 enum 금지. `interface ErrorCode` + 도메인별 enum으로 분리 |
| `global/` | 최초 1회 한 사람이 확정 후 동결. 변경 시 상대 리뷰 필수 |
| API 경로 | prefix로 소유권 분리 (`/api/bookings,payments` = A / 나머지 = B) |
| 네이밍 | 회차 엔티티는 `PerformanceSession`, 대기실은 `domain/waitingroom/` |
| 이벤트 DTO | `global/event/` 중립 패키지 |

### 남은 액션
- [ ] **브랜치 전략 적용** — 현재 `master`에 직접 커밋 중. `feature/{도메인}-{작업}` + PR 리뷰로 전환 (**1주차 내**)
- [ ] **PR 리뷰 규칙** — 프론트 코드도 리뷰 대상에 포함 (AI 생성물 방치 방지, 기획 단계에서 합의한 사항)
- [ ] **이슈 트래킹** — GitHub Issues/Projects 사용 여부

## 테스트 전략 (전무 — 우선순위 상향: 11주차 → 1~4주차)

⚠️ 0단계 검증에서 **`./gradlew build`가 인프라 없이는 실패**하는 것이 확인되었습니다. CI를 붙이는 순간 바로 막히므로, 아래는 더 이상 "시점 미정" 항목이 아닙니다.

- [ ] **Testcontainers 도입** (3~4주차, A) — PostgreSQL/Redis를 테스트가 직접 띄우게 해서 로컬과 CI 동작을 일치시킴. 위 빌드 실패 문제의 근본 해결책. 도입 시 `ci.yml`의 services 블록 제거
- [x] ~~**CI 구축**~~ → **`.github/workflows/ci.yml` 작성 완료.** master push / 모든 PR에서 `./gradlew build` 실행, postgres 16 + redis 7 service container 포함, 실패 시 테스트 리포트를 아티팩트로 업로드. **2인 개발에서 상대 코드가 머지된 뒤 앱이 안 뜨는 상황을 조기 감지하는 유일한 장치**
- [ ] **동시성 통합 테스트** (9~10주차, A) — `ExecutorService`로 동시 요청을 재현해 중복 예매가 막히는지 검증. 11주차 부하 테스트보다 피드백이 훨씬 빠름
- [ ] **k6 시나리오·시드 대량 생성 선행** (7~10주차, B) — 11주차에 몰아서 하면 늦음

## 운영/품질
- [ ] **`spring.jpa.open-in-view: false` 명시** — 기본값 true라 기동 경고가 뜨며, OSIV는 요청 종료까지 DB 커넥션을 점유해 좌석 경합 구간에서 커넥션 풀 고갈을 유발할 수 있음 (부하 테스트 수치에 직결)
- [ ] **로깅 정책** — 요청 추적 ID(MDC), 락 획득/해제 로그. 부하 테스트 분석에 직결
- [ ] **시크릿 관리** — `application-local.yml`의 평문 비밀번호. JWT secret 추가 전에 정리 권장
