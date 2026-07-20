# ticketFlow 로드맵 & 진행 체크리스트

> 프로젝트 전체 계획과 완료 현황을 추적하는 문서입니다. 마일스톤을 끝낼 때마다 체크박스를 갱신하세요.
> 각 단계의 **"보완 필요"** 항목은 초기 계획에서 누락됐던 작업들입니다. 착수 전에 반드시 확인하세요.

## 진행 현황 요약

| 단계 | 기간 | 담당 | 상태 |
|---|---|---|---|
| 0. 프로젝트 스캐폴딩 | - | 공동 | ✅ 완료 |
| SP0. 공통 규약 합의 | 착수 전 | 공동 | ⬜ 대기 |
| 1. 도메인 모델링 & 인증 | 1~2주차 | A(인증/공통)·B(엔티티/시드) | 🔨 진행 중 (스키마 완료 / 엔티티·인증 미착수) |
| 2. 카탈로그 API + 프론트 착수 | 3~4주차 | B(API)·A(프론트) | ⬜ 대기 |
| 3. 가상 대기실 | 5~6주차 | B(코어)·A(프론트) | ⬜ 대기 |
| 4. 좌석 선점 + 예매 확정 | 7~8주차 | B(코어)·A(프론트) | ⬜ 대기 |
| 5. Kafka 이벤트 연동 | 9~10주차 | B(코어)·A(프론트) | ⬜ 대기 |
| 6. 부하 테스트 | 11주차 | 공동(B 리드) | ⬜ 대기 |
| 7. 마무리 | 12주차 | 공동 | ⬜ 대기 |

## 프로젝트 개요

- **목표**: 공연(콘서트/뮤지컬) 티켓팅 플랫폼. 핵심 기술 챌린지는 "동시 대량 접속 시 좌석 선점/중복 예매 방지"
- **목적**: 학습/포트폴리오 (실서비스 운영 목표 아님)
- **기간**: 3개월 MVP
- **팀**: 개발자 A(프론트 AI + 인증/경량 백엔드) + 개발자 B(동시성 코어 + 카탈로그). 상세는 아래 "역할 분담"
- **스택**: Java 21(현재 toolchain 26), Spring Boot 4.1.0, Spring Security 7.1, Gradle(Groovy), PostgreSQL 16, Redis 7, Kafka(KRaft)
- **MVP 제외**: 스포츠 도메인, 실제 PG 연동, 실명인증/소셜로그인, 실서비스급 배포

## 역할 분담 (2026-07 재편)

> 프론트엔드(AI 활용)를 A가 맡으면서 기존 단순 도메인 수직 분담을 재배치했다.
> 프론트는 큰 연속 작업이므로, 백엔드 동시성 코어를 B로 몰아 부하를 상쇄한다.

| | 개발자 A | 개발자 B |
|---|---|---|
| 한 줄 정체성 | 프론트 + 인증/게이트웨이 + 통합 | 동시성 코어 + 카탈로그 |
| 백엔드 도메인 | `user`(인증/JWT), `payment`(Mock), `global`(공통 인프라) | `performance`/`venue`/`seat`(카탈로그), `booking`(예매·대기실·좌석락·확정), `notification`(Kafka) |
| 프론트엔드 | **전체 소유** (AI 생성 + 유지보수) | 없음 (PR 리뷰만) |
| 포트폴리오 강점 | 인증·전체 통합·프론트 연동 | Redis 분산락·대기열·Kafka·부하 대응 |

**핵심 합의사항**
- **동시성(대기실·좌석락·예매확정)의 주인 = B.** 간판 기술이므로 한 사람이 일관되게 소유
- **booking 도메인 전체를 B로 이관** (기존 A 영역). 예매·대기실·좌석락이 하나의 동시성 흐름이라 분리 시 락/트랜잭션 버그 위험
- **프론트 품질 책임 = A(작성·유지보수), PR에서 B가 API 연동 관점 리뷰**
- **착수 순서 = OpenAPI 명세 먼저 합의 → A는 Mock 응답으로 프론트 선행, B는 실 API 구현, 완성 후 연결만 교체**
- **공통 인프라(A 소유)는 1주차에 선제작.** B의 도메인 API가 3주차부터 그 위에 얹히므로 A가 먼저 깔아야 함

## Sync Point (합류 지점)

| SP | 시점 | 합류 내용 | 이후 풀리는 것 |
|---|---|---|---|
| SP0 | 시작 전 | 공통 규약 합의 | 양쪽 동시 착수 |
| SP1 | 2주차 말 | 인증(JWT) 완성 | B 도메인 API에 인증 부착 |
| SP2 | 4주차 말 | 카탈로그 API + OpenAPI 명세 확정 | A 프론트 Mock→실 API 전환 |
| SP3 | 6주차 말 | 대기실 완성 | 프론트 대기실 화면 연동 |
| SP4 | 8주차 말 | 예매 확정 플로우 완성 | 프론트 예매 플로우 연동, 동시성 검증 |
| SP5 | 10주차 말 | Kafka 이벤트 연동 | 알림/통계 소비 |
| SP6 | 11주차 | 부하 테스트 공동 수행 | 성능 리포트 |
| SP7 | 12주차 | 데모/문서화 | 마감 |

---

# SP0단계 — 착수 전 공통 규약 (반나절, 둘이 함께) 🤝

> 코드 충돌·재작업을 막기 위해 **먼저 합의**한다. 결과는 `docs/CONVENTIONS.md`에 기록.

- [ ] **브랜치 전략**: `master` 직접 커밋 중단 → feature 브랜치 + PR 리뷰 (현재 미적용)
- [ ] **네이밍**: `session` 엔티티 클래스명 충돌 회피 → `PerformanceSession` 등으로 확정
- [ ] `ApiResponse<T>` 응답 포맷, `ErrorCode` 체계, HTTP 상태 매핑 규칙 합의
- [ ] 엔티티 규약: 연관관계 전부 `LAZY`, `@ManyToOne` 중심, 양방향은 필요 시만
- [ ] `springdoc-openapi` 도입 (프론트 선행의 계약서 역할)
- [ ] Java toolchain 버전 통일 (현재 build.gradle이 21 아닌 **26** — 둘의 로컬 JDK 확인)

---

# 0단계 — 프로젝트 스캐폴딩 ✅

- [x] Spring Initializr로 프로젝트 생성 (Gradle Groovy, Spring Boot 4.1.0, group `com.ticket` → 패키지 `com.ticket.ticketflow`)
- [x] build.gradle 의존성 구성 (web, actuator, jpa, redis, kafka, security, validation, flyway, postgresql, lombok, jjwt)
- [x] 도메인별 패키지 구조 생성 및 `src/main/java/com/ticket/ticketflow/` 하위로 위치 정정
- [x] docker-compose.yml 작성 (postgres:16, redis:7, kafka KRaft 단일 브로커)
- [x] `docker compose up -d`로 3개 컨테이너 정상 기동 확인
- [x] application.yml(local 프로필) / application-local.yml(DB·Redis·Kafka 접속 설정) 작성
- [x] `./gradlew build` 성공, `GET /actuator/health` → `{"status":"UP"}` 확인

### 미해결 항목
- [ ] `redisson-spring-boot-starter` 주석 처리 상태 → **7~8주차 착수 전** 활성화
- [ ] `build.gradle`의 Java toolchain이 계획(21)과 달리 **26**으로 설정됨 → 팀원 간 JDK 버전 통일 필요. 한 명이 JDK 21이면 빌드 실패 가능
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

### (1) JPA 엔티티 작성 — ⚠️ 초기 계획에 누락됐던 항목 · **담당: A(global/base), B(도메인 대부분)**

마이그레이션과 별개로 엔티티 클래스를 직접 작성해야 합니다. `ddl-auto: validate`이므로 **엔티티와 스키마가 어긋나면 앱이 아예 뜨지 않습니다** (조기 발견 장치로 유용).

- [ ] **[A]** `global/common/BaseTimeEntity` — `created_at`/`updated_at` 공통 처리 (`@MappedSuperclass` + `@EntityListeners`)
- [ ] **[A]** `global/config/JpaAuditingConfig` — `@EnableJpaAuditing`
- [ ] **[B]** 도메인 엔티티: `performance`/`venue`/`venue_seat`/`seat_grade`/`session`/`session_seat`/`booking`/`booking_seat`
- [ ] **[A]** 도메인 엔티티: `user`, `payment`
- [ ] 연관관계는 **전부 `LAZY`**, `@ManyToOne`만 사용 — 양방향 매핑은 필요할 때만 추가

**주의**: `session`은 PostgreSQL에서는 문제없지만, Java 클래스명 `Session`이 Hibernate의 `Session`, HTTP 세션과 이름이 겹칩니다. import 혼동이 잦으니 클래스명을 `PerformanceSession` 등으로 둘지 먼저 정하세요.

### (2) 공통 인프라 — ⚠️ 초기 계획에 누락됐던 항목 · **담당: A (선제작)**

`global/` 패키지를 만들어뒀지만 계획에는 없던 작업입니다. 인증보다 **먼저** 잡아두면 이후 모든 API가 일관됩니다. B의 도메인 API가 3주차부터 이 위에 얹히므로 A가 먼저 완성해야 합니다.

- [ ] `global/common/ApiResponse<T>` — 공통 응답 포맷
- [ ] `global/exception/ErrorCode` (enum) + `BusinessException`
- [ ] `global/exception/GlobalExceptionHandler` — `@RestControllerAdvice`
      - Bean Validation 실패(`MethodArgumentNotValidException`) 처리 포함
      - **7~8주차 대비**: `DataIntegrityViolationException`(유니크 제약 위반)을 "이미 예매된 좌석"으로 변환하는 처리가 여기 들어감

### (3) 회원가입 / 로그인 + JWT — 직접 구현 예정 · **담당: A**

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

### (4) 시드 데이터 — ⚠️ 초기 계획에 누락됐던 항목 · **담당: B**

3주차부터 조회 API를 만들려면 공연·좌석 데이터가 있어야 합니다. **공연장 좌석은 수백~수천 건**이라 수동 INSERT가 불가능합니다.

- [ ] 방식 결정: `V2__seed.sql`(Flyway) vs `local` 프로필 전용 `CommandLineRunner`
      → 반복 초기화가 잦으므로 **CommandLineRunner 권장** (Flyway는 한 번 적용되면 재실행 불가)
- [ ] 공연장 1곳 + 좌석 500~2000석 생성 (`generate_series` 또는 반복문)
- [ ] 공연 2~3건, 회차 각 3~5개, 등급 4종
- [ ] `session_seat` 생성 로직 — **회차 1개당 좌석 전체를 복제**하므로 벌크 INSERT 필요. 건별 `save()`로 짜면 수천 건에서 매우 느림 (JDBC batch 또는 네이티브 쿼리)

## 완료 기준
회원가입 → 로그인 → `GET /api/users/me` 호출 성공 + 시드 데이터로 공연/좌석 조회 가능

---

# 3~4주차 — 카탈로그 API(B) + 프론트 착수(A) → SP2

**[B] 공연/좌석 조회 API:**
- [ ] `GET /api/performances` — 목록 (페이징)
- [ ] `GET /api/performances/{id}` — 상세 + 회차 목록
- [ ] `GET /api/sessions/{id}/seats` — 좌석 배치도 + 잔여 상태
- [ ] OpenAPI 명세 확정 → A에게 계약 제공

**[A] 프론트 골격 + 인증 화면:**
- [ ] 프론트 셋업(위치 결정, `frontend/` 서브디렉토리 권장) + CORS 설정
- [ ] 회원가입/로그인 화면 (실 API 이미 존재 → 바로 연동)
- [ ] 공연 목록/상세/좌석 화면 — **B의 OpenAPI 명세 기반 Mock 응답으로 선행**, SP2에서 실 API 교체

### 보완 필요 (초기 계획 누락)
- [ ] **좌석 조회 응답 크기** — 2000석이면 JSON이 수백KB. 등급/구역 단위 요약 + 개별 좌석 분리 응답 고려. 대기실 뒤에 붙는 최고 트래픽 API이므로 **Redis 캐싱 대상 1순위**
- [ ] **CORS 설정** — 프론트가 별도 포트/오리진이면 필수. `SecurityConfig`와 함께 설정
- [ ] **API 문서화** — `springdoc-openapi` 도입 여부 결정. 프론트를 AI로 만들 때 스펙이 문서화돼 있으면 생성 품질이 크게 올라감
- [ ] **프론트 코드 위치** — 같은 레포 `frontend/` 하위 vs 별도 레포. 미결정 상태
- [ ] **N+1 쿼리** — 공연 목록에서 회차·등급을 함께 조회할 때 발생. `fetch join` 또는 `@BatchSize`

**완료 기준**: 프론트에서 목록 → 상세 → 좌석 배치도 조회 가능

---

# 5~6주차 — 가상 대기실 (B 코어 / A 프론트) → SP3

**[B] 대기실 코어 (첫 동시성 관문):**
- [ ] Redis 기반 대기열 진입 API (순번 발급)
- [ ] 순번 조회 API (내 앞에 몇 명)
- [ ] 입장 토큰 발급/검증
- [ ] 처리율에 따라 대기열에서 입장 허용

**[A] 대기실 프론트 + 결제 준비:**
- [ ] 대기 순번 화면(폴링 우선; SSE는 여유 시), 입장 전환 UX
- [ ] `payment` Mock 결제 백엔드 (자족적이라 이 시기 병행)

### 보완 필요 (초기 계획 누락)
- [ ] **자료구조 선택** — ZSET(score=진입시각) vs List vs Stream. ZSET이 순번 조회(`ZRANK`)에 유리
- [ ] **이탈자 처리** — 대기 중 브라우저를 닫으면 큐에 유령이 남음. 순번 조회 폴링을 heartbeat로 활용해 TTL 갱신, 미갱신 시 제거
- [ ] **중복 진입 방지** — 새로고침/멀티탭으로 여러 순번을 받으면 순서가 무의미해짐. 유저 ID 기준 멱등 처리 필요
- [ ] **순번 전달 방식** — 폴링(단순) vs SSE(실시간). 폴링 주기가 짧으면 그 자체가 부하가 됨
- [ ] **처리율 결정 기준** — "초당 N명 입장"의 N을 뭘 근거로 정할지. 11주차 부하 테스트 결과와 연동되어야 함
- [ ] **입장 토큰 TTL** — 입장 후 좌석 선택까지 유효 시간. 7~8주차 좌석 락 TTL과 정합성 필요
- [ ] **대기열 우회 경로 차단** — 입장 토큰 없이 좌석 API를 직접 호출하면 대기실이 무의미. 좌석 선점 API에 토큰 검증 필수
- [ ] **저트래픽 회차** — 대기 인원이 없으면 즉시 통과시키는 fast-path

**완료 기준**: 동시 요청 시 순번대로 토큰 발급됨을 로컬에서 확인

---

# 7~8주차 — 좌석 선점 + 예매 확정 (B 코어) → SP4

**[B] 동시성 심장부:**
- [ ] `redisson-spring-boot-starter` 의존성 활성화 + `RedissonConfig`
- [ ] 좌석 선점 API — 분산 락(TTL 자동 해제)
- [ ] 선점 해제 API (사용자가 좌석 선택 취소)
- [ ] 예매 확정 트랜잭션 (Mock 결제는 A의 payment API 호출)
- [ ] **동시성 통합 테스트**(`ExecutorService`로 동일 좌석 동시 요청 → 1건만 성공) — 부하 테스트를 기다리지 않는 빠른 피드백

**[A] 예매 플로우 프론트 + 결제 연동:**
- [ ] 좌석 선택→선점→결제→확정 화면, 선점 만료 타이머 UX, 이미 팔린 좌석 에러 처리
- [ ] **(선택)** 동시성 통합 테스트에 페어 참여 → A도 핵심 기술 경험 확보(포트폴리오 균형)

### 예매 확정 트랜잭션 흐름 (설계 확정본)

1. 입장 토큰 검증
2. Redis 락 획득 — `seat:lock:{session_seat_id}`, TTL 5~10분. 실패 시 즉시 거절
3. Mock 결제 호출 → `payment` 레코드 생성
4. **단일 DB 트랜잭션**: `booking` INSERT → `booking_seat` INSERT(여기서 `uq_booking_seat_active`가 최종 검증) → `session_seat.status = 'SOLD'` UPDATE
5. 커밋 후 Redis 락 해제 + Kafka 이벤트 발행

### 보완 필요 (초기 계획 누락)
- [ ] **다중 좌석 선점 시 데드락** — 사용자1이 A→B 순으로, 사용자2가 B→A 순으로 락을 잡으면 데드락. **좌석 ID를 정렬한 뒤 순서대로 획득**하는 규칙 필수
- [ ] **부분 실패 처리** — 3석 중 2석만 락 획득 성공 시 이미 잡은 락을 모두 해제하고 실패 응답
- [ ] **락 TTL vs 결제 제한시간** — 락이 결제 도중 만료되면 다른 사람이 같은 좌석을 잡는다. 락 TTL > 결제 제한시간이어야 하며, Redisson watchdog 사용 여부 결정
- [ ] **PENDING 예매 만료 처리** — 결제를 안 끝내고 이탈한 `booking`이 PENDING으로 영구히 남음. 스케줄러로 만료 처리 + `booking_seat`를 CANCELLED로 전환해 좌석 반환
- [ ] **결제 실패 시 보상** — 4번에서 유니크 위반이 나면 결제를 취소해야 함. 트랜잭션 롤백만으로는 이미 나간 결제가 되돌아오지 않음
- [ ] **락 해제 실패** — 커밋 후 락 해제 전에 서버가 죽으면 TTL 만료까지 좌석이 잠김. TTL이 최후 안전장치임을 문서화
- [ ] **취소 API** — 예매 취소 시 `booking`/`booking_seat`/`session_seat` 3곳을 함께 되돌려야 함

**완료 기준**: 동일 좌석 동시 요청 시 정확히 1건만 성공

---

# 9~10주차 — Kafka 연동 (B 코어 / A 프론트 마무리) → SP5

**[B] 이벤트 연동:**
- [ ] 토픽 설계 및 생성
- [ ] `booking` → 예매 확정/취소 이벤트 발행
- [ ] `notification` → consumer 소비 및 적재

**[A] 프론트 마무리:**
- [ ] 알림/마이페이지(예매 내역) 화면, 전체 UX 다듬기, 프론트 버그 정리

### 보완 필요 (초기 계획 누락)
- [ ] **notification 테이블 미설계** — ERD에서 제외됐음. 알림 이력을 남기려면 스키마 추가(`V2__notification.sql`) 필요
- [ ] **토픽/파티션 키 설계** — `booking.confirmed`, `booking.cancelled` 등. 파티션 키를 `session_id`로 두면 회차별 순서 보장
- [ ] **이벤트 발행 실패 처리** — DB 커밋은 됐는데 Kafka 발행이 실패하면 알림이 유실됨. 트랜잭셔널 아웃박스 패턴 도입 여부 결정 (학습 목적상 좋은 소재이나 일정 부담 있음)
- [ ] **consumer 멱등성** — Kafka는 at-least-once라 중복 소비가 발생함. 이벤트 ID 기준 중복 처리 방지
- [ ] **DLQ(Dead Letter Queue)** — 소비 실패가 무한 재시도로 이어지지 않도록
- [ ] **로컬 Kafka 토픽 자동 생성** — `auto.create.topics.enable` 의존 대신 `NewTopic` 빈으로 명시 생성 권장

**완료 기준**: 예매 확정 시 이벤트 발행 및 consumer 수신 로그 확인

---

# 11주차 — 부하 테스트 (공동, B 리드) → SP6

- [ ] **[B]** k6 시나리오 작성 — ① 동일 좌석 동시 요청 ② 대기실 동시 진입, 락 경합/대기 메트릭
- [ ] **[A]** 대량 테스트 유저/토큰 사전 생성(프론트/스크립트), 결과 시각화
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

# 12주차 — 마무리 (공동) → SP7

- [ ] 버그 픽스
- [ ] 데모 배포 (단일 서버 docker compose) — 앱 Dockerfile + prod 프로필/시크릿 분리
- [ ] **[B]** 백엔드/아키텍처 다이어그램 · 부하 리포트 문서화
- [ ] **[A]** 프론트 데모 시나리오, README 통합

### 보완 필요 (초기 계획 누락)
- [ ] **애플리케이션 Dockerfile** — 현재 compose에는 인프라 3종만 있고 앱 자체는 없음. 배포하려면 앱 이미지 빌드 필요
- [ ] **prod 프로필 + 시크릿 분리** — DB 비밀번호·JWT secret을 환경변수로
- [ ] **배포 위치 미정** — "단일 서버"가 어디인지(개인 서버/클라우드 프리티어/로컬 데모) 결정 필요

---

# 전 구간 공통 — 아직 계획에 없는 항목

프로젝트 전반에 걸쳐 필요하지만 어느 주차에도 배정되지 않은 작업들입니다. 착수 시점을 정하세요.

## 협업 체계 (2인 개발인데 미정 — 우선순위 높음)
- [ ] **브랜치 전략** — 현재 `master`에 직접 커밋 중. 최소한 feature 브랜치 + PR 리뷰 규칙 필요
- [ ] **PR 리뷰 규칙** — 프론트 코드도 리뷰 대상에 포함 (AI 생성물 방치 방지, 기획 단계에서 합의한 사항)
- [ ] **커밋 컨벤션** — 현재 `feat/fix/chore/docs` + 한국어 본문으로 자연스럽게 정착 중. 명문화 여부 결정
- [ ] **이슈 트래킹** — GitHub Issues/Projects 사용 여부

## 테스트 전략 (전무 — 우선순위 높음)
- [ ] **테스트 방침 결정** — 동시성이 핵심인 프로젝트인데 테스트 계획이 없음. 최소한 예매 확정 로직은 통합 테스트 필요
- [ ] **Testcontainers 도입 여부** — PostgreSQL/Redis를 띄우는 통합 테스트. 도입하면 CI에서도 동일하게 동작
- [ ] **동시성 단위 테스트** — `ExecutorService`로 동시 요청을 재현해 중복 예매가 막히는지 검증 (11주차 부하 테스트와 별개로, 훨씬 빠른 피드백)

## 운영/품질
- [ ] **CI 구축** — GitHub Actions로 push 시 `./gradlew build` 자동 실행
- [ ] **로깅 정책** — 요청 추적 ID(MDC), 락 획득/해제 로그. 부하 테스트 분석에 직결
- [ ] **시크릿 관리** — `application-local.yml`의 평문 비밀번호. JWT secret 추가 전에 정리 권장
