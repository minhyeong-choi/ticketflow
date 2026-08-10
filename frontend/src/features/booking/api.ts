import { apiClient } from '@/api/client'
import type {
  ConfirmBookingRequest,
  ConfirmBookingResponse,
  HoldSeatsRequest,
  HoldSeatsResponse,
  ReleaseSeatsRequest,
} from './types'

// 좌석 선점/해제/확정 API 경로 소유자는 B(CLAUDE.md API 경로 소유권 표: /api/bookings/**).
export const bookingApi = {
  // Date 헤더로 clock offset을 보정해야 해서(FRONTEND.md 5절②) raw Response까지 반환하는
  // postWithHeaders를 쓴다 — 다른 요청은 전부 data만 반환하는 일반 post/get을 그대로 쓴다.
  hold: (body: HoldSeatsRequest) => apiClient.postWithHeaders<HoldSeatsResponse>('/api/bookings/seats/hold', body),
  release: (body: ReleaseSeatsRequest) =>
    apiClient.delete<null>('/api/bookings/seats/hold', { body: JSON.stringify(body) }),
  // 'Idempotency-Key' 헤더 이름은 B와 미합의 상태의 잠정값이다(FRONTEND.md 5절④/9절 C4) — 합의되면 교체.
  confirm: (body: ConfirmBookingRequest, idempotencyKey: string) =>
    apiClient.post<ConfirmBookingResponse>('/api/bookings', body, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
}
