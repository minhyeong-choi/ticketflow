# ticketFlow Frontend

React 19 + TypeScript + Vite SPA. 구조·기술 선택·설계 제약의 정본은 저장소 루트의 `docs/FRONTEND.md`이며, 이 문서는 그 요약이자 실행 가이드다.

## 실행

반드시 `frontend/` 안에서 실행한다(루트에 `package.json` 없음).

```bash
npm install
npm run dev       # http://localhost:5173 (포트 고정 — 백엔드 CORS와 묶여 있어 임의 변경 금지)
npm run build     # tsc -b && vite build
npm run lint       # oxlint
```

`.env.development`에 `VITE_API_BASE_URL=http://localhost:8080`이 설정되어 있다(백엔드 로컬 포트). 새 환경변수 추가 시 `.env.example`도 같이 갱신한다.

## 개발 규칙 (반드시 준수)

1. **`features/` 간 직접 import 금지.** 다른 feature의 컴포넌트가 필요하면 `src/components/`로 승격시킨다. 공용 로직은 `src/hooks/` 또는 `src/lib/`로.
2. **`fetch`는 반드시 `src/api/client.ts`를 거친다.** 토큰 주입(`Authorization: Bearer`), `ApiResponse<T>` 언랩, 에러 정규화(`ApiError`)가 이 한 곳에만 있어야 한다. feature의 `api.ts`는 `apiClient`만 호출하고 직접 `fetch`를 쓰지 않는다.
3. **`src/api/generated/`는 손으로 고치지 않는다.** `npm run gen:api`(springdoc-openapi `/v3/api-docs` → `openapi-typescript`)로만 생성한다. **현재 예외**: 백엔드에 springdoc이 아직 없어 `src/features/auth/types.ts`는 임시로 손으로 작성한 타입이다 — springdoc 도입 후 `generated/`로 교체 예정(파일 상단 주석 참고).
4. **페이지 컴포넌트(`src/routes/pages/`)는 훅 호출 + 조립만 한다.** 데이터 페칭/비즈니스 로직은 해당 feature의 `hooks.ts`에 둔다.
5. **서버 상태는 TanStack Query, 클라이언트 전역 상태는 Zustand 2개로 제한한다** (`features/auth/store.ts`의 `authStore`, 추후 예매 화면에서 추가될 `holdStore`). 서버 상태를 Zustand로 복사하지 않는다.
6. **좌석 선점/해제/확정/취소류 mutation은 자동 재시도 금지(`retry: 0`)**를 각 훅에서 명시적으로 적는다. 전역 기본값에 암묵적으로 의존하지 않는다.
7. **에러는 HTTP 상태가 아니라 `error.code`(`ApiError.code`)로 분기한다.** 사용자 메시지 번역은 `src/lib/errorMessages.ts`에 등록하고, 등록되지 않은 코드는 서버 `message`를 그대로 노출 + `console.warn`(무음 실패 금지).

## Mock (MSW)

- `src/mocks/`가 카탈로그(`GET /api/performances`) 등 아직 백엔드에 컨트롤러가 없는 API를 가로챈다.
- `onUnhandledRequest: 'bypass'`로 설정되어 있어, MSW가 처리하지 않는 요청(`/api/auth/**` 등)은 그대로 실 백엔드로 흘러간다. 그래서 인증은 실 서버, 카탈로그는 Mock이 동시에 성립한다.
- `import.meta.env.DEV`일 때만 켜진다(`src/main.tsx`). 프로덕션 빌드에는 포함되지 않는다.
- 새 Mock 핸들러 추가 시 `src/mocks/handlers/{도메인}.ts`를 만들고 `src/mocks/handlers/index.ts`에 등록한다.
- 코드 안에 `if (isMock)` 같은 분기를 두지 않는다 — Mock/실 서버 전환은 항상 MSW 핸들러 유무로만 결정한다.

## API 타입 생성 (`gen:api`)

```bash
npm run gen:api
```

백엔드에 `springdoc-openapi`가 설치되어 `/v3/api-docs`가 노출된 뒤에만 동작한다(현재는 미설치 — 아래 "백엔드에 요청한 사항" 참고). 성공하면 `src/api/generated/schema.d.ts`가 생성된다. 이 디렉터리는 생성물이므로 직접 수정하지 않는다.

## 인증 플로우

- 토큰 저장 위치: `localStorage` (`zustand/persist`, key `tf-auth`, `src/features/auth/store.ts`).
- 401 응답을 받으면 `api/client.ts`가 즉시 `authStore.logout()`을 호출해 토큰을 비운다(라우팅은 관여하지 않음).
- 인증이 필요한 라우트는 `src/routes/ProtectedRoute.tsx`로 감싼다. 토큰이 없으면 원래 가려던 경로를 `state.from`에 담아 `/login`으로 리다이렉트한다. `role="ADMIN"` 지정 시 권한 불일치면 `/`로 보낸다.

## 이번 스캐폴딩에서 만들지 않은 것 (의도적 보류)

- `/bookings/confirm` 화면: PRD U5(예매 확정 단일/2단계 여부) 미결정.
- `holdStore`, 좌석 배치도 SVG 렌더링: `booking`/`performance` API 자체가 아직 없음.
- Vitest 등 테스트 러너 도입: FRONTEND.md F3 미결정 항목.
- CI 워크플로(`.github/workflows`) 추가.

각 항목은 API/설계가 확정되는 대로 별도 작업으로 진행한다.
