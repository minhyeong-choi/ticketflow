// STEP6(FR-M1) 관리자 공연 CRUD 전용 로컬 타입.
// features/catalog/types.ts의 PerformanceSummary/PerformanceDetail과 값 집합은 겹치지만 용도가 다르다
// (조회 화면용 vs 관리자 등록/수정 폼용) — feature 간 직접 import를 금지하는 규칙에 따라 여기서 새로 정의한다.
// 값 집합의 근거는 V1__init.sql의 performance.genre/status와 동일.

export type AdminPerformanceGenre = 'CONCERT' | 'MUSICAL' | 'PLAY'

export type AdminPerformanceStatus = 'SCHEDULED' | 'ON_SALE' | 'CLOSED'

export interface AdminSeatGrade {
  name: string
  price: number
}

// GET /api/admin/performances, POST/PATCH 응답 — seat_grade까지 함께 실어 목록에서 바로 등급 요약을 보여준다.
export interface AdminPerformance {
  id: number
  title: string
  description: string
  posterImageUrl: string
  genre: AdminPerformanceGenre
  status: AdminPerformanceStatus
  runningTimeMinutes: number
  venueId: number
  venueName: string
  seatGrades: AdminSeatGrade[]
}

// 등록 폼의 공연장 선택 옵션 — venue 자체의 CRUD는 범위 밖이라 id/name만 필요하다.
export interface VenueOption {
  id: number
  name: string
}

export interface PerformanceCreateRequest {
  title: string
  description: string
  posterImageUrl: string
  genre: AdminPerformanceGenre
  status: AdminPerformanceStatus
  runningTimeMinutes: number
  venueId: number
  seatGrades: AdminSeatGrade[]
}

// PATCH 페이로드도 폼이 항상 전체 필드를 다시 제출하는 구조라 CreateRequest와 형태가 같다.
export type PerformanceUpdateRequest = PerformanceCreateRequest
