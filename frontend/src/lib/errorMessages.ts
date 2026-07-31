import type { ApiError } from '@/api/types'

// errorCode -> 사용자 언어 번역. 여기 없는 코드는 서버 message를 그대로 노출 + console.warn(무음 실패 금지, FRONTEND.md 5절⑦).
const ERROR_MESSAGES: Record<string, string> = {
  COMMON_001: '입력값을 다시 확인해주세요.',
  COMMON_002: '로그인이 필요합니다.',
  COMMON_003: '접근 권한이 없습니다.',
  COMMON_004: '서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
  USER_001: '이미 가입된 이메일입니다.',
  USER_002: '이메일 또는 비밀번호가 올바르지 않습니다.',
  USER_003: '사용자를 찾을 수 없습니다.',
  USER_004: '현재 비밀번호가 일치하지 않습니다.',
  // 임시 하드코딩 코드(GlobalExceptionHandler의 DataIntegrityViolationException 핸들러).
  // booking 도메인 구현 시 정식 BookingErrorCode로 교체될 예정 — 바뀌면 이 항목도 같이 갱신해야 한다.
  B409: '이미 예매된 좌석입니다.',
}

export function getErrorMessage(error: ApiError): string {
  const known = ERROR_MESSAGES[error.code]
  if (known) return known

  console.warn(`[errorMessages] 등록되지 않은 errorCode: ${error.code}`, error.message)
  return error.message || '알 수 없는 오류가 발생했습니다.'
}
