import { http, HttpResponse } from 'msw'
import type { ApiResponse } from '@/api/types'
import type { PerformanceSummary } from '@/features/catalog/types'
import { dummyPerformances } from '../fixtures/performances'

const BASE_URL = import.meta.env.VITE_API_BASE_URL

export const catalogHandlers = [
  http.get(`${BASE_URL}/api/performances`, () => {
    return HttpResponse.json<ApiResponse<PerformanceSummary[]>>({
      success: true,
      data: dummyPerformances,
      errorCode: null,
      message: null,
    })
  }),
]
