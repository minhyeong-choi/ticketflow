import type { AdminPerformanceGenre, AdminPerformanceStatus } from './types'

// features/catalog/labels.ts의 GENRE_LABEL/STATUS_LABEL과 값은 같지만, feature 간 직접 import를
// 금지하는 규칙(CLAUDE.md/FRONTEND.md)에 따라 필요한 만큼만 다시 정의한다 — 두 항목뿐이라 중복이
// 과설계보다 낫다는 판단.

export const ADMIN_GENRE_LABEL: Record<AdminPerformanceGenre, string> = {
  CONCERT: '콘서트',
  MUSICAL: '뮤지컬',
  PLAY: '연극',
}

export const ADMIN_STATUS_LABEL: Record<AdminPerformanceStatus, string> = {
  ON_SALE: '예매중',
  SCHEDULED: '오픈 예정',
  CLOSED: '예매 종료',
}
