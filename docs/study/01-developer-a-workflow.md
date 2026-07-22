# 01. 개발자 A(choimh) 워크플로우 — 프론트엔드 + `global` / `user` / `payment`

> 담당 기준은 **`docs/ROADMAP.md`의 "역할 분담 (2026-07 재편)"** 표입니다. 이 문서는 그 표를 그대로 따릅니다.
> (2026-07-22 개정: 구 분담에서 A가 갖고 있던 `booking`·좌석 선점·예매 확정은 **B로 이관**되어 [02번 문서](02-developer-b-workflow.md)로 옮겼고, 구 분담에서 B가 갖고 있던 `global`·인증(JWT)은 **A로 이관**되어 이 문서로 들어왔습니다.)

> **먼저 [00-common-workflow.md](00-common-workflow.md)를 읽으세요.** 이 문서는 그 내용을 안다고 가정합니다.

## A가 맡은 것

| 영역 | 내용 |
|---|---|
| **프론트엔드 전체** | 모든 화면. AI 도구로 생성하되 **유지보수·품질 책임은 A** |
| `global/` | 공통 응답·예외·시큐리티·공통 엔티티 기반 (**1주차에 확정 후 동결**) |
| `domain/user` | 회원가입, 로그인, JWT 인증 |
| `domain/payment` | Mock 결제 |
| 부수 작업 | `springdoc-openapi` 도입, Testcontainers, CORS 설정 |
| API 경로 | `/api/auth/**`, `/api/users/**`, `/api/payments/**` |

**A는 1~2주차에 "B를 막지 않는 것"이 최우선입니다.**

- `global/`의 `ApiResponse`·`ErrorCode`·`BusinessException`이 없으면 B의 모든 API가 그 위에 못 얹힙니다.
- `global/common/BaseCreatedEntity`·`BaseTimeEntity`가 없으면 B의 엔티티 8종이 **컴파일조차 안 됩니다.**
- `domain/user/entity/User.java`가 없으면 B의 `Booking`(→ `@ManyToOne User`)이 컴파일되지 않습니다.

**구현을 다 끝내고 올리지 말고, 껍데기라도 Day 1에 먼저 머지하세요.**

## 전체 일정

| 주차 | 할 일 | B에게 미치는 영향 |
|---|---|---|
| 1~2 | `global/` 확정 → Base·`User`·`Payment` 엔티티 → **인증(JWT)** | global·`User`가 없으면 B는 착수 자체가 불가 |
| 3~4 | 프론트 골격 + 인증 화면 + 카탈로그 화면(Mock) + Testcontainers + springdoc | SP2에서 B의 실 API로 교체 |
| 5~6 | 대기실 프론트 + **Mock 결제(`payment`)** | 결제 시그니처가 B의 7~8주차 예매 확정 조건 |
| 7~8 | 예매 플로우 프론트 + 결제 연동 | |
| 9~10 | 알림/마이페이지 화면 + 전체 UX 마무리 | |
| 11~12 | 대량 테스트 계정 생성·결과 시각화 / 마무리 (공동) | |

## B와 주고받는 계약 (미리 알아두세요)

| 계약 | 제공 | 사용 | 언제까지 |
|---|---|---|---|
| `ApiResponse` / `ErrorCode` / `BusinessException` / `GlobalExceptionHandler` | **A** | B | 1주차 Day 1 |
| `BaseCreatedEntity` / `BaseTimeEntity` | **A** | B (엔티티 8종) | 1주차 Day 1 |
| `User` 엔티티 | **A** | B (`Booking`이 `@ManyToOne` 참조) | 1주차 Day 2 |
| JWT 인증 + 인증 주체에서 `userId` 꺼내는 방법 | **A** | B (모든 인증 필요 API) | SP1 (2주차 말) |
| `PaymentService.pay(...)` 시그니처 | **A** | B (`BookingFacade`가 호출) | 6주차 말 |
| 시드 데이터 | B | **A** (프론트가 볼 실데이터) | 2주차 말 |
| OpenAPI 명세 (카탈로그·대기실·예매) | B | **A** (프론트 Mock→실 API) | SP2 (4주차 말) |
| CORS 허용 오리진 | **A**(`SecurityConfig` 소유) | — | 3주차 |

---

# 1~2주차 — 공통 기반 확정 → 엔티티 → 인증

같은 기간에 B는 **카탈로그·예매 엔티티 8종과 시드 데이터**를 만듭니다. B의 엔티티는 A의 `global/common/Base*Entity`와 `User`에 의존하므로, **A의 Day 1~2가 B의 출발선입니다.**

## Day 1: `global/` 공통 인프라 확정 ★ 우선순위 1위

**A와 B가 모두 이 위에 코드를 얹습니다.** 늦게 확정될수록 나중에 전부 고쳐야 하니 **가장 먼저, 하루 만에** 끝내세요. 완벽하지 않아도 됩니다 — 확정되는 것 자체가 가치입니다.

### 만들 파일

```
global/common/ApiResponse.java
global/exception/ErrorCode.java              # ★ interface (enum 아님)
global/exception/CommonErrorCode.java        # enum implements ErrorCode
global/exception/BusinessException.java
global/exception/GlobalExceptionHandler.java
global/event/                                # 빈 패키지 + .gitkeep (9주차 Kafka DTO 자리, B가 채움)
```

**코드는 [00번 문서 8장](00-common-workflow.md#8-공통-응답--예외-처리-규격)에 그대로 있습니다.** 그대로 만드세요.

### 왜 `ErrorCode`가 interface여야 하는지 다시 확인

단일 enum이면 A가 `DUPLICATE_EMAIL`을 추가하고 B가 `SEAT_ALREADY_HELD`를 추가할 때 **같은 파일의 같은 위치를 고쳐 매번 머지 충돌**이 납니다. interface로 쪼개면 각자 자기 파일만 건드립니다.

```
global/exception/ErrorCode.java                        ← interface, 동결
global/exception/CommonErrorCode.java                  ← 공통만, 변경 시 상대 리뷰
domain/user/exception/UserErrorCode.java               ← A만 수정 (U001~)
domain/payment/exception/PaymentErrorCode.java         ← A만 수정 (Y001~)
domain/performance/exception/PerformanceErrorCode.java ← B만 수정 (P001~)
domain/waitingroom/exception/WaitingRoomErrorCode.java ← B만 수정 (W001~)
domain/booking/exception/BookingErrorCode.java         ← B만 수정 (B001~)
```

코드 접두어를 도메인별로 다르게 하면 코드값도 충돌하지 않습니다.

### 확정 후 규칙

**`global/` 하위는 머지 이후 동결입니다.** 변경이 필요하면 B 리뷰를 거치세요. 기능 개발 중에 `ApiResponse` 필드를 슬쩍 바꾸면 B의 모든 API가 동시에 깨집니다.

**PR**: `feat: 공통 응답 포맷 및 예외 처리 기반 구축` → B 리뷰 후 **즉시 머지**

---

## Day 1~2: 공통 시간 매핑 + `User` / `Payment` 엔티티 ★ B의 컴파일 조건

엔티티 10종 중 A가 쓰는 것은 **`User`, `Payment` 2종과 공통 부모 2종**입니다. 나머지 8종(`Venue`/`VenueSeat`/`Performance`/`SeatGrade`/`PerformanceSession`/`SessionSeat`/`Booking`/`BookingSeat`)은 **B가 씁니다**(ROADMAP "(1) JPA 엔티티 작성" 참고).

### 만들 파일

```
global/common/BaseCreatedEntity.java        # created_at 만 있는 테이블용
global/common/BaseTimeEntity.java           # created_at + updated_at 용

domain/user/entity/User.java
domain/user/entity/Role.java

domain/payment/entity/Payment.java
domain/payment/entity/PaymentStatus.java
```

### 순서가 중요합니다

```
① global/common/Base*Entity  ─┐
                              ├─→ B가 엔티티 8종 착수 가능
② domain/user/entity/User    ─┘   (Booking 이 User 를 @ManyToOne 참조)
③ domain/payment/entity/Payment   (Booking 이 있어야 컴파일되므로 B의 Booking 머지 후)
```

**①②를 Day 1~2에 별도 PR로 먼저 머지하세요.** `Payment`는 `Booking`(B 소유)을 참조하므로 B의 엔티티 PR이 머지된 뒤에 붙이는 게 순서상 자연스럽습니다.

### ⚠️ 함정 ① — `BaseTimeEntity`를 전부 상속시키면 절반이 기동에 실패합니다

블로그 예제는 모든 엔티티에 `BaseTimeEntity`를 상속시키라고 하지만, **이 스키마는 테이블마다 시간 컬럼이 다릅니다.** `ddl-auto: validate` 환경에서 없는 컬럼을 선언하면 `Schema-validation: missing column`으로 앱이 뜨지 않습니다.

| `created_at` + `updated_at` | `created_at` 만 | 시간 컬럼 없음 |
|---|---|---|
| `users`, `performance` | `venue`, `session`, `booking`, `payment` | `venue_seat`, `seat_grade`, `session_seat`, `booking_seat` |
| → `BaseTimeEntity` 상속 | → `BaseCreatedEntity` 상속 | → **상속하지 않음** |

**A가 만드는 두 부모 클래스가 B의 8종까지 전부 떠받칩니다.** 표를 그대로 반영해 만드세요 — 코드는 [00번 문서 3-3](00-common-workflow.md#3-3-️-최대-함정-테이블마다-시간-컬럼이-다릅니다)에 있습니다.

### ⚠️ 함정 ② — `TIMESTAMPTZ`는 반드시 `OffsetDateTime`

`LocalDateTime`은 "타임존 없는 시각"이라 Postgres의 `timestamp with time zone`과 타입이 어긋납니다. `wrong column type ... found [timestamp], expected [timestamptz]`로 걸리거나, 통과하더라도 **시간이 9시간씩 밀리는 버그가 나중에 터집니다.** `Date`·`LocalDateTime` 금지, **팀 전체가 `OffsetDateTime` 하나로 통일**합니다.

### `User` 엔티티 표준 형태

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

    @Builder                        // ⑤ 생성은 빌더로, 생성자는 private
    private User(String email, String password, String name, String phone, Role role) {
        this.email = email;
        this.password = password;
        this.name = name;
        this.phone = phone;
        this.role = role;
    }
}
```

`users`는 Postgres 예약어 `user`를 피하려고 복수형으로 만든 테이블입니다. `@Table(name = "users")`를 빼먹으면 Hibernate가 `user` 테이블을 찾다가 실패합니다.

### `Payment` — 재시도 제약은 "실패 이력을 남길 때만" 문제가 됩니다

`V1__init.sql`의 `uq_payment_booking`은 `UNIQUE(booking_id)`인데, `ck_payment_status`에는 `FAILED`가 있습니다. 결제가 한 번 실패해 `FAILED` **행을 남기면** 재결제 INSERT가 거부됩니다.

> ⚠️ **다만 현재 확정된 흐름에서는 이 문제가 발생하지 않습니다.** 결제 실패 시 `payment` 행을 애초에 INSERT하지 않고(`02-developer-b-workflow.md`의 `cancelPending()`은 `booking`/`booking_seat`만 CANCELLED로 전환), `payment` INSERT는 T2에서 **성공 시에만** 일어납니다. 재시도는 booking이 CANCELLED된 뒤 **새 `booking_id`로** 시작되므로 유니크 제약에 걸리지 않습니다.
>
> 따라서 순서는 이렇습니다: **먼저 "결제 실패 이력을 `payment`에 `FAILED`로 남길 것인가"를 결정**하고(PRD U12), 남기기로 할 때만 `WHERE status='SUCCESS'` 부분 유니크로 전환합니다. 남기지 않으면 현재 스키마 그대로 문제없습니다.

A는 `Payment` 엔티티를 만들 때 이 사실만 알고 있으면 됩니다 — 지금 `V1__init.sql`을 고치지 마세요. 이미 적용된 마이그레이션을 수정하면 Flyway 체크섬이 깨져 앱이 안 뜹니다.

### 완료 확인

```bash
docker compose up -d
./gradlew bootRun
```

`Started TicketflowApplication in X seconds`가 뜨면 **A가 쓴 엔티티가 스키마와 일치한다는 증명**입니다. 이 로그를 PR 본문에 붙이세요.

에러가 나면 [00번 문서의 에러 표](00-common-workflow.md#11-자주-만나는-에러와-읽는-법)를 보세요. 대부분 `missing column` 또는 `wrong column type`이고, `V1__init.sql`과 한 줄씩 대조하면 5분 안에 찾습니다.

**PR**: `feat: 공통 시간 매핑 클래스 및 User/Payment 엔티티 추가` → B 리뷰 후 즉시 머지

---

## Day 3~7: 회원가입 / 로그인 / JWT

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

**화이트리스트에 B의 경로까지 함께 넣어야 합니다.** `SecurityConfig`는 `global/` 소유(A)이므로, B는 여기를 직접 고치지 않고 A에게 요청합니다.

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
                        // ↓ B 소유 경로. 조회는 공개, 대기실·예매는 인증 필요
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
        config.setAllowedOrigins(List.of("http://localhost:5173"));   // 프론트 주소 (A가 결정)
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

### ★ B에게 반드시 알려줄 것: 컨트롤러에서 `userId` 꺼내는 법

B의 대기실·예매 API는 전부 "로그인한 사용자가 누구인가"를 필요로 합니다. **인증 주체를 정한 사람이 A이므로 사용법도 A가 전달해야 합니다.**

```java
// B가 자기 컨트롤러에서 이렇게 씁니다 — 이 형태를 SP1에 공유하세요
@PostMapping("/api/bookings/seats/hold")
public ApiResponse<SeatHoldResponse> hold(@AuthenticationPrincipal CustomUserDetails user,
                                          @Valid @RequestBody SeatHoldRequest request) {
    return ApiResponse.success(seatHoldService.hold(user.getUserId(), request));
}
```

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

---

## Day 8~10: API 문서 도구 도입 (springdoc-openapi)

로드맵상 3~4주차 항목이지만 **1~2주차로 당깁니다.** 이유는 문서화가 아니라 **A와 B 사이의 인터페이스 계약** 때문입니다. 2인 병렬 개발에서 API 스펙은 문서가 아니라 "개발 순서를 푸는 도구"입니다. A는 이 명세를 보고 프론트를 **Mock으로 선행**하고, SP2에서 B의 실 API로 갈아끼웁니다.

```gradle
// build.gradle
implementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.5'
```

> 버전은 Spring Boot 4.x 호환 최신 버전을 확인하고 넣으세요. 호환이 안 되면 **억지로 맞추지 말고 넘어가세요.** 대신 `docs/api.md`에 요청/응답 예시를 손으로 적는 것으로 대체합니다. 목적은 도구가 아니라 "상대가 내 API 스펙을 미리 아는 것"입니다.

기동 후 `http://localhost:8080/swagger-ui.html` 접속 확인. (`SecurityConfig` 화이트리스트에 `/swagger-ui/**`, `/v3/api-docs/**`가 이미 들어 있습니다.)

**PR**: `chore: springdoc-openapi 도입 및 Swagger UI 설정`

### 1~2주차 완료 기준
회원가입 → 로그인 → `GET /api/users/me` 성공. **그리고 B가 A를 기다리지 않고 엔티티·시드를 진행 중일 것.**

---

# 3~4주차 — 프론트 골격 + Testcontainers → SP2

이 기간에 B는 카탈로그 조회 API를 만듭니다. A는 **프론트 골격**과 **테스트 기반**에 집중하세요.

## (1) 프론트 셋업

- **확정**: 같은 레포 `frontend/`, **React + TypeScript + Vite**. 디렉터리 구조·기술 선택·설계 이슈는 [`docs/FRONTEND.md`](../FRONTEND.md)를 그대로 따르세요
- **CORS 설정**은 A의 `SecurityConfig`에 이미 있습니다. 프론트 개발 서버 포트를 정하면 `setAllowedOrigins`를 맞추세요
- AI 생성 코드도 **PR 리뷰 대상**입니다. 읽지 않고 머지하지 마세요 — 기획 단계에서 합의한 사항입니다

### 화면 순서

| 순서 | 화면 | 데이터 출처 |
|---|---|---|
| 1 | 회원가입 / 로그인 | **실 API** (2주차에 이미 완성됨) |
| 2 | 공연 목록 / 상세 | B의 OpenAPI 명세 기반 **Mock** → SP2에서 실 API |
| 3 | 좌석 배치도 | 동일 |

**2번부터는 Mock으로 먼저 만드세요.** B의 API 완성을 기다리면 4주차를 통째로 날립니다. B의 명세만 있으면 응답 모양은 확정이므로, 연결만 나중에 교체하면 됩니다.

## (2) Testcontainers 도입

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
class AuthServiceTest extends IntegrationTestSupport { ... }
```

> **이건 A가 만들지만 진짜 수혜자는 B입니다.** B는 **7~8주차**에 이 위에서 동시성 통합 테스트를 돌립니다. **B가 착수하기 훨씬 전에 깔아두세요.**

### 완료 후

- `docker compose` 없이 `./gradlew build`가 성공하는지 확인
- 성공하면 `.github/workflows/ci.yml`의 `services:` 블록을 제거 (더 이상 필요 없음)

**PR**: `test: Testcontainers 도입 및 CI service container 제거`

> Docker Desktop이 실행 중이어야 합니다. 첫 실행은 이미지 다운로드로 몇 분 걸립니다.

**완료 기준**: 프론트에서 목록 → 상세 → 좌석 배치도 조회 가능 (SP2 시점에 Mock → 실 API 전환 완료)

---

# 5~6주차 — 대기실 프론트 + Mock 결제 → SP3

## (1) 대기실 프론트

B가 같은 기간에 대기실 백엔드를 만듭니다.

- 대기 순번 화면 — **폴링 우선**(SSE는 여유 있을 때). 폴링 주기가 너무 짧으면 그 자체가 부하가 됩니다
- 입장 허용 시 좌석 선택 화면으로 전환하는 UX
- 대기 포기 버튼

> 폴링 응답이 곧 **heartbeat**입니다(B의 설계). 사용자가 탭을 닫으면 폴링이 끊기고 30초 뒤 큐에서 자동 제거됩니다. **프론트가 폴링을 멈추면 그 사용자는 유령 취급된다**는 점을 알고 화면을 만드세요.

## (2) Mock 결제 (`payment`) ★ B의 7~8주차 조건

B의 예매 확정 흐름(T1 → **결제** → T2)이 A의 `PaymentService`를 호출합니다. **6주차 말까지 시그니처를 확정해 머지하세요.**

```java
// domain/payment/service/PaymentService.java
@Service
public class PaymentService {

    /** 실제 PG 대신 즉시 성공 응답. transaction_id 를 UUID 로 발급해두면
     *  나중에 실 PG 연동 시 구조가 그대로 유지된다. */
    public PaymentResult pay(Long bookingId, int amount) {
        return new PaymentResult(true, UUID.randomUUID().toString(), OffsetDateTime.now());
    }
}
```

```java
// 도메인 경계를 넘는 DTO — B가 쓰므로 record 로 단순하게
public record PaymentResult(boolean success, String transactionId, OffsetDateTime paidAt) {}
```

### 반드시 지킬 것 3가지

1. **실패 케이스를 만들 수 있게 하세요.** 예: 특정 금액이면 실패 반환, 또는 `local` 프로필 설정으로 실패율 지정. **실패 경로를 한 번도 안 돌려보면 B의 T1 롤백 코드가 동작하는지 알 수 없습니다.**
2. **`pay()`에 `@Transactional`을 붙이지 마세요.** B는 이 메서드를 **트랜잭션 밖에서** 호출합니다(수백 ms~수 초 동안 DB 커넥션을 점유하면 좌석 경합 구간에서 커넥션 풀이 고갈됩니다).
3. **`payment` 테이블 INSERT는 B의 T2 안에서 일어납니다.** `pay()`는 "결제 결과를 돌려주는 것"까지만 하고 DB에 쓰지 마세요 — `payment.booking_id`가 NOT NULL FK라 booking 트랜잭션 안에서 저장해야 정합이 맞습니다.

> `PaymentService`를 **껍데기라도 5주차 초에 먼저 커밋**하면 B는 예매 확정 코드를 병렬로 쓸 수 있습니다. `throw new UnsupportedOperationException("구현 예정")` 한 줄이면 충분합니다.

**PR**: `feat: Mock 결제 서비스 및 대기실 화면 구현`

---

# 7~8주차 — 예매 플로우 프론트 + 결제 연동 → SP4

B가 좌석 선점·예매 확정을 만드는 동안, A는 그 흐름을 화면으로 연결합니다.

- 좌석 선택 → 선점 → 결제 → 확정 화면
- **선점 만료 타이머 UX** — 좌석 락 TTL(7분)에 맞춘 카운트다운. 만료되면 좌석 선택 화면으로 되돌립니다
- **이미 팔린 좌석 에러 처리** — `409` + `B409`("이미 예매된 좌석입니다") 응답을 사용자 언어로 번역
- `/api/payments/**` 화면 연동

### A/B가 맞춰야 하는 수치

```
대기실 입장 토큰 TTL   >   좌석 락 TTL   >   결제 제한 시간
       (15분)                (7분)             (5분)
```

**세 값 모두 B가 결정·관리합니다**(대기실·좌석락·예매확정이 전부 B 소유). A는 **화면 타이머를 이 숫자에 맞추기만** 하면 됩니다. **7주차 시작 전에 B에게 확정 수치를 받아두세요** — 화면 타이머가 실제 TTL보다 길면 사용자는 "시간이 남았는데 실패했다"고 느낍니다.

### (선택) 동시성 테스트에 페어 참여

B의 7~8주차 동시성 통합 테스트에 함께 참여하면 A도 이 프로젝트의 핵심 기술을 설명할 수 있게 됩니다. **포트폴리오 균형 차원에서 권장합니다.**

---

# 9~10주차 — 알림 / 마이페이지 + UX 마무리 → SP5

- 예매 내역(마이페이지) 화면 — B의 `GET /api/bookings` 연동
- 알림 목록 화면 — B의 `notification` 적재 결과 조회
- 전체 UX 다듬기, 프론트 버그 정리
- **대기실 → 좌석 선택 → 예매 → 완료 전체 플로우**를 처음부터 끝까지 한 번 통과시켜 보세요 (B와 협업)

---

# 11~12주차 — 공동 작업

- **[A] 대량 테스트 유저/토큰 사전 생성** — 동시 수천 명 시나리오는 계정이 미리 있어야 합니다. **11주차에 몰아서 하면 늦습니다. 9~10주차에 준비하세요.**
- **[A] 부하 테스트 결과 시각화**
- **[A] 프론트 데모 시나리오, README 통합**
- 앱 Dockerfile + prod 프로필/시크릿 분리 (JWT secret·DB 비밀번호 환경변수화 — A가 1주차에 잡아둔 방식 그대로 확장)

---

# A가 반드시 기억할 5가지

1. **`global/`과 `User` 엔티티가 B의 출발선이다** — Day 1~2에 껍데기라도 머지한다. "완성해서 올릴게"는 B의 1주를 날린다
2. **`global/`은 확정 후 동결** — 바꿔야 하면 B 리뷰를 거친다. `ApiResponse` 필드 하나가 B의 모든 API를 깬다
3. **`BaseTimeEntity`를 전부 상속시키지 않는다** — 시간 컬럼 표를 그대로 따른다. A가 만든 부모가 B의 8종까지 떠받친다
4. **`SecurityConfig` 화이트리스트는 A가 관리한다** — B가 경로를 추가해 달라고 하면 A가 반영한다
5. **Mock 결제는 실패 경로를 만들 수 있게 만든다** — 성공만 되면 B의 롤백 코드가 검증되지 않는다
