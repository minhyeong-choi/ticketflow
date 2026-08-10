import { apiClient } from '@/api/client'
import type { PerformanceDetail, PerformanceSummary, SeatGradeSummary, SeatMapSeat } from './types'

export const catalogApi = {
  getPerformances: () => apiClient.get<PerformanceSummary[]>('/api/performances'),
  getPerformanceDetail: (id: number) => apiClient.get<PerformanceDetail>(`/api/performances/${id}`),
  // 좌석 조회는 카탈로그 도메인 소유(CLAUDE.md API 경로 소유권) — 선점/확정(/api/bookings/**)과는 분리.
  getSeatSummary: (sessionId: number) =>
    apiClient.get<SeatGradeSummary[]>(`/api/sessions/${sessionId}/seats/summary`),
  getSeatMap: (sessionId: number) => apiClient.get<SeatMapSeat[]>(`/api/sessions/${sessionId}/seats`),
}
