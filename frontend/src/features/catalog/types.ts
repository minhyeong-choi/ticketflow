// SP2에서 api/generated의 OpenAPI 생성 타입으로 교체될 자리.
// 지금은 백엔드 V1__init.sql(performance/venue/session/seat_grade) 스키마를 기준으로 한 로컬 타입.

export type PerformanceGenre = 'CONCERT' | 'MUSICAL' | 'PLAY'

export type PerformanceStatus = 'SCHEDULED' | 'ON_SALE' | 'CLOSED'

export interface PerformanceSummary {
  id: number
  title: string
  posterImageUrl: string
  genre: PerformanceGenre
  status: PerformanceStatus
  venueName: string
  /** 여러 회차(session) 중 최초 공연일 (ISO date) */
  periodStart: string
  /** 여러 회차(session) 중 최후 공연일 (ISO date) */
  periodEnd: string
  /** 여러 좌석 등급(seat_grade) 중 최저가 (원) */
  minPrice: number
  /** 여러 좌석 등급(seat_grade) 중 최고가 (원) */
  maxPrice: number
}

// session.status는 performance.status와 값 집합이 다르다(SOLD_OUT 추가) — 별도 타입으로 분리.
export type SessionStatus = 'SCHEDULED' | 'ON_SALE' | 'SOLD_OUT' | 'CLOSED'

export interface SessionSummary {
  id: number
  /** 공연 회차 시각 (ISO datetime) */
  sessionAt: string
  /** 예매 오픈 시각 (ISO datetime) */
  bookingOpenAt: string
  status: SessionStatus
}

export interface SeatGradePrice {
  name: string
  price: number
}

export interface PerformanceDetail extends PerformanceSummary {
  description: string
  runningTimeMinutes: number
  sessions: SessionSummary[]
  seatGrades: SeatGradePrice[]
}

// session_seat.status는 DB엔 AVAILABLE/SOLD만 존재한다(HELD 없음 — 임시 선점은 Redis에만 있고
// 이 STEP에선 다루지 않는다. FRONTEND.md 5절②).
export type SeatStatus = 'AVAILABLE' | 'SOLD'

// GET /api/sessions/{id}/seats/summary — 배치도 로드 전에 먼저 보여주는 등급별 잔여 요약.
export interface SeatGradeSummary {
  name: string
  price: number
  remaining: number
  total: number
}

// GET /api/sessions/{id}/seats — session_seat + venue_seat 조인 결과.
// posX/posY는 venue_seat의 구역 내부 로컬 좌표(1-base)이며 불변이다 — 구역별 화면 배치 오프셋은
// SeatMap 컴포넌트가 section 값을 기준으로 계산한다.
export interface SeatMapSeat {
  id: number
  section: string
  rowLabel: string
  seatNumber: number
  posX: number
  posY: number
  gradeName: string
  status: SeatStatus
}
