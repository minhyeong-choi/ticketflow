import { delay, http, HttpResponse } from 'msw'
import type { ApiResponse } from '@/api/types'
import type {
  PerformanceDetail,
  PerformanceSummary,
  SeatGradeSummary,
  SeatMapSeat,
} from '@/features/catalog/types'
import { dummyPerformanceDetails, dummyPerformances } from '../fixtures/performances'
import { buildSeatMap, buildSeatSummary, KNOWN_SESSION_IDS } from '../fixtures/seatMap'

const BASE_URL = import.meta.env.VITE_API_BASE_URL

export const catalogHandlers = [
  http.get(`${BASE_URL}/api/performances`, () => {
    return HttpResponse.json<ApiResponse<PerformanceSummary[]>>({
      success: true,
      data: dummyPerformances,
      errorCode: null,
      message: null,
    })
  }),

  http.get(`${BASE_URL}/api/performances/:id`, ({ params }) => {
    const id = Number(params.id)
    const detail = dummyPerformanceDetails[id]

    if (!detail) {
      // 성공 응답과 같은 타입 인자(ApiResponse<PerformanceDetail>)를 명시해야 한다 — 실패 응답을
      // ApiResponse<null>로 따로 타이핑하면 이 핸들러의 반환 타입이 합집합이 되어 tsc -b에서
      // http.get<...>()의 ResponseBodyType 추론이 깨진다(data: T | null이라 null 대입 자체는 안전).
      return HttpResponse.json<ApiResponse<PerformanceDetail>>(
        {
          success: false,
          data: null,
          errorCode: 'PERFORMANCE_001',
          message: '존재하지 않는 공연입니다.',
        },
        { status: 404 },
      )
    }

    return HttpResponse.json<ApiResponse<PerformanceDetail>>({
      success: true,
      data: detail,
      errorCode: null,
      message: null,
    })
  }),

  // FRONTEND.md 5절③ 2단계 로딩: summary는 배치도보다 먼저/가볍게 응답하도록 지연을 짧게 둔다.
  http.get(`${BASE_URL}/api/sessions/:id/seats/summary`, async ({ params }) => {
    const sessionId = Number(params.id)
    if (!KNOWN_SESSION_IDS.has(sessionId)) {
      // 아래 성공 응답(ApiResponse<SeatGradeSummary[]>)과 타입 인자를 맞춘다 — 이유는 위 상세 조회
      // 핸들러의 주석 참고.
      return HttpResponse.json<ApiResponse<SeatGradeSummary[]>>(
        {
          success: false,
          data: null,
          errorCode: 'SESSION_001',
          message: '존재하지 않는 회차입니다.',
        },
        { status: 404 },
      )
    }

    await delay(150)
    return HttpResponse.json<ApiResponse<SeatGradeSummary[]>>({
      success: true,
      data: buildSeatSummary(buildSeatMap(sessionId)),
      errorCode: null,
      message: null,
    })
  }),

  http.get(`${BASE_URL}/api/sessions/:id/seats`, async ({ params }) => {
    const sessionId = Number(params.id)
    if (!KNOWN_SESSION_IDS.has(sessionId)) {
      return HttpResponse.json<ApiResponse<SeatMapSeat[]>>(
        {
          success: false,
          data: null,
          errorCode: 'SESSION_001',
          message: '존재하지 않는 회차입니다.',
        },
        { status: 404 },
      )
    }

    await delay(600) // 1200석 배치도는 summary보다 무거우니 로딩 순서가 눈에 보이도록 지연을 더 둔다.
    return HttpResponse.json<ApiResponse<SeatMapSeat[]>>({
      success: true,
      data: buildSeatMap(sessionId),
      errorCode: null,
      message: null,
    })
  }),
]
