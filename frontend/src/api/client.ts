import { useAuthStore } from '@/features/auth/store'
import { ApiError, type ApiResponse } from './types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL

interface RequestOptions extends RequestInit {
  /** true면 Authorization 헤더를 붙이지 않는다 (로그인/회원가입 등). */
  skipAuth?: boolean
}

interface RawResult<T> {
  data: T
  response: Response
}

// 이 파일이 fetch를 감싸는 유일한 통로다 — 토큰 주입/ApiResponse 언랩/에러 정규화가 모두 여기 한 곳에만 있다.
// requestRaw는 raw Response까지 반환하는 내부 헬퍼다. 대부분의 화면은 아래 request()/apiClient의
// data-only 반환으로 충분하지만, 좌석 선점(hold) 응답만은 Date 헤더로 서버-클라 시계 오프셋을 보정해야
// 해서(FRONTEND.md 5절②) apiClient.postWithHeaders가 이 헬퍼를 그대로 노출한다.
async function requestRaw<T>(path: string, options: RequestOptions = {}): Promise<RawResult<T>> {
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
    return { data: null as T, response }
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

  return { data: body.data as T, response }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { data } = await requestRaw<T>(path, options)
  return data
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, data?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
  // POST + raw Response 반환. 지금은 좌석 선점(hold) 한 곳만 쓴다 — data만 반환하는 위 post()로는
  // Date 헤더(clock offset 보정용, FRONTEND.md 5절②)에 접근할 수 없어서 별도로 둔다.
  postWithHeaders: <T>(path: string, data?: unknown, options?: RequestOptions) =>
    requestRaw<T>(path, { ...options, method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined }),
}
