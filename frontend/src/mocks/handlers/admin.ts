import { delay, http, HttpResponse } from 'msw'
import type { ApiResponse } from '@/api/types'
import type {
  AdminPerformance,
  PerformanceCreateRequest,
  PerformanceUpdateRequest,
  VenueOption,
} from '@/features/admin/types'
import { dummyPerformanceDetails, dummyPerformances } from '../fixtures/performances'

const BASE_URL = import.meta.env.VITE_API_BASE_URL

// venue 자체 CRUD는 범위 밖(STEP6에서 조회만 필요)이라 별도 fixture를 새로 만들지 않고, 기존 공연
// 더미의 venueName 등장 순서로 admin 전용 id를 부여해 재사용한다.
const venueIdByName = new Map<string, number>()
for (const performance of dummyPerformances) {
  if (!venueIdByName.has(performance.venueName)) {
    venueIdByName.set(performance.venueName, venueIdByName.size + 1)
  }
}

const adminVenues: VenueOption[] = Array.from(venueIdByName, ([name, id]) => ({ id, name }))

// 목록 fixture(dummyPerformances)엔 없고 상세 fixture(id 1~3)에만 있는 필드(description 등)는
// 상세가 없는 나머지 공연에 관례값을 채워 넣는다 — 관리자 CRUD 시작 시점의 빈 화면 방지 목적일 뿐,
// 이후 CRUD는 이 mock 저장소에서 카탈로그 mock과 독립적으로 관리된다(STEP4와 동일한 한계 인정).
function toAdminPerformance(summary: (typeof dummyPerformances)[number]): AdminPerformance {
  const detail = dummyPerformanceDetails[summary.id]
  return {
    id: summary.id,
    title: summary.title,
    description: detail?.description ?? '',
    posterImageUrl: summary.posterImageUrl,
    genre: summary.genre,
    status: summary.status,
    runningTimeMinutes: detail?.runningTimeMinutes ?? 120,
    venueId: venueIdByName.get(summary.venueName) ?? 0,
    venueName: summary.venueName,
    seatGrades: detail?.seatGrades ?? [{ name: 'R', price: summary.minPrice }],
  }
}

let performanceStore: AdminPerformance[] = dummyPerformances.map(toAdminPerformance)
let nextId = Math.max(...performanceStore.map((p) => p.id)) + 1

function errorResponse<T>(errorCode: string, message: string, status: number) {
  return HttpResponse.json<ApiResponse<T>>({ success: false, data: null, errorCode, message }, { status })
}

export const adminHandlers = [
  http.get(`${BASE_URL}/api/admin/performances`, async () => {
    await delay(150)
    return HttpResponse.json<ApiResponse<AdminPerformance[]>>({
      success: true,
      data: performanceStore,
      errorCode: null,
      message: null,
    })
  }),

  http.get(`${BASE_URL}/api/admin/venues`, async () => {
    await delay(100)
    return HttpResponse.json<ApiResponse<VenueOption[]>>({
      success: true,
      data: adminVenues,
      errorCode: null,
      message: null,
    })
  }),

  http.post(`${BASE_URL}/api/admin/performances`, async ({ request }) => {
    const body = (await request.json()) as PerformanceCreateRequest
    await delay(300)

    const venue = adminVenues.find((v) => v.id === body.venueId)
    if (!venue) {
      return errorResponse<AdminPerformance>('ADMIN_VENUE_NOT_FOUND', '존재하지 않는 공연장입니다.', 400)
    }

    const created: AdminPerformance = {
      id: nextId++,
      title: body.title,
      description: body.description,
      posterImageUrl: body.posterImageUrl,
      genre: body.genre,
      status: body.status,
      runningTimeMinutes: body.runningTimeMinutes,
      venueId: venue.id,
      venueName: venue.name,
      seatGrades: body.seatGrades,
    }
    performanceStore = [created, ...performanceStore]

    return HttpResponse.json<ApiResponse<AdminPerformance>>({
      success: true,
      data: created,
      errorCode: null,
      message: null,
    })
  }),

  http.patch(`${BASE_URL}/api/admin/performances/:id`, async ({ params, request }) => {
    const id = Number(params.id)
    const body = (await request.json()) as PerformanceUpdateRequest
    await delay(300)

    const existing = performanceStore.find((p) => p.id === id)
    if (!existing) {
      return errorResponse<AdminPerformance>('ADMIN_PERFORMANCE_NOT_FOUND', '존재하지 않는 공연입니다.', 404)
    }
    const venue = adminVenues.find((v) => v.id === body.venueId)
    if (!venue) {
      return errorResponse<AdminPerformance>('ADMIN_VENUE_NOT_FOUND', '존재하지 않는 공연장입니다.', 400)
    }

    const updated: AdminPerformance = {
      ...existing,
      ...body,
      venueId: venue.id,
      venueName: venue.name,
    }
    performanceStore = performanceStore.map((p) => (p.id === id ? updated : p))

    return HttpResponse.json<ApiResponse<AdminPerformance>>({
      success: true,
      data: updated,
      errorCode: null,
      message: null,
    })
  }),

  // 삭제 거부 재현: "예매/회차가 걸린 공연 삭제 거부"의 실제 판정 로직은 백엔드 정책 미확정(PRD FR-M1)이라
  // 프론트가 만들 필요는 없다 — id가 짝수인 공연만 "예매 있음"으로 간주해 409를 재현하고, 프론트는
  // 이 응답을 정상적으로 처리(에러 메시지 표시)하는지에만 집중한다.
  http.delete(`${BASE_URL}/api/admin/performances/:id`, async ({ params }) => {
    const id = Number(params.id)
    await delay(200)

    const existing = performanceStore.find((p) => p.id === id)
    if (!existing) {
      return errorResponse<null>('ADMIN_PERFORMANCE_NOT_FOUND', '존재하지 않는 공연입니다.', 404)
    }
    if (id % 2 === 0) {
      return errorResponse<null>(
        'PERFORMANCE_DELETE_CONFLICT',
        '예매 또는 회차가 등록된 공연은 삭제할 수 없습니다.',
        409,
      )
    }

    performanceStore = performanceStore.filter((p) => p.id !== id)
    return HttpResponse.json<ApiResponse<null>>({ success: true, data: null, errorCode: null, message: null })
  }),
]
