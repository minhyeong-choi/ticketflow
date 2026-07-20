# ticketFlow 로드맵 & 진행 체크리스트

> 이 문서는 프로젝트 전체 계획과 완료 현황을 추적하기 위한 문서입니다. 마일스톤을 끝낼 때마다 체크박스를 갱신하세요.

## 프로젝트 개요

- **목표**: 공연(콘서트/뮤지컬) 티켓팅 플랫폼. 핵심 기술 챌린지는 "동시 대량 접속 시 좌석 선점/중복 예매 방지"
- **목적**: 학습/포트폴리오 (실서비스 운영 목표 아님)
- **기간**: 3개월 MVP
- **팀**: 백엔드 2인(기능 단위 수직 분담) + 프론트는 AI 도구로 백엔드 개발자 1인이 겸임
- **스택**: Java 21, Spring Boot 4.1.x, Gradle(Groovy), PostgreSQL, Redis, Kafka
- **MVP 제외**: 스포츠 도메인, 실제 PG 연동, 실명인증/소셜로그인, 실서비스급 배포

## 역할 분담

| 담당 | 도메인 |
|---|---|
| 개발자 A | booking(예매/좌석 선점/대기실), payment(Mock 결제) |
| 개발자 B | user, performance(공연/좌석 카탈로그), notification(Kafka consumer) |
| 프론트엔드 | 팀원 1인이 AI 도구로 생성/유지보수 |

## 0단계 — 프로젝트 스캐폴딩

- [x] Spring Initializr로 프로젝트 생성 (Gradle Groovy, Java 21, Spring Boot 4.1.0, group `com.ticket`, artifact `ticketflow` → 실제 패키지 `com.ticket.ticketflow`)
- [x] build.gradle 의존성 구성 (web, actuator, redis, kafka, security, validation, flyway, postgresql, lombok, jjwt)
- [x] 도메인별 패키지 구조 생성 (user/performance/booking/payment/notification × controller/service/repository/entity/dto), `src/main/java/com/ticket/ticketflow/` 하위로 위치 이동 완료
- [x] docker-compose.yml 작성 (postgres:16, redis:7, kafka KRaft 단일 브로커)
- [x] `docker compose up -d`로 3개 컨테이너 정상 기동 확인
- [x] application.yml(local 프로필 활성화) / application-local.yml(DB·Redis·Kafka 접속 설정) 작성
- [x] `./gradlew build` 성공
- [x] `./gradlew bootRun` 기동 후 `GET /actuator/health` → `{"status":"UP"}` 확인

### 확인 필요 (Known Issues)
- [ ] `data-jpa`, `redisson-spring-boot-starter` 의존성이 build.gradle에 주석 처리된 상태 — 1단계(도메인 모델링) 시작 전 활성화 필요

## 1~2주차 — 도메인 모델링 & 인증

- [ ] ERD 확정 (user / performance / venue / session / seat / booking / payment)
- [ ] Flyway 마이그레이션 스크립트 작성 (`src/main/resources/db/migration/V1__init.sql`)
- [ ] 회원가입/로그인 API + JWT 발급·검증
- [ ] **완료 기준**: 회원가입 → 로그인 → 인증 필요 API 호출 성공

## 3~4주차 — 공연/좌석 조회 (B) + 프론트 기본 화면

- [ ] 공연 목록/상세, 회차, 좌석 등급 조회 API
- [ ] 프론트 목록/상세 화면 (AI 생성) + API 연동
- [ ] **완료 기준**: 프론트에서 목록 → 상세 → 좌석 배치도 조회 가능

## 5~6주차 — 가상 대기실 (A)

- [ ] Redis 기반 순번 발급 API
- [ ] 입장 토큰 발급/검증
- [ ] **완료 기준**: 동시 요청 시 순번대로 토큰 발급됨을 로컬에서 확인

## 7~8주차 — 좌석 선점 + Mock 결제 + 예매 확정 (A)

- [ ] Redisson 분산 락으로 좌석 임시 점유(TTL 자동 해제)
- [ ] Mock 결제 API
- [ ] PostgreSQL 트랜잭션 + unique constraint로 최종 확정
- [ ] **완료 기준**: 동일 좌석 동시 요청 시 1건만 성공

## 9~10주차 — Kafka 연동 (B)

- [ ] booking → 예매 확정/취소 이벤트 발행
- [ ] notification → consumer로 소비/로그 적재
- [ ] **완료 기준**: 예매 확정 시 이벤트 발행 및 consumer 수신 로그 확인

## 11주차 — 부하 테스트 (공동)

- [ ] k6 시나리오 작성 (동일 좌석 동시 요청, 대기실 진입)
- [ ] RPS/에러율/락 경합 리포트 정리

## 12주차 — 마무리

- [ ] 버그 픽스
- [ ] 데모 배포 (단일 서버 docker compose)
- [ ] README/아키텍처 다이어그램/부하테스트 리포트 문서화
