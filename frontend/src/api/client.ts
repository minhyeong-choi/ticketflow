import { useAuthStore } from '@/features/auth/store'
import { ApiError, type ApiResponse } from './types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL

interface RequestOptions extends RequestInit {
  /** true면 Authorization 헤더를 붙이지 않는다 (로그인/회원가입 등). */
  skipAuth?: boolean
}

// 이 파일이 fetch를 감싸는 유일한 통로다 — 토큰 주입/ApiResponse 언랩/에러 정규화가 모두 여기 한 곳에만 있다.
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth, headers, ...rest } = options
  const accessToken = useAuthStore.getState().accessToken

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(!skipAuth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  })

  let body: ApiResponse<T> | null = null
  try {
    body = (await response.json()) as ApiResponse<T>
  } catch {
    // 204 No Content 등 바디가 없는 응답
  }

  if (!body) {
    if (!response.ok) {
      throw new ApiError('COMMON_004', '서버 응답을 처리할 수 없습니다.', response.status)
    }
    return null as T
  }

  if (!body.success) {
    const code = body.errorCode ?? 'COMMON_004'
    const message = body.message ?? '알 수 없는 오류가 발생했습니다.'

    // 401은 세션이 더 이상 유효하지 않다는 뜻 — 저장된 토큰을 즉시 비운다.
    // 리다이렉트는 여기서 하지 않는다(client.ts는 라우팅에 관여하지 않는다 — ProtectedRoute/화면단 책임).
    if (response.status === 401) {
      useAuthStore.getState().logout()
    }

    throw new ApiError(code, message, response.status)
  }

  return body.data as T
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, data?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
}
