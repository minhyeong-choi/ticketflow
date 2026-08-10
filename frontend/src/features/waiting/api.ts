import { apiClient } from '@/api/client'
import type { WaitingStatus } from './types'

// 대기실 API 경로 소유자는 B(CLAUDE.md API 경로 소유권 표: /api/waiting/**).
export const waitingApi = {
  enter: (sessionId: number) => apiClient.post<WaitingStatus>(`/api/waiting/${sessionId}/enter`),
  // 폴링 = heartbeat(FRONTEND.md 5절①) — 이 요청 자체가 생존 신호다.
  getStatus: (sessionId: number) => apiClient.get<WaitingStatus>(`/api/waiting/${sessionId}/status`),
  leave: (sessionId: number) => apiClient.delete<null>(`/api/waiting/${sessionId}`),
}
