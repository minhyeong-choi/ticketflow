import { delay, http, HttpResponse } from 'msw'
import type { ApiResponse } from '@/api/types'
import type {
  ConfirmBookingRequest,
  ConfirmBookingResponse,
  HoldSeatsRequest,
  HoldSeatsResponse,
  ReleaseSeatsRequest,
} from '@/features/booking/types'
import type { BookingDetail, BookingSeatDetail, BookingSummary } from '@/features/mypage/types'
import { dummyPerformanceDetails } from '../fixtures/performances'
import { buildSeatMap, GRADE_PRICE, KNOWN_SESSION_IDS } from '../fixtures/seatMap'

const BASE_URL = import.meta.env.VITE_API_BASE_URL

// docs/study/02-developer-b-workflow.md 7~8주차 절 기준(경로는 문서에 명시 안 돼 REST 관례로 추정,
// features/booking/types.ts 참고). CLAUDE.md의 seat:lock TTL(5~10분) 범위 안에서 프론트 계약은 7분.
const HOLD_TTL_MS = 7 * 60 * 1000

interface HoldRecord {
  sessionId: number
  expiresAt: number
}

// sessionSeatId -> 현재 선점 기록. 실 서버의 Redis 락(seat:lock:{session_seat_id})을 인메모리로
// 흉내낸다. 같은 좌석을 다른 탭에서 먼저 선점해두면 이 맵에 남아있어 SEAT_ALREADY_HELD를
// 수동으로 재현할 수 있다(탭 A에서 선점 → 탭 B에서 같은 좌석 선점 시도).
const heldSeats = new Map<number, HoldRecord>()
// confirm 성공으로 판매완료 처리된 좌석 — seatMap fixture가 정하는 SOLD와 별개로 이 mock 런타임 동안 누적된다.
const soldSeats = new Set<number>()

let bookingSequence = 1

function purgeExpiredHolds(now: number) {
  for (const [seatId, record] of heldSeats) {
    if (record.expiresAt <= now) heldSeats.delete(seatId)
  }
}

function isSold(sessionId: number, seatId: number): boolean {
  if (soldSeats.has(seatId)) return true
  return buildSeatMap(sessionId).some((seat) => seat.id === seatId && seat.status === 'SOLD')
}

function priceOf(sessionId: number, seatId: number): number {
  const seat = buildSeatMap(sessionId).find((s) => s.id === seatId)
  return seat ? (GRADE_PRICE[seat.gradeName] ?? 0) : 0
}

// STEP5(마이페이지) 예매내역 목록/상세가 읽는 저장소. 실 백엔드의 booking/booking_seat 분리(CLAUDE.md)를
// 인메모리로 흉내낸다 — 예매 확정(POST /api/bookings) 성공 시 여기 쌓이므로 STEP4에서 완료한 예매가
// STEP5 목록에 그대로 나타난다. notification mock 핸들러도 이 배열을 그대로 읽어 알림을 파생시킨다.
export const bookingStore: BookingDetail[] = []

function findPerformanceContext(sessionId: number) {
  for (const detail of Object.values(dummyPerformanceDetails)) {
    const session = detail.sessions.find((s) => s.id === sessionId)
    if (session) {
      return { performanceTitle: detail.title, venueName: detail.venueName, sessionAt: session.sessionAt }
    }
  }
  // fixture에 없는 sessionId(이론상 KNOWN_SESSION_IDS 검증을 통과한 뒤라 발생하지 않는다)에 대한 방어적 폴백.
  return { performanceTitle: '알 수 없는 공연', venueName: '', sessionAt: new Date().toISOString() }
}

function seatDetailsFor(sessionId: number, seatIds: number[]): BookingSeatDetail[] {
  const seatMap = buildSeatMap(sessionId)
  return seatIds.map((seatId) => {
    const seat = seatMap.find((s) => s.id === seatId)
    const gradeName = seat?.gradeName ?? ''
    return {
      grade: gradeName,
      section: seat?.section ?? '',
      row: seat?.rowLabel ?? '',
      seatNumber: seat?.seatNumber ?? 0,
      price: GRADE_PRICE[gradeName] ?? 0,
    }
  })
}

function recordBooking(
  id: number,
  bookingNumber: string,
  sessionId: number,
  seatIds: number[],
  bookedAtIso: string,
): BookingDetail {
  const context = findPerformanceContext(sessionId)
  const seats = seatDetailsFor(sessionId, seatIds)
  const totalAmount = seats.reduce((sum, seat) => sum + seat.price, 0)

  const record: BookingDetail = {
    id,
    bookingNumber,
    status: 'CONFIRMED',
    performanceTitle: context.performanceTitle,
    sessionAt: context.sessionAt,
    venueName: context.venueName,
    seatCount: seats.length,
    totalAmount,
    bookedAt: bookedAtIso,
    seats,
  }
  bookingStore.push(record)
  return record
}

// 데모 편의용 — 앱 첫 로드 시점에도 마이페이지 예매내역/알림함이 비어있지 않도록, 이미 SOLD로
// 고정된 fixture 좌석(buildSeatMap의 결정론적 SOLD_RATIO) 몇 개를 골라 과거 예매를 미리 채운다.
// 필수 요건은 아니다 — STEP4에서 실제로 예매를 완료하면 그 예매도 뒤이어 그대로 쌓인다.
function seedDummyBookings() {
  const seeds: Array<{ sessionId: number; seatCount: number; bookedAt: string }> = [
    { sessionId: 101, seatCount: 2, bookedAt: '2026-07-20T10:00:00+09:00' },
    { sessionId: 201, seatCount: 1, bookedAt: '2026-06-16T09:30:00+09:00' },
  ]

  for (const seed of seeds) {
    const soldSeatIds = buildSeatMap(seed.sessionId)
      .filter((seat) => seat.status === 'SOLD')
      .slice(0, seed.seatCount)
      .map((seat) => seat.id)
    if (soldSeatIds.length === 0) continue

    const id = bookingSequence++
    recordBooking(id, `TFSEED${id}`, seed.sessionId, soldSeatIds, seed.bookedAt)
  }
}

seedDummyBookings()

// 제네릭으로 둔다 — 성공 응답과 실패 응답이 같은 핸들러 안에서 서로 다른 타입 인자로 http.post<...>()에
// 추론되면 MSW의 ResponseResolver 타입이 두 리터럴 타입의 합집합을 못 받아들여 tsc -b가 실패한다
// (call site에서 항상 그 핸들러의 성공 응답 타입과 동일한 T를 명시해서 호출해야 한다).
function errorResponse<T>(errorCode: string, message: string, status: number) {
  return HttpResponse.json<ApiResponse<T>>({ success: false, data: null, errorCode, message }, { status })
}

function sessionNotFound<T>() {
  return errorResponse<T>('SESSION_001', '존재하지 않는 회차입니다.', 404)
}

export const bookingHandlers = [
  // 좌석 선점 — CLAUDE.md 예매 확정 흐름의 "Redis 분산 락 획득" 단계를 인메모리로 흉내낸다.
  http.post(`${BASE_URL}/api/bookings/seats/hold`, async ({ request }) => {
    const body = (await request.json()) as HoldSeatsRequest
    const { sessionId, sessionSeatIds } = body

    if (!KNOWN_SESSION_IDS.has(sessionId)) return sessionNotFound<HoldSeatsResponse>()

    await delay(200)
    const now = Date.now()
    purgeExpiredHolds(now)

    for (const seatId of sessionSeatIds) {
      if (isSold(sessionId, seatId)) {
        return errorResponse<HoldSeatsResponse>(
          'SEAT_ALREADY_BOOKED',
          '이미 예매된 좌석입니다. 다른 좌석을 선택해 주세요.',
          409,
        )
      }
      if (heldSeats.has(seatId)) {
        return errorResponse<HoldSeatsResponse>('SEAT_ALREADY_HELD', '다른 분이 선택 중인 좌석입니다.', 409)
      }
    }

    const expiresAt = now + HOLD_TTL_MS
    for (const seatId of sessionSeatIds) {
      heldSeats.set(seatId, { sessionId, expiresAt })
    }

    // FRONTEND.md 5절②: 프론트가 이 응답의 Date 헤더로 clock offset을 보정한다. 실 서버는 HTTP
    // 표준상 이 헤더를 자동으로 붙이지만, MSW로 만든 Response는 직접 설정해야 한다.
    return HttpResponse.json<ApiResponse<HoldSeatsResponse>>(
      {
        success: true,
        data: { sessionSeatIds, holdExpiresAt: new Date(expiresAt).toISOString() },
        errorCode: null,
        message: null,
      },
      { headers: { Date: new Date(now).toUTCString() } },
    )
  }),

  // 선점 해제 — 사용자가 좌석 선택을 취소했을 때.
  http.delete(`${BASE_URL}/api/bookings/seats/hold`, async ({ request }) => {
    const body = (await request.json()) as ReleaseSeatsRequest
    for (const seatId of body.sessionSeatIds) heldSeats.delete(seatId)

    return HttpResponse.json<ApiResponse<null>>({ success: true, data: null, errorCode: null, message: null })
  }),

  // 예매 확정 — PRD U5(단일 요청 확정)에 따라 hold 유효성 검증 + Mock 결제 + 확정을 한 번에 처리한다.
  http.post(`${BASE_URL}/api/bookings`, async ({ request }) => {
    const body = (await request.json()) as ConfirmBookingRequest
    const { sessionId, sessionSeatIds } = body

    if (!KNOWN_SESSION_IDS.has(sessionId)) return sessionNotFound<ConfirmBookingResponse>()

    await delay(400)
    const now = Date.now()
    purgeExpiredHolds(now)

    for (const seatId of sessionSeatIds) {
      if (isSold(sessionId, seatId)) {
        return errorResponse<ConfirmBookingResponse>(
          'SEAT_ALREADY_BOOKED',
          '이미 예매된 좌석입니다. 다른 좌석을 선택해 주세요.',
          409,
        )
      }
      const record = heldSeats.get(seatId)
      if (!record || record.sessionId !== sessionId) {
        return errorResponse<ConfirmBookingResponse>(
          'SEAT_HOLD_EXPIRED',
          '선택 시간이 만료되었습니다. 좌석을 다시 선택해 주세요.',
          409,
        )
      }
    }

    // Mock 결제 실패를 20% 확률로 재현한다 — 이 시점엔 아직 hold가 살아있으므로 실패해도 선점 상태를
    // 유지한 채 사용자가 재시도할 수 있다(CLAUDE.md 예매 확정 흐름 4단계: 결제 실패 시 T1만 되돌림).
    if (Math.random() < 0.2) {
      return errorResponse<ConfirmBookingResponse>('PAYMENT_FAILED', '결제 처리에 실패했습니다. 다시 시도해 주세요.', 422)
    }

    const totalAmount = sessionSeatIds.reduce((sum, seatId) => sum + priceOf(sessionId, seatId), 0)
    for (const seatId of sessionSeatIds) {
      heldSeats.delete(seatId)
      soldSeats.add(seatId)
    }

    const id = bookingSequence++
    const bookingNumber = `TF${now.toString(36).toUpperCase()}`

    const booking: ConfirmBookingResponse = {
      id,
      bookingNumber,
      status: 'CONFIRMED',
      totalAmount,
      sessionId,
      sessionSeatIds,
    }
    // 마이페이지 예매내역(STEP5)이 그대로 읽을 수 있게 같은 저장소에 쌓는다.
    recordBooking(id, bookingNumber, sessionId, sessionSeatIds, new Date(now).toISOString())

    return HttpResponse.json<ApiResponse<ConfirmBookingResponse>>({
      success: true,
      data: booking,
      errorCode: null,
      message: null,
    })
  }),

  // 예매 내역 목록 — 최신순(bookedAt desc)으로 정렬해 반환한다.
  http.get(`${BASE_URL}/api/bookings`, async () => {
    await delay(150)
    const data: BookingSummary[] = [...bookingStore]
      .sort((a, b) => new Date(b.bookedAt).getTime() - new Date(a.bookedAt).getTime())
      .map(({ seats: _seats, ...summary }) => summary)

    return HttpResponse.json<ApiResponse<BookingSummary[]>>({
      success: true,
      data,
      errorCode: null,
      message: null,
    })
  }),

  // 예매 상세 — 좌석별 정보 포함.
  http.get(`${BASE_URL}/api/bookings/:id`, async ({ params }) => {
    const id = Number(params.id)
    const record = bookingStore.find((b) => b.id === id)

    if (!record) {
      return errorResponse<BookingDetail>('BOOKING_001', '존재하지 않는 예매입니다.', 404)
    }

    await delay(150)
    return HttpResponse.json<ApiResponse<BookingDetail>>({
      success: true,
      data: record,
      errorCode: null,
      message: null,
    })
  }),
]
