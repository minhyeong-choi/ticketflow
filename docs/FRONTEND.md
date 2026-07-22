# ticketFlow 프론트엔드 구조 설계

| 항목 | 내용 |
|---|---|
| 문서 버전 | v1.1 |
| 작성일 / 최종 수정 | 2026-07-22 / 2026-07-23 |
| 소유자 | 개발자 A (choimh) — 작성·유지보수 책임. B는 PR에서 **API 연동 관점** 리뷰 |
| 근거 문서 | [`docs/PRD.md`](PRD.md) 5.7절(FR-F1~F9) · 5.8절(FR-M1~M3) · [`CLAUDE.md`](../CLAUDE.md) · [`docs/study/01-developer-a-workflow.md`](study/01-developer-a-workflow.md) |

> **v1.1 변경 요약** (PRD v1.2 반영): 회원정보 수정 화면(FR-F8) · 관리자 카탈로그 관리 화면(FR-F9) 추가 · `features/admin/` 슬라이스 신설 · 라우트·주차별 산출물·B 요청 계약(C7) 반영.

> 이 문서는 **프론트엔드의 구조와 설계 결정**만 다룹니다. 화면별 요구사항은 PRD 5.7, 주차별 진행 순서는 `docs/study/01-developer-a-workflow.md`를 보세요.

---

## 0. 확정 사항 (PRD U2 해소)

| 항목 | 결정 | 근거 |
|---|---|---|
| 프레임워크 | **React 19 + TypeScript + Vite** | 프론트를 "AI 도구로 생성하고 A가 유지보수"하는 전제(ROADMAP 역할표)에서 생성 품질·참고자료가 가장 두터움 |
| 코드 위치 | **같은 레포 `frontend/`** | `ROADMAP.md:298`이 이미 권장. API 변경과 화면 변경이 한 PR에 담겨 B의 연동 리뷰가 가능하고, OpenAPI 타입 생성을 같은 레포에서 돌릴 수 있음 |
| 렌더링 | **SPA (SSR 없음)** | 인증이 `Authorization: Bearer` 헤더 기반(`ROADMAP.md:214`)이라 쿠키·SSR 전제가 없음. 티켓팅 핵심 화면은 모두 인증 뒤에 있어 SEO 이득도 없음 |
| 개발 서버 포트 | **5173** (Vite 기본) | `01-developer-a-workflow.md:399`의 `setAllowedOrigins("http://localhost:5173")`가 이미 이 값 — **바꾸면 CORS 설정도 함께 고쳐야 합니다** |

---

## 1. 레포 구조

```
ticketflow/
├─ src/                          # 백엔드 (기존, 변경 없음)
├─ frontend/                     # ← 신설
│  ├─ public/
│  ├─ src/
│  │  ├─ main.tsx
│  │  ├─ App.tsx                 # Provider 조립 + 라우터 마운트
│  │  │
│  │  ├─ routes/                 # 라우트 정의 + 페이지 컴포넌트
│  │  │  ├─ router.tsx
│  │  │  ├─ ProtectedRoute.tsx   # 인증 가드
│  │  │  └─ pages/
│  │  │
│  │  ├─ features/               # ★ 도메인별 수직 슬라이스 (백엔드 domain/과 1:1)
│  │  │  ├─ auth/
│  │  │  ├─ catalog/
│  │  │  ├─ waiting/
│  │  │  ├─ booking/
│  │  │  ├─ payment/
│  │  │  ├─ mypage/            # 예매 내역 + 회원정보 수정 (FR-F7·F8)
│  │  │  └─ admin/             # 관리자 카탈로그 관리 (FR-F9, ADMIN 전용) — P2
│  │  │
│  │  ├─ api/
│  │  │  ├─ client.ts            # fetch 래퍼 — ApiResponse 언랩, 토큰 주입, 에러 정규화
│  │  │  ├─ generated/           # openapi-typescript 산출물 (커밋함, 손으로 고치지 말 것)
│  │  │  └─ queryKeys.ts         # TanStack Query 키 단일 정의
│  │  │
│  │  ├─ components/             # 도메인 무관 공용 UI (Button, Modal, Countdown …)
│  │  ├─ hooks/                  # 공용 훅 (useInterval, useVisibility …)
│  │  ├─ lib/                    # errorCode 번역, 시간 계산, env
│  │  ├─ mocks/                  # MSW 핸들러 (SP2 전까지 프론트 선행용)
│  │  └─ styles/
│  │
│  ├─ .env.development           # VITE_API_BASE_URL=http://localhost:8080
│  ├─ vite.config.ts
│  ├─ tsconfig.json
│  ├─ package.json
│  └─ README.md
│
├─ docs/
├─ build.gradle
└─ docker-compose.yml
```

### `features/` 내부 (모든 feature 동일 골격)

```
features/booking/
├─ api.ts                # 이 도메인의 요청 함수만
├─ hooks.ts              # useSeatHold, useReleaseHold, useConfirmBooking
├─ store.ts              # (필요한 feature만) 클라이언트 상태
├─ components/
│  ├─ SeatMap.tsx
│  ├─ HoldTimer.tsx
│  └─ SeatLegend.tsx
└─ types.ts
```

### 구조 규칙 (백엔드 도메인 경계 규칙의 프론트 대응)

`CLAUDE.md`의 "도메인 간 접근 규칙"과 같은 이유 — 경계를 명시해야 AI 생성 코드가 뒤엉키지 않습니다.

1. **`features/` 간 직접 import 금지.** `booking`이 `catalog/components/SeatGradeBadge`를 쓰고 싶으면 `components/`로 승격시킵니다.
2. **`api/client.ts`를 거치지 않는 `fetch` 호출 금지.** 토큰 주입·에러 정규화가 한 곳에만 있어야 합니다.
3. **`api/generated/`는 수정하지 않습니다.** B의 OpenAPI가 정본이고, 이 디렉터리는 생성물입니다.
4. 페이지 컴포넌트(`routes/pages/`)에는 **데이터 페칭 훅 호출과 조립만** 둡니다. 로직은 feature의 `hooks.ts`로.

---

## 2. 기술 선택

| 영역 | 선택 | 이유 |
|---|---|---|
| 빌드 | Vite | 포트 5173이 이미 CORS에 반영됨 |
| 라우팅 | React Router | SPA 표준. 파일 기반 라우팅 불필요(화면 10여 개) |
| **서버 상태** | **TanStack Query** | 대기실 폴링, 좌석 배치도 캐싱/무효화가 전부 이 라이브러리의 기본 기능. 직접 만들면 폴링·재시도·무효화를 다 손으로 짜야 함 |
| 클라이언트 상태 | Zustand (store 2개로 제한) | `authStore`(토큰), `holdStore`(선택 좌석·만료 시각). 전역 상태를 늘리지 않는 것이 목표 |
| 폼 | React Hook Form + Zod | 회원가입/로그인 검증. 서버 검증(`@Valid`)과 이중 방어 |
| API 타입 | **openapi-typescript** | 3절 참조 — 2인 병렬 개발에서 가장 값어치 있는 선택 |
| Mock | **MSW** | 4절 참조 |
| 스타일 | Tailwind CSS | AI 생성 친화적이고 별도 CSS 파일 관리가 없음 |

> 상태 관리 라이브러리를 **서버 상태와 클라이언트 상태로 나누는 것**이 핵심입니다. 대기 순번·좌석 상태·예매 내역은 전부 **서버 상태**이므로 Zustand에 넣지 마세요. 서버 상태를 전역 store에 복사하는 순간 동기화 버그가 시작됩니다.

---

## 3. API 레이어 — 계약을 컴파일 타임에 강제하기

이 프로젝트에서 프론트가 얻을 수 있는 가장 큰 이득은 **"B가 API를 바꾸면 A의 빌드가 깨지는 것"** 입니다. PRD 8절의 "계약 우선 개발"을 실제로 강제하는 장치입니다.

```
B: springdoc-openapi가 /v3/api-docs 노출
        ↓
A: npm run gen:api   (openapi-typescript)
        ↓
   src/api/generated/schema.d.ts   ← 커밋
        ↓
   features/*/api.ts 가 이 타입만 사용
        ↓
   B가 응답 필드를 바꾸면 → tsc 에러 → SP 전에 발견
```

| 규칙 | 내용 |
|---|---|
| 생성물 커밋 | `schema.d.ts`를 커밋합니다. 백엔드가 안 떠 있어도 프론트 빌드가 되어야 CI가 단순해집니다 |
| 갱신 시점 | 각 Sync Point(SP2·SP3·SP4) 직후, 그리고 B가 명세 변경 PR을 올릴 때 |
| 수동 타입 금지 | 응답 타입을 손으로 적지 마세요. 그 순간 계약이 두 벌이 됩니다 |

### `api/client.ts`가 흡수해야 하는 것

| 항목 | 처리 |
|---|---|
| `ApiResponse<T>` 언랩 | `{success, data, error}`에서 `data`만 반환, `success:false`면 throw |
| 토큰 주입 | `authStore`의 Access Token을 `Authorization: Bearer`로 |
| 401 | 토큰 만료 → 로그아웃 + 로그인 화면. **단 대기 중 401은 예외 처리 필요 (5절 ①)** |
| 409 등 도메인 에러 | 서버 `ErrorCode`를 `ApiError`로 감싸 throw → 화면은 `lib/errorMessages.ts`로 번역 (FR-F6) |
| 네트워크 실패 | 좌석 선점·확정 요청은 **자동 재시도 금지** (5절 ④) |

---

## 4. Mock 선행 전략 (SP2 전까지)

PRD 10.2에서 A는 3~4주차에 카탈로그 화면을 만드는데, B의 실 API는 SP2(4주차 말)에 나옵니다. 그 사이를 **MSW**로 메웁니다.

```
src/mocks/
├─ browser.ts        # main.tsx에서 DEV일 때만 start()
├─ handlers/
│  ├─ catalog.ts
│  ├─ waiting.ts
│  └─ booking.ts
└─ fixtures/         # 좌석 2000석 등 대용량 픽스처
```

**MSW를 고른 이유**: Mock을 `api.ts` 안에 `if (isMock)`으로 심으면 SP2에서 그 분기를 전부 찾아 지워야 합니다. MSW는 네트워크 계층에서 가로채므로 **애플리케이션 코드가 Mock을 전혀 모릅니다** — 전환이 "핸들러 등록을 끄는 것"으로 끝납니다.

> 픽스처는 **실제 시드 데이터(FR-B6)와 같은 모양**으로 만드세요. 2000석 픽스처로 미리 렌더링해 두면 5절 ③의 성능 문제를 3~4주차에 발견합니다.

---

## 5. 핵심 설계 이슈 — 백엔드 설계에서 파생되는 프론트 제약

**여기가 이 문서의 본론입니다.** 아래 7가지는 일반적인 SPA에는 없고 **이 프로젝트의 백엔드 설계 때문에 생기는** 요구사항입니다.

### ① 대기실 폴링은 heartbeat다 — 백그라운드 탭에서 끊긴다

PRD FR-W3/W4: 폴링 응답이 곧 heartbeat이고, 끊기면 **유령으로 간주되어 큐에서 제거**됩니다(순번 상실).

문제는 **브라우저가 백그라운드 탭의 타이머를 스로틀링**한다는 것입니다. 크롬은 비활성 탭의 `setInterval`을 최소 1분 간격까지 늦추고, 그 이상 방치되면 더 공격적으로 줄입니다. 사용자가 대기 중에 다른 탭을 보는 것은 **정상 행동**인데, 그때 순번을 잃습니다.

| 대응 | 내용 |
|---|---|
| 서버 | 유령 판정 TTL을 폴링 주기보다 **충분히 크게** (예: 폴링 5초 / TTL 60초 이상). **B와 합의 필요** |
| 프론트 | `document.visibilityState` 변화를 감지해 복귀 즉시 1회 즉시 폴링 |
| 프론트 | 탭 이탈 시 "이 탭을 열어두세요" 안내 명시 |
| 검증 | 탭을 5분 백그라운드로 두고 순번이 유지되는지 **수동 테스트 항목으로 고정** |

> ⚠️ 이 값은 프론트가 혼자 정할 수 없습니다. **폴링 주기와 유령 TTL의 비율은 B와 합의해 PRD 9.1에 기록**하세요.

### ② 카운트다운은 서버가 준 절대 시각으로 계산한다

FR-F5의 "선점 만료 타이머(7분)"를 클라이언트에서 `7 * 60`으로 시작하면 안 됩니다. 사용자 시계가 틀어져 있거나, 요청 왕복·렌더 지연만큼 실제 락 만료보다 **늦게** 0이 됩니다. 그러면 화면에는 시간이 남았는데 서버는 이미 락을 놓은 상태가 됩니다.

| 요구 | 내용 |
|---|---|
| **API 계약** | 선점 응답에 **만료 절대 시각**(`holdExpiresAt`, ISO-8601)을 포함할 것 — **B에게 요청 필요** |
| 계산 | `남은시간 = holdExpiresAt - now + serverClockOffset`. 오프셋은 응답의 `Date` 헤더로 1회 보정 |
| 표시 | 만료 60초 전 경고, 0초 도달 시 **자동으로 좌석 선택 화면으로 복귀**하고 배치도 무효화 |
| 안전 마진 | 타이머가 0이 되기 전에 확정 버튼을 비활성화 — PRD **INV-2**(락 잔여 ≥ 결제 제한시간)를 프론트에서도 반영 |

### ③ 좌석 배치도 2000석 렌더링

PRD FR-B4가 "최고 트래픽 API"라고 지목한 화면입니다. 프론트에서도 가장 무거운 화면입니다.

| 대응 | 내용 |
|---|---|
| 2단계 로딩 | 진입 시 `/seats/summary`(등급별 잔여)로 화면을 먼저 띄우고, 배치도는 이어서 로드 — PRD FR-B3/B4의 분리 의도를 프론트가 살려야 의미가 있음 |
| 렌더링 | 좌석 하나당 React 컴포넌트 2000개는 상태 변경 시 리렌더가 감당 안 됨. **단일 SVG 안에 `<rect>`로 그리고, 이벤트는 컨테이너에서 위임** |
| 재렌더 최소화 | 선택 좌석은 배열이 아니라 `Set`으로 관리, 좌석 색상은 CSS 클래스 토글로 |
| 캐싱 | 좌표(`pos_x`,`pos_y`)는 불변, 상태(`AVAILABLE`/`SOLD`)만 변함 → 좌표는 길게, 상태는 짧게 캐시 |

### ④ 좌석 선점·예매 확정은 자동 재시도하면 안 된다

TanStack Query의 기본 `retry: 3`이 mutation에 걸리면, 타임아웃된 선점 요청을 3번 더 보내 **좌석을 3번 잡으려 시도**합니다. 확정 요청이라면 PRD FR-K9(멱등성)가 없는 상태에서 자기 좌석에 409를 맞습니다.

| 요청 | 재시도 |
|---|---|
| 조회(GET) | 기본 재시도 허용 |
| **선점 / 해제 / 확정 / 취소** | **`retry: 0` 고정.** 재시도는 사용자가 버튼으로 |
| 확정 요청 | 클라이언트가 **멱등성 키(UUID)를 생성해 헤더로 전달** — FR-K9. 재시도 시 같은 키 사용. **B와 헤더 이름 합의 필요** |

### ⑤ Access Token 30분 vs 장시간 대기 (PRD FR-W10)

Access Token 30분, Refresh Token은 비목표, 대기 폴링은 인증 필요 — 이 셋이 겹치면 **대기 30분 초과 시 폴링이 401 → heartbeat 중단 → 순번 상실**입니다. 사용자는 아무것도 잘못하지 않았는데 밀려납니다.

프론트 단독으로는 못 풉니다. PRD U11(Refresh Token)·FR-W10의 결정에 따라 아래 중 하나:

| 결정 | 프론트 대응 |
|---|---|
| 대기 상한을 토큰 만료보다 짧게 | 남은 토큰 수명을 계산해 대기 진입 시점에 경고 |
| Refresh Token 도입 | `client.ts`에서 401 → refresh → 원요청 1회 재시도 (**단 ④의 mutation은 제외**) |
| 대기 중 재발급 엔드포인트 | 폴링과 함께 토큰 갱신 |

> **현재는 미결정이므로 대기 화면에서 401이 나면 "재로그인 후 순번을 다시 받아야 함"을 명확히 알리는 것이 최소 대응**입니다. 조용히 실패하지 않게 하세요.

### ⑥ 새로고침·뒤로가기에서 선점 상태 복구

좌석을 잡은 뒤 새로고침하면 프론트 메모리의 선택 좌석과 타이머가 사라지지만 **서버의 Redis 락은 살아 있습니다.** 아무 처리도 없으면 사용자는 자기가 잡은 좌석을 "이미 선택됨"으로 보게 됩니다.

| 대응 | 내용 |
|---|---|
| 저장 | `holdStore`를 `sessionStorage`에 영속화 (좌석 ID + `holdExpiresAt`) |
| 복구 | 진입 시 만료 시각이 미래면 타이머 재개, 과거면 즉시 폐기 |
| 표시 | 배치도에서 **내가 잡은 좌석**과 **남이 잡은 좌석**을 다른 색으로 |
| 이탈 | 좌석 선택 화면을 벗어날 때 `beforeunload`에서 선점 해제 시도(FR-K2). **단 보장되지 않으므로 서버 TTL이 정답** |

### ⑦ 에러 코드 번역 테이블 (FR-F6)

백엔드는 도메인별 `ErrorCode` enum으로 코드를 나눠 갖습니다(`CLAUDE.md`). 프론트는 **HTTP 상태가 아니라 `error.code`로 분기**해야 합니다 — 409 하나에 "이미 예매된 좌석"과 "이미 선택된 좌석"이 모두 올 수 있습니다.

```
src/lib/errorMessages.ts
  SEAT_ALREADY_BOOKED   → "이미 예매된 좌석입니다. 다른 좌석을 선택해 주세요."
  SEAT_ALREADY_HELD     → "다른 분이 선택 중인 좌석입니다."
  HOLD_EXPIRED          → "선택 시간이 만료되었습니다. 좌석을 다시 선택해 주세요."
  ENTRY_TOKEN_INVALID   → "대기 시간이 만료되었습니다. 대기실에 다시 입장해 주세요."
  (미등록 코드)          → 서버 message를 그대로 노출 + 콘솔 경고
```

> **미등록 코드에 대한 fallback을 반드시 두세요.** B가 새 에러 코드를 추가했는데 프론트가 모르면, 사용자에게 빈 문자열이나 "알 수 없는 오류"가 뜹니다.

---

## 6. 라우트 설계

| 경로 | 화면 | FR | 인증 | 비고 |
|---|---|---|---|---|
| `/login`, `/signup` | 로그인·회원가입 | FR-F1 | ❌ | |
| `/` | 공연 목록 | FR-F2 | ❌ (U4) | |
| `/performances/:id` | 공연 상세 + 회차 선택 | FR-F2 | ❌ (U4) | 회차별 `booking_open_at` 표시 |
| `/sessions/:id/waiting` | 대기 순번 | FR-F4 | ✅ | 폴링 = heartbeat (5절 ①) |
| `/sessions/:id/seats` | 좌석 배치도 + 선점 | FR-F3, F5 | ✅ | 입장 토큰 필요. 타이머 상주 |
| `/bookings/confirm` | 결제·확정 | FR-F5 | ✅ | **U5 결정에 종속** — 아래 주석 |
| `/bookings/:id/complete` | 완료 | FR-F5 | ✅ | |
| `/mypage/bookings` | 예매 내역 | FR-F7 | ✅ | |
| `/mypage/notifications` | 알림 | FR-F7 | ✅ | 9~10주차(버퍼 구간) |
| `/mypage/edit` | 회원정보 수정 (프로필·비밀번호) | FR-F8 | ✅ | FR-A6/A7 연동. `PATCH /api/users/me`·`.../password` |
| `/admin/performances` | 관리자 공연/회차/좌석 관리 | FR-F9 | ✅ **ADMIN** | FR-M1~M3 연동. **P2 — 밀리면 우선 포기** |

> 🔴 **`/bookings/confirm` 화면의 존재 자체가 PRD U5에 종속됩니다.** 확정이 **단일 요청**이면 이 화면은 "확인 후 버튼 1회" 수준이고 결제 입력 단계가 없습니다. **2단계 확정**이면 결제 정보 입력 화면이 실재하고 그 체류 시간 동안 ②의 타이머가 핵심 UX가 됩니다. **U5가 정해지기 전에는 이 화면을 만들지 마세요** — 7~8주차 작업이므로 시간은 있습니다.

### 라우트 가드

| 가드 | 대상 | 실패 시 |
|---|---|---|
| 인증 | 위 표의 ✅ 경로 | `/login`으로, 복귀 경로 보존 |
| **ADMIN role** | `/admin/**` | 403 안내 화면 또는 `/`로. **화면 숨김에 의존하지 말 것 — 서버가 `hasRole('ADMIN')`로 최종 차단**(PRD 9.1.1) |
| 입장 토큰 | `/sessions/:id/seats` | `/sessions/:id/waiting`으로 되돌림 |
| 선점 유효 | `/bookings/confirm` | 좌석 선택 화면으로 되돌림 |

---

## 7. 백엔드/빌드 통합

### CI

`.github/workflows/ci.yml`에 **프론트 빌드 잡을 추가**합니다. 백엔드 잡과 분리하고 `paths` 필터를 걸어, 프론트만 바뀌었을 때 Postgres/Redis를 띄우지 않도록 합니다.

```yaml
# 개념만 — 실제 작성은 3~4주차 A 담당
jobs:
  backend:   # 기존. paths: ['src/**', 'build.gradle', ...]
  frontend:  # 신설. paths: ['frontend/**']
             # npm ci → tsc --noEmit → npm run build
```

> `tsc --noEmit`을 CI에 넣는 것이 3절(타입 생성)의 실효성을 만듭니다. B가 응답 스펙을 바꾼 PR에서 **프론트 잡이 빨간불**이 되어야 계약 위반이 드러납니다.

### 배포 (12주차, U9 미결정)

| 방식 | 비고 |
|---|---|
| 정적 호스팅 분리 | 프론트를 별도 정적 호스팅, API는 CORS로 접근. **현재 구조와 가장 잘 맞음** |
| Spring 정적 리소스로 번들 | `build/resources/main/static`에 넣어 단일 배포. CORS 불필요해지지만 Gradle 빌드에 npm 단계를 엮어야 함 |

**권장은 분리**입니다. 데모 배포 목적이라 단일 아티팩트의 이점이 크지 않고, Gradle-npm 연동은 학습 가치 대비 설정 비용이 큽니다.

---

## 8. 주차별 산출물 (PRD 10.2 · study/01과 정합)

| 주차 | 프론트 산출물 | 의존 |
|---|---|---|
| 1~2 | *(없음 — A는 `global`/인증 백엔드)* | |
| 3~4 | `frontend/` 셋업, 라우터·`client.ts`·MSW 골격, 인증 화면(실 API), 카탈로그 화면(Mock) | SP2에서 실 API 전환 |
| 5~6 | 대기 순번 화면 (폴링·visibility 처리) | B의 대기실 API (SP3) |
| 7~8 | 좌석 배치도, 선점 타이머, 예매 플로우 | B의 선점·확정 API (SP4), **U5 확정 필요** |
| 9~10 | 마이페이지, **회원정보 수정(FR-F8)**, 알림, UX 정리 / **관리자 화면(FR-F9, P2)** | 버퍼 구간 — 압축 가능. **F9는 부하 테스트(11주차)와 상충 시 우선 포기** |
| 11~12 | 데모 시나리오, 부하 테스트용 계정 생성 스크립트 | |

---

## 9. B에게 요청해야 하는 API 계약 (미합의)

이 설계가 성립하려면 아래가 응답에 있어야 합니다. **SP2(4주차 말) 명세 확정 때 함께 합의하세요.**

| # | 요청 | 이유 |
|---|---|---|
| C1 | 선점 응답에 **만료 절대 시각**(`holdExpiresAt`) | 5절 ② — 클라 시계로 타이머를 만들 수 없음 |
| C2 | 대기 상태 응답에 **예상 대기 시간** 또는 처리율 | 순번만으로는 "얼마나 기다리나"를 못 보여줌 |
| C3 | 좌석 배치도 응답에 **내가 잡은 좌석** 표식 | 5절 ⑥ — 새로고침 후 자기 좌석 구분 |
| C4 | 확정 요청의 **멱등성 키 헤더 이름** | 5절 ④ / PRD FR-K9 |
| C5 | 폴링 주기와 **유령 판정 TTL의 비율** | 5절 ① — 백그라운드 탭에서 순번 상실 방지 |
| C6 | `ErrorCode` 문자열 목록 | 5절 ⑦ 번역 테이블. 코드가 추가되면 알려줄 것 |
| C7 | 관리자 CRUD(`/api/admin/**`, FR-M1~M3) 요청/응답 스키마 | FR-F9 화면 연동. **P2이므로 SP2가 아니라 관리자 화면 착수(9~10주차) 직전 합의**로 충분 |

---

## 10. 미결정 사항

| # | 항목 | 시한 |
|---|---|---|
| F1 | 토큰 저장 위치 — 메모리 전용 vs `localStorage` (XSS 노출 vs 새로고침 유지) | 3주차 |
| F2 | 디자인 시스템 도입 여부 (shadcn/ui 등) vs Tailwind 직접 | 3주차 |
| F3 | 프론트 테스트 범위 — 좌석 선택 로직 단위 테스트만 vs E2E(Playwright) | 5주차 |
| F4 | 배포 방식 (7절) | 11주차, PRD U9와 함께 |
| F5 | `/bookings/confirm` 화면 구성 | **PRD U5 확정 후** |

---

## 부록: 관련 문서

| 문서 | 내용 |
|---|---|
| [`docs/PRD.md`](PRD.md) | 화면 요구사항(5.7), 에러·TTL·API 계약의 근거 |
| [`docs/study/01-developer-a-workflow.md`](study/01-developer-a-workflow.md) | A의 주차별 진행 순서, CORS·SecurityConfig |
| [`CLAUDE.md`](../CLAUDE.md) | API 경로 소유권, 도메인 경계 규칙 |
