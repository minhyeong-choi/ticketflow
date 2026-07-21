# 02. 개발자 B 워크플로우 — `user` / `performance` / `waitingroom` / `notification`

> **먼저 [00-common-workflow.md](00-common-workflow.md)를 읽으세요.** 이 문서는 그 내용을 안다고 가정합니다.

## B가 맡은 것

| 도메인 | 내용 |
|---|---|
| `global/` | 공통 응답·예외·시큐리티 기반 (**1주차에 확정 후 동결**) |
| `domain/user` | 회원가입, 로그인, JWT 인증 |
| `domain/performance` | 공연/회차/좌석 카탈로그 + 시드 데이터 |
| `domain/waitingroom` | 가상 대기실 (Redis ZSET) |
| `domain/notification` | Kafka consumer + 알림 적재 |
| API 경로 | `/api/auth/**`, `/api/users/**`, `/api/performances/**`, `/api/sessions/**`, `/api/waiting/**` |

**B는 "A를 막지 않는 것"이 가장 중요한 역할입니다.** 시드 데이터가 없으면 A는 좌석 선점을 개발도 테스트도 못 하고, 대기실 토큰 검증 시그니처가 없으면 A의 좌석 선점 API가 컴파일되지 않습니다. **구현보다 시그니처와 데이터를 먼저 내보내세요.**

## 전체 일정

| 주차 | 할 일 | A에게 미치는 영향 |
|---|---|---|
| 1~2 | `global/` 확정 → **시드 데이터** → 인증(JWT) | 시드가 없으면 A는 5주차에 아무것도 못 함 |
| 3~4 | 공연/회차/좌석 조회 API | 프론트(A)가 붙일 대상 |
| 5~6 | 가상 대기실 — **시그니처 선(先)커밋** | 토큰 검증 메서드가 A의 컴파일 조건 |
| 7~8 | Kafka + `notification` — **이벤트 DTO 선(先)정의** | A가 발행 코드를 붙일 계약 |
| 9~10 | 프론트 예매 플로우 연동 + DLQ/멱등성 | |
| 11~12 | 부하 테스트 / 마무리 (공동) | |

---

# 1~2주차 — 기반 확정 → 시드 → 인증

같은 기간에 A는 엔티티 10종을 작성합니다(`domain/user/entity/User.java` 포함). **파일이 겹치지 않으니 충돌 없이 병렬 진행됩니다.** A가 Day 2에 엔티티를 머지하면 B는 그때부터 `User`를 쓸 수 있습니다.

## Day 1~2: `global/` 공통 인프라 확정 ★ 우선순위 1위

**A와 B가 모두 이 위에 코드를 얹습니다.** 늦게 확정될수록 나중에 전부 고쳐야 하니 **가장 먼저, 하루 만에** 끝내세요. 완벽하지 않아도 됩니다 — 확정되는 것 자체가 가치입니다.

### 만들 파일

```
global/common/ApiResponse.java
global/exception/ErrorCode.java              # ★ interface (enum 아님)
global/exception/CommonErrorCode.java        # enum implements ErrorCode
global/exception/BusinessException.java
global/exception/GlobalExceptionHandler.java
global/event/                                # 빈 패키지 + .gitkeep (7주차 Kafka DTO 자리)
```

**코드는 [00번 문서 8장](00-common-workflow.md#8-공통-응답--예외-처리-규격)에 그대로 있습니다.** 그대로 만드세요.

### 왜 `ErrorCode`가 interface여야 하는지 다시 확인

단일 enum이면 A가 `SEAT_ALREADY_HELD`를 추가하고 B가 `DUPLICATE_EMAIL`을 추가할 때 **같은 파일의 같은 위치를 고쳐 매번 머지 충돌**이 납니다. interface로 쪼개면 각자 자기 파일만 건드립니다.

```
global/exception/ErrorCode.java             ← interface, 동결
global/exception/CommonErrorCode.java       ← 공통만, 변경 시 상대 리뷰
domain/user/exception/UserErrorCode.java    ← B만 수정
domain/booking/exception/BookingErrorCode.java ← A만 수정
```

### 확정 후 규칙

**`global/` 하위는 머지 이후 동결입니다.** 변경이 필요하면 상대 리뷰를 거치세요. 기능 개발 중에 `ApiResponse` 필드를 슬쩍 바꾸면 상대의 모든 API가 동시에 깨집니다.

**PR**: `feat: 공통 응답 포맷 및 예외 처리 기반 구축` → A 리뷰 후 즉시 머지

---

## Day 3~5: 시드 데이터 ★ A의 블로커 — 인증보다 먼저

### 왜 인증보다 먼저인가

`session_seat` 데이터가 없으면:
- A는 좌석 선점을 개발할 수도, 테스트할 수도 없습니다
- B 본인의 3~4주차 조회 API도 만들 수 없습니다
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
global/config/SeedDataRunner.java     # 또는 domain/performance/support/
```

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

`section` 문자열로 등급을 정하는 이 `CASE`문이 **"어느 물리 좌석이 어느 등급인가"의 매핑 규칙**입니다(V1__init.sql 주석에 언급된 부분). 규칙을 바꾸고 싶으면 여기만 고치면 됩니다.

### 생성할 데이터 규모

| 대상 | 수량 |
|---|---|
| `venue` | 1곳 |
| `venue_seat` | 1,200석 |
| `performance` | 2~3건 (`ON_SALE` 상태 최소 1건) |
| `seat_grade` | 공연당 4종 (VIP/R/S/A) |
| `session` | 공연당 3~5회차 |
| `session_seat` | 회차 × 1,200 |
| `users` | 테스트 계정 2~3개 |

> **`booking_open_at`을 다양하게 두세요.** 이미 열린 회차(과거), 곧 열릴 회차(몇 분 후), 나중 회차(내일)를 섞어야 5~6주차 대기실 로직을 테스트할 수 있습니다.

### 완료 확인

```bash
docker compose exec postgres psql -U ticketflow -d ticketflow \
  -c "SELECT (SELECT count(*) FROM venue_seat) AS 물리좌석,
             (SELECT count(*) FROM session)    AS 회차,
             (SELECT count(*) FROM session_seat) AS 판매좌석;"
```

**A에게 바로 알리세요.** "시드 완료, `session_seat` N건 생성됨"이 A의 5주차 착수 신호입니다.

**PR**: `feat: local 프로필 시드 데이터 생성기 구현`

---

## Day 6~10: 회원가입 / 로그인 / JWT

### 만들 파일

```
global/config/SecurityConfig.java
global/security/JwtTokenProvider.java
global/security/JwtAuthenticationFilter.java
global/security/CustomUserDetails.java
global/security/JwtAuthenticationEntryPoint.java

domain/user/repository/UserRepository.java
domain/user/service/AuthService.java
domain/user/service/UserService.java
domain/user/controller/AuthController.java
domain/user/controller/UserController.java
domain/user/dto/SignupRequest.java
domain/user/dto/LoginRequest.java
domain/user/dto/TokenResponse.java
domain/user/dto/UserResponse.java
domain/user/exception/UserErrorCode.java
```

### 먼저 정할 것 (로드맵 확정안)

| 항목 | 결정 |
|---|---|
| Access Token 만료 | **30분** |
| Refresh Token | **MVP에서는 생략** (핵심이 동시성이지 인증이 아님) |
| 전달 방식 | `Authorization: Bearer {token}` 헤더 |
| 서명 알고리즘 | HS256 (대칭키) |
| secret 관리 | **환경변수 주입** |
| 비밀번호 | BCrypt |

### ⚠️ 검색 전 반드시 읽을 것

인터넷 예제 대부분이 **Spring Security 5.x / jjwt 0.11.x** 기준이라 그대로는 컴파일되지 않습니다.

| 옛날 코드 | 이 프로젝트 |
|---|---|
| `extends WebSecurityConfigurerAdapter` | **제거됨.** `SecurityFilterChain` 빈 등록만 |
| `.antMatchers("/api/**")` | **제거됨.** `.requestMatchers(...)` |
| `http.csrf().disable()` | 람다 DSL: `http.csrf(csrf -> csrf.disable())` |
| `Jwts.parserBuilder()` | **`Jwts.parser()`** |
| `.parseClaimsJws(token)` | **`.parseSignedClaims(token)`** |
| `.setSubject(...)` `.setExpiration(...)` | **`.subject(...)` `.expiration(...)`** |

### (1) 시크릿을 환경변수로

```yaml
# application-local.yml
jwt:
  secret: ${JWT_SECRET:local-dev-only-secret-key-must-be-at-least-32-bytes-long}
  access-token-validity: 1800000   # 30분(ms)
```

`${환경변수:기본값}` 문법이라 로컬에서는 환경변수 없이도 뜨고, 배포 시에는 환경변수가 우선합니다.

> **HS256은 최소 256비트(32바이트) 키가 필요합니다.** 짧으면 기동 시 `WeakKeyException`이 납니다.
> 참고로 `application-local.yml`의 DB 비밀번호도 평문 커밋 상태입니다(로드맵 미해결 항목). JWT secret을 넣는 김에 같은 방식으로 정리하세요.

### (2) `JwtTokenProvider` (jjwt 0.12.6)

```java
@Component
public class JwtTokenProvider {

    private final SecretKey key;
    private final long validityMillis;

    public JwtTokenProvider(@Value("${jwt.secret}") String secret,
                            @Value("${jwt.access-token-validity}") long validityMillis) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.validityMillis = validityMillis;
    }

    public String createToken(Long userId, String email, Role role) {
        Date now = new Date();
        return Jwts.builder()
                .subject(String.valueOf(userId))          // 0.12: setSubject → subject
                .claim("email", email)
                .claim("role", role.name())
                .issuedAt(now)
                .expiration(new Date(now.getTime() + validityMillis))
                .signWith(key)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()                              // 0.12: parserBuilder() → parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)                 // 0.12: parseClaimsJws → parseSignedClaims
                .getPayload();
    }

    /** 만료와 위조를 구분해야 프론트가 "재로그인" 안내를 정확히 할 수 있습니다 */
    public TokenStatus validate(String token) {
        try {
            parse(token);
            return TokenStatus.VALID;
        } catch (ExpiredJwtException e) {
            return TokenStatus.EXPIRED;
        } catch (JwtException | IllegalArgumentException e) {
            return TokenStatus.INVALID;
        }
    }
}
```

> **토큰에 비밀번호나 민감 정보를 넣지 마세요.** JWT의 payload는 암호화가 아니라 **Base64 인코딩**일 뿐이라 누구나 디코딩해서 읽을 수 있습니다. 서명은 "위조 방지"이지 "내용 숨김"이 아닙니다. https://jwt.io 에 토큰을 붙여넣어 직접 확인해 보세요.

### (3) `JwtAuthenticationFilter`

```java
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String token = resolveToken(request);

        if (token != null && tokenProvider.validate(token) == TokenStatus.VALID) {
            Claims claims = tokenProvider.parse(token);
            CustomUserDetails principal = new CustomUserDetails(
                    Long.valueOf(claims.getSubject()),
                    claims.get("email", String.class),
                    Role.valueOf(claims.get("role", String.class)));

            var authentication = new UsernamePasswordAuthenticationToken(
                    principal, null, principal.getAuthorities());
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }

        chain.doFilter(request, response);   // ★ 토큰이 없거나 틀려도 여기서 막지 않습니다
    }

    private String resolveToken(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        return (header != null && header.startsWith("Bearer ")) ? header.substring(7) : null;
    }
}
```

> **필터에서 직접 401을 내리지 마세요.** 필터는 "인증 정보를 채우는 역할"만 하고, 접근 차단 판단은 `authorizeHttpRequests`에 맡깁니다. 필터에서 막으면 화이트리스트 경로(`/api/auth/login`)까지 토큰을 요구하게 됩니다. **초심자가 가장 많이 틀리는 부분입니다.**

### (4) `SecurityConfig` (Spring Security 7.1)

```java
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final JwtAuthenticationEntryPoint entryPoint;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())          // JWT는 stateless라 CSRF 불필요
                .cors(Customizer.withDefaults())       // 프론트가 다른 오리진일 때 필요
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**", "/actuator/health").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/performances/**", "/api/sessions/**").permitAll()
                        .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(e -> e.authenticationEntryPoint(entryPoint))
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:5173"));   // 프론트 주소 (A와 합의)
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
```

**`requestMatchers` 순서가 중요합니다.** 위에서부터 매칭되므로 `anyRequest()`는 항상 마지막입니다.

### (5) 인증 실패 응답을 JSON으로

기본 설정에서는 401 응답이 **HTML 로그인 페이지**로 나옵니다. 프론트가 파싱하지 못하니 JSON으로 바꿉니다.

```java
@Component
@RequiredArgsConstructor
public class JwtAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException e) throws IOException {
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(),
                ApiResponse.fail(CommonErrorCode.UNAUTHORIZED.getCode(),
                                 CommonErrorCode.UNAUTHORIZED.getMessage()));
    }
}
```

> **`GlobalExceptionHandler`는 여기서 동작하지 않습니다.** 시큐리티 필터는 `DispatcherServlet`보다 **앞**에 있어서 `@RestControllerAdvice`가 잡지 못합니다. 이 구조를 모르면 "왜 예외 핸들러가 안 먹지?"로 반나절을 날립니다.

### (6) API

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| `POST` | `/api/auth/signup` | ❌ | 회원가입 |
| `POST` | `/api/auth/login` | ❌ | 로그인 → 토큰 |
| `GET` | `/api/users/me` | ✅ | 내 정보 |

회원가입 시 **이메일 중복 검사**를 꼭 넣으세요. `uq_users_email` 제약이 있어 안 넣어도 DB가 막지만, 사용자에게 "이미 가입된 이메일입니다"라고 알려주려면 서비스에서 먼저 확인해야 합니다.

로그인 실패 메시지는 **"이메일 또는 비밀번호가 올바르지 않습니다"** 하나로 통일하세요. "존재하지 않는 이메일"과 "비밀번호 불일치"를 구분해서 알려주면 가입된 이메일 목록을 알아낼 수 있습니다.

### 완료 확인

```bash
# 가입
curl -X POST localhost:8080/api/auth/signup -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password1","name":"홍길동"}'

# 로그인 → 토큰 획득
TOKEN=$(curl -s -X POST localhost:8080/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password1"}' | jq -r '.data.accessToken')

# 인증 필요 API
curl localhost:8080/api/users/me -H "Authorization: Bearer $TOKEN"

# 토큰 없이 호출 → JSON 형태의 401 인지 확인
curl -i localhost:8080/api/users/me
```

**PR**: `feat: JWT 기반 회원가입/로그인 및 시큐리티 설정 구현`

### 1~2주차 완료 기준
회원가입 → 로그인 → `/api/users/me` 성공 + 시드 데이터로 공연/좌석 조회 가능

---

# 3~4주차 — 공연 / 회차 / 좌석 조회 API

## API 목록

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/api/performances?page=0&size=20` | 공연 목록 (페이징) |
| `GET` | `/api/performances/{id}` | 공연 상세 + 회차 목록 |
| `GET` | `/api/sessions/{id}/seats` | 좌석 배치도 + 잔여 상태 |

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

좌석 하나당 필드가 10개면 1,200석 × 10입니다. 프론트가 실제로 쓰는 것만 남기세요.

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

## (4) A에게 제공할 Service 시그니처 ★ 5주차 전까지 필수

A의 좌석 선점/예매 확정 코드는 **B의 `SessionSeatService`를 호출**합니다. **구현 전에 시그니처만이라도 먼저 커밋하세요.**

```java
// domain/performance/service/SessionSeatService.java
@Service
public class SessionSeatService {

    /** 좌석들이 해당 회차에 속하고 예매 가능한 상태인지 검증. 아니면 예외 */
    public void validateAvailable(Long sessionId, List<Long> sessionSeatIds) { ... }

    /** 예매에 필요한 좌석 정보(가격 포함) 조회 */
    public List<SeatPriceInfo> findForBooking(Long sessionId, List<Long> sessionSeatIds) { ... }

    /** 예매 확정 시 SOLD 로 변경 (A가 T2에서 호출) */
    @Transactional
    public void markAsSold(List<Long> sessionSeatIds) { ... }

    /** 예매 취소 시 AVAILABLE 로 복구 */
    @Transactional
    public void markAsAvailable(List<Long> sessionSeatIds) { ... }
}
```

```java
// 도메인 경계를 넘는 DTO — A가 쓰므로 record 로 단순하게
public record SeatPriceInfo(Long sessionSeatId, String gradeName, int price) {}
```

**A가 `SessionSeatRepository`를 직접 주입하는 것은 `CLAUDE.md` 위반입니다.** 대신 필요한 메서드를 요청받으면 여기에 추가해 주세요.

**PR**: `feat: 공연/회차/좌석 조회 API 구현`

---

# 5~6주차 — 가상 대기실 (Redis ZSET)

> 패키지는 `booking` 하위가 아니라 **`domain/waitingroom/`을 신설**합니다.

## ★ Day 1에 무조건 할 일: 토큰 검증 시그니처 커밋

같은 기간에 A는 좌석 선점을 만듭니다. A의 코드가 이 메서드를 호출하므로, **없으면 A는 컴파일조차 못 합니다.**

```java
// domain/waitingroom/service/WaitingRoomService.java
@Service
public class WaitingRoomService {

    /** 입장 토큰이 유효하고 해당 회차·사용자의 것인지 검증. 아니면 예외 */
    public void validateEntryToken(String entryToken, Long sessionId, Long userId) {
        throw new UnsupportedOperationException("구현 예정");   // 껍데기라도 Day 1에 커밋!
    }
}
```

**"구현 다 하고 올릴게"는 2인 개발에서 가장 나쁜 선택입니다.** 껍데기 커밋 5분이 A의 2주를 살립니다.

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

### ⑥ 토큰 검증 (A가 호출하는 그 메서드)

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

## A와 합의할 수치 ★

```
입장 토큰 TTL (B)   >   좌석 락 TTL (A)   >   결제 제한 시간 (A)
    15분                    7분                   5분
```

**입장 토큰이 좌석 락보다 먼저 만료되면**, 좌석은 잡았는데 예매 확정 시 토큰 검증에서 튕깁니다. **5주차 시작 전에 A와 숫자를 맞추세요.**

### 처리율(초당 N명)은 어떻게 정하나

지금은 근거가 없습니다. **일단 임의의 값(예: 초당 20명)으로 시작하고, 11주차 부하 테스트에서 "서버가 견디는 최대 처리량"을 측정해 역산**하세요. 이 과정 자체가 포트폴리오에 쓸 좋은 이야기입니다.

## 완료 확인

```bash
# 여러 사용자로 동시 진입 후 순번이 겹치지 않는지
docker compose exec redis redis-cli ZRANGE "waiting:queue:1" 0 -1 WITHSCORES

# 같은 사용자가 두 번 진입해도 순번이 유지되는지 (NX 검증)
```

**PR**: `feat: Redis ZSET 기반 가상 대기실 구현`

---

# 7~8주차 — Kafka 연동 + `notification`

## ★ Day 1: 이벤트 DTO 먼저 확정

A가 발행 코드를 붙이려면 DTO가 있어야 합니다. **`global/event/` 중립 패키지**에 둡니다 — 어느 한쪽 도메인에 두면 반대쪽이 남의 도메인을 import하게 됩니다.

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

## `notification` 테이블 마이그레이션

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

> **`V2__`를 쓰지 마세요.** A도 같은 기간에 마이그레이션을 추가합니다. 타임스탬프여야 충돌하지 않습니다.
> 마이그레이션을 추가했으면 `Notification` **엔티티도 함께** 만드세요.

## 토픽 설계

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

## Consumer

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

**①만 있으면 부족합니다.** 두 스레드가 동시에 `existsByEventId`를 통과할 수 있습니다. ②의 DB 제약이 진짜 보장입니다. — **이 프로젝트가 좌석 예매에서 쓰는 것과 정확히 같은 패턴**입니다.

## 이벤트 발행 실패 문제 (A와 함께 논의)

**DB 커밋은 성공했는데 Kafka 발행이 실패하면 알림이 유실됩니다.** 정석 해법은 트랜잭셔널 아웃박스 패턴(이벤트를 DB 테이블에 함께 저장하고 별도 프로세스가 발행)입니다.

**3개월 일정에서는 다음 중 하나를 고르세요.**

| 선택 | 난이도 | 비고 |
|---|---|---|
| `@TransactionalEventListener(AFTER_COMMIT)` + 실패 시 로그 | 낮음 | **MVP 권장.** "유실 가능성이 있음"을 문서에 명시 |
| 아웃박스 패턴 | 높음 | 학습 소재로는 최고. 일정에 여유가 있을 때만 |

**어느 쪽을 고르든 "왜 그렇게 했는지"를 README에 쓰세요.** 한계를 아는 것과 모르는 것은 완전히 다릅니다.

## DLQ (9~10주차)

소비 실패가 무한 재시도로 이어지면 컨슈머가 그 메시지에 갇혀 뒤의 모든 메시지가 멈춥니다.

```java
@Bean
public DefaultErrorHandler errorHandler(KafkaTemplate<Object, Object> template) {
    var recoverer = new DeadLetterPublishingRecoverer(template);   // booking.confirmed.DLT 로 이동
    return new DefaultErrorHandler(recoverer, new FixedBackOff(1000L, 2));  // 1초 간격 2회 재시도
}
```

## 완료 확인

```bash
# 토픽 확인
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9092

# 메시지 직접 확인
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --topic booking.confirmed --from-beginning --bootstrap-server localhost:9092
```

예매를 한 건 확정하고 → consumer 로그가 찍히고 → `notification` 테이블에 1행이 생기면 완료입니다. **같은 메시지를 두 번 보내도 1행만 생기는지**도 반드시 확인하세요.

**PR**: `feat: Kafka 이벤트 연동 및 알림 적재 구현`

---

# 9~10주차 — 프론트 예매 플로우 연동 + 안정화

- 프론트에서 **대기실 → 좌석 선택 → 예매 → 완료** 전체 플로우 연결 (A와 협업)
- consumer 멱등성 검증 테스트
- DLQ 동작 확인 (일부러 예외를 던져 DLT로 가는지)
- 11주차 부하 테스트용 **대량 계정/토큰 사전 생성** — 동시 수천 명 시나리오는 계정이 미리 있어야 합니다. 11주차에 몰아서 하면 늦습니다

---

# B가 반드시 기억할 5가지

1. **시드 데이터가 A의 블로커다** — 인증보다 먼저 끝낸다
2. **시그니처를 먼저 커밋한다** — `SessionSeatService`, `validateEntryToken`, 이벤트 DTO. 껍데기라도 Day 1에
3. **`ZADD NX`를 쓴다** — `add()`를 쓰면 새로고침마다 순번이 맨 뒤로 밀린다
4. **멱등성은 DB 제약으로 보장한다** — `uq_notification_event`. 코드 체크만으로는 동시 소비를 못 막는다
5. **`global/`은 확정 후 동결** — 바꿔야 하면 A 리뷰를 거친다
