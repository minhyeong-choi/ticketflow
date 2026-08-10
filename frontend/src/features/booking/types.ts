// SP2 이전 로컬 타입. 실 API 연동 시 B의 OpenAPI 생성 타입(api/generated)으로 교체된다.
// docs/study/02-developer-b-workflow.md 7~8주차 절 기준 — 경로가 문서에 명시되어 있지 않아 기존
// GET/DELETE /api/bookings, /api/bookings/{id} 정의와 일치시켜 REST 관례로 추정했다.

export interface HoldSeatsRequest {
  sessionId: number
  sessionSeatIds: number[]
  entryToken: string
}

// holdExpiresAt은 서버 절대 시각(ISO-8601)이어야 한다 — 클라이언트에서 TTL을 직접 카운트하지 않는다
// (FRONTEND.md 5절②, 9절 C1).
export interface HoldSeatsResponse {
  sessionSeatIds: number[]
  holdExpiresAt: string
}

export interface ReleaseSeatsRequest {
  sessionSeatIds: number[]
}

// 단일 요청 확정(PRD U5) — hold 유효성 검증 + Mock 결제 + 확정이 서버에서 한 번에 처리된다.
// 그래서 /bookings/confirm 같은 중간 화면/응답 타입이 없다.
export interface ConfirmBookingRequest {
  sessionId: number
  sessionSeatIds: number[]
  entryToken: string
}

export interface ConfirmBookingResponse {
  id: number
  bookingNumber: string
  status: 'CONFIRMED'
  totalAmount: number
  sessionId: number
  sessionSeatIds: number[]
}

// holdStore(zustand)가 sessionStorage에 영속화하는 스냅샷(FRONTEND.md 5절⑥).
// clockOffsetMs는 hold 응답의 Date 헤더로 1회 보정한 값이고, idempotencyKey는 확정 요청을
// 재시도(사용자가 버튼을 다시 누르는 경우)해도 동일하게 재사용한다(FRONTEND.md 5절④).
export interface HoldSnapshot {
  sessionId: number
  sessionSeatIds: number[]
  holdExpiresAt: string
  clockOffsetMs: number
  idempotencyKey: string
}
