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
  // booking 도메인(B 담당, 아직 미구현) mock 코드 — docs/study/02-developer-b-workflow.md 7~8주차 절
  // 기준으로 프론트가 추정한 BookingErrorCode. 실 API 전환 시 정식 코드 문자열과 일치하는지 재확인
  // 필요(FRONTEND.md 9절 C6). SEAT_ALREADY_BOOKED는 uq_booking_seat_active 위반(DB에 이미 SOLD)이고,
  // SEAT_ALREADY_HELD는 다른 사용자의 Redis 락이 이미 있는 경우다 — 둘 다 HTTP 409지만 code로 구분한다.
  SEAT_ALREADY_BOOKED: '이미 예매된 좌석입니다. 다른 좌석을 선택해 주세요.',
  SEAT_ALREADY_HELD: '다른 분이 선택 중인 좌석입니다.',
  SEAT_HOLD_EXPIRED: '선택 시간이 만료되었습니다. 좌석을 다시 선택해 주세요.',
  PAYMENT_FAILED: '결제 처리에 실패했습니다. 다시 시도해 주세요.',
  // waiting 도메인(B 담당, 아직 미구현) mock 코드 — 실 API 전환 시 실제 WaitingErrorCode로 교체 필요.
  WAITING_001: '존재하지 않는 회차입니다.',
  WAITING_002: '대기열 참가 정보가 없습니다. 대기실에 다시 입장해주세요.',
  // booking 조회(GET /api/bookings/{id}) mock 코드 — 백엔드 미구현(9~10주차 예정)이라 프론트가 추정.
  BOOKING_001: '존재하지 않는 예매입니다.',
  // 관리자 공연 CRUD(/api/admin/**, STEP6 FR-M1) mock 코드 — 실 API 전환 시 정식 코드 문자열 재확인 필요.
  // PERFORMANCE_DELETE_CONFLICT: 예매/회차가 걸린 공연 삭제 시도(판정 로직은 백엔드 미확정, PRD FR-M1).
  PERFORMANCE_DELETE_CONFLICT: '예매 또는 회차가 등록된 공연은 삭제할 수 없습니다.',
  ADMIN_PERFORMANCE_NOT_FOUND: '존재하지 않는 공연입니다.',
  ADMIN_VENUE_NOT_FOUND: '존재하지 않는 공연장입니다.',
}

export function getErrorMessage(error: ApiError): string {
  const known = ERROR_MESSAGES[error.code]
  if (known) return known

  console.warn(`[errorMessages] 등록되지 않은 errorCode: ${error.code}`, error.message)
  return error.message || '알 수 없는 오류가 발생했습니다.'
}
