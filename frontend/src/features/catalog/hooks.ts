import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import { catalogApi } from './api'

export function usePerformances() {
  return useQuery({
    queryKey: queryKeys.catalog.list(),
    queryFn: catalogApi.getPerformances,
  })
}

export function usePerformanceDetail(id: number) {
  return useQuery({
    queryKey: queryKeys.catalog.detail(id),
    queryFn: () => catalogApi.getPerformanceDetail(id),
    enabled: Number.isFinite(id),
  })
}

// 진입 시 먼저 뜨는 등급별 잔여 요약 — 배치도(useSeatMap)보다 가볍게 먼저 로드한다(FRONTEND.md 5절③ 2단계 로딩).
export function useSeatSummary(sessionId: number) {
  return useQuery({
    queryKey: queryKeys.catalog.seatSummary(sessionId),
    queryFn: () => catalogApi.getSeatSummary(sessionId),
    enabled: Number.isFinite(sessionId),
  })
}

export function useSeatMap(sessionId: number) {
  return useQuery({
    queryKey: queryKeys.catalog.seatMap(sessionId),
    queryFn: () => catalogApi.getSeatMap(sessionId),
    enabled: Number.isFinite(sessionId),
  })
}
