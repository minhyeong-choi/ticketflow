import type { BookingStatus, NotificationType } from './types'

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: '결제 대기',
  CONFIRMED: '예매 완료',
  CANCELLED: '취소됨',
}

// 노란색(marquee)은 CTA·활성 탭·핵심 뱃지 전용 원칙 유지(catalog/labels.ts와 동일 원칙).
export const BOOKING_STATUS_STYLE: Record<BookingStatus, string> = {
  PENDING: 'bg-curtain-light text-paper ring-1 ring-inset ring-mist/30',
  CONFIRMED: 'bg-marquee text-void',
  CANCELLED: 'bg-void/70 text-mist ring-1 ring-inset ring-mist/20',
}

// 알림 목록의 좌측 점 색상 — 종류 구분용이라 텍스트 뱃지보다 가벼운 표시로 충분하다.
export const NOTIFICATION_TYPE_DOT_COLOR: Record<NotificationType, string> = {
  BOOKING_CONFIRMED: 'bg-marquee',
  BOOKING_CANCELLED: 'bg-encore',
  WAITING_ROOM_OPENED: 'bg-paper',
}
