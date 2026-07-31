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
