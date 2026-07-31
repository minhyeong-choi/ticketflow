import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import { catalogApi } from './api'

export function usePerformances() {
  return useQuery({
    queryKey: queryKeys.catalog.list(),
    queryFn: catalogApi.getPerformances,
  })
}
