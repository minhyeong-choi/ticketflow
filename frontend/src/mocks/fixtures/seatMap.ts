import type { SeatGradeSummary, SeatMapSeat } from '@/features/catalog/types'
import { dummyPerformanceDetails } from './performances'

// 상세 화면(STEP 1) fixture에 등록된 모든 회차 id — 좌석 조회 핸들러의 404 판별에 재사용한다.
export const KNOWN_SESSION_IDS = new Set(
  Object.values(dummyPerformanceDetails).flatMap((detail) => detail.sessions.map((s) => s.id)),
)

// 백엔드 SeedDataRunner.seedVenueAndSeats()와 동일 규모: 4구역 x 10열 x 30번 = 1200석.
const SECTIONS = ['FLOOR-A', 'FLOOR-B', '2F-L', '2F-R'] as const
const ROWS = 10
const SEATS_PER_ROW = 30
const SOLD_RATIO = 0.18

// SeedDataRunner는 FLOOR*->VIP, 2F*->R로만 매핑해 실제로는 S/A가 쓰이지 않는다. 이 mock은
// 4구역뿐인 fixture에서 4등급을 전부 보여줘야 하므로, 구역 내에서 무대와 가까운 앞쪽 절반(1~6열)과
// 뒤쪽(7~10열)을 나눠 등급을 배정한다: FLOOR->VIP/S, 2F->R/A.
function gradeForSectionRow(section: (typeof SECTIONS)[number], row: number): string {
  const isFloor = section.startsWith('FLOOR')
  const isFrontHalf = row <= 6
  if (isFloor) return isFrontHalf ? 'VIP' : 'S'
  return isFrontHalf ? 'R' : 'A'
}

// booking mock 핸들러가 확정 응답의 totalAmount를 계산할 때도 재사용한다.
export const GRADE_PRICE: Record<string, number> = {
  VIP: 180000,
  R: 140000,
  S: 100000,
  A: 70000,
}

// sessionId로 시드하는 결정론적 PRNG — 같은 세션을 다시 조회해도 SOLD 배치가 매번 바뀌지 않아야 한다
// (mulberry32, 외부 의존성 없이 짧게 구현).
function mulberry32(seed: number) {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function buildSeatMap(sessionId: number): SeatMapSeat[] {
  const random = mulberry32(sessionId * 7919 + 13)
  const seats: SeatMapSeat[] = []
  let seatId = sessionId * 10_000 // 세션별 id 네임스페이스 분리(실 DB의 session_seat.id 역할)

  for (const section of SECTIONS) {
    for (let row = 1; row <= ROWS; row++) {
      const gradeName = gradeForSectionRow(section, row)
      const rowLabel = String.fromCharCode(64 + row) // A..J — SeedDataRunner의 chr(64 + r)와 동일 규칙

      for (let seatNumber = 1; seatNumber <= SEATS_PER_ROW; seatNumber++) {
        seatId += 1
        seats.push({
          id: seatId,
          section,
          rowLabel,
          seatNumber,
          posX: seatNumber,
          posY: row,
          gradeName,
          status: random() < SOLD_RATIO ? 'SOLD' : 'AVAILABLE',
        })
      }
    }
  }

  return seats
}

export function buildSeatSummary(seats: SeatMapSeat[]): SeatGradeSummary[] {
  const gradeNames = [...new Set(seats.map((seat) => seat.gradeName))]

  return gradeNames.map((name) => {
    const graded = seats.filter((seat) => seat.gradeName === name)
    const remaining = graded.filter((seat) => seat.status === 'AVAILABLE').length
    return { name, price: GRADE_PRICE[name] ?? 0, remaining, total: graded.length }
  })
}
