import { apiClient } from '@/api/client'
import type { PerformanceSummary } from './types'

export const catalogApi = {
  getPerformances: () => apiClient.get<PerformanceSummary[]>('/api/performances'),
}
