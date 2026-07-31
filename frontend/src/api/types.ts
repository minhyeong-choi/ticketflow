// 백엔드 global/common/ApiResponse.java 실제 필드 기준 (문서상 표기 {success,data,error}와 다름 — 구현 기준).
export interface ApiResponse<T> {
  success: boolean
  data: T | null
  errorCode: string | null
  message: string | null
}

// api/client.ts가 throw하는 정규화된 에러. UI는 항상 error.code로 분기한다(FRONTEND.md 5절⑦).
export class ApiError extends Error {
  readonly code: string
  readonly httpStatus: number

  constructor(code: string, message: string, httpStatus: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.httpStatus = httpStatus
  }
}
