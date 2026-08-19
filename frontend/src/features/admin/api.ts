import { apiClient } from '@/api/client'
import type { AdminPerformance, PerformanceCreateRequest, PerformanceUpdateRequest, VenueOption } from './types'

// 관리자 CRUD는 카탈로그 조회(/api/performances, B 소유·조회 전용)와 분리된 /api/admin/** 경로를 쓴다.
// docs/study/02-developer-b-workflow.md에 아직 문서화되지 않아 CLAUDE.md API 경로 소유권 표의
// prefix 규칙(성능/좌석은 B, /api/admin/**는 관리 목적)을 근거로 REST 관례로 추정했다 — 실 엔드포인트
// 확정 시 B와 맞춰 조정 필요.
export const adminApi = {
  getPerformances: () => apiClient.get<AdminPerformance[]>('/api/admin/performances'),
  getVenues: () => apiClient.get<VenueOption[]>('/api/admin/venues'),
  createPerformance: (payload: PerformanceCreateRequest) =>
    apiClient.post<AdminPerformance>('/api/admin/performances', payload),
  updatePerformance: (id: number, payload: PerformanceUpdateRequest) =>
    apiClient.patch<AdminPerformance>(`/api/admin/performances/${id}`, payload),
  deletePerformance: (id: number) => apiClient.delete<null>(`/api/admin/performances/${id}`),
}
