import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import { adminApi } from './api'
import type { PerformanceCreateRequest, PerformanceUpdateRequest } from './types'

export function useAdminPerformances() {
  return useQuery({
    queryKey: queryKeys.admin.performances,
    queryFn: adminApi.getPerformances,
  })
}

// 공연장 자체 CRUD는 범위 밖이라 이 세션 동안 거의 바뀌지 않는다고 보고 재조회를 억제한다.
export function useVenueOptions() {
  return useQuery({
    queryKey: queryKeys.admin.venues,
    queryFn: adminApi.getVenues,
    staleTime: Infinity,
  })
}

// 관리자 쓰기 작업도 좌석 선점/확정과 같은 이유로 retry:0을 통일 적용한다(중복 제출 방지, FRONTEND.md 5절④ 준용).
export function useCreatePerformance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: PerformanceCreateRequest) => adminApi.createPerformance(payload),
    retry: 0,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.performances }),
  })
}

export function useUpdatePerformance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PerformanceUpdateRequest }) =>
      adminApi.updatePerformance(id, payload),
    retry: 0,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.performances }),
  })
}

export function useDeletePerformance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => adminApi.deletePerformance(id),
    retry: 0,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.performances }),
  })
}
