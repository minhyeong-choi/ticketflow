import { delay, http, HttpResponse } from 'msw'
import type { ApiResponse } from '@/api/types'
import type { Notification } from '@/features/mypage/types'
import { bookingStore } from './booking'

const BASE_URL = import.meta.env.VITE_API_BASE_URL

// notification 도메인은 스키마조차 미설계 상태(docs/ROADMAP.md) — 예매 확정 시 자연스럽게 생겼을 법한
// 알림을 booking mock 저장소(mocks/handlers/booking.ts)에서 파생시켜 완전 정적 픽스처보다 실제 흐름에
// 가깝게 만든다. 읽음 처리 API는 이번 STEP 범위 밖이라(과설계 금지) isRead는 고정 데모값이다.
function buildNotifications(): Notification[] {
  const bookingItems: Array<Omit<Notification, 'id' | 'isRead'>> = bookingStore.map((booking) => ({
    type: booking.status === 'CANCELLED' ? 'BOOKING_CANCELLED' : 'BOOKING_CONFIRMED',
    message:
      booking.status === 'CANCELLED'
        ? `[${booking.performanceTitle}] 예매가 취소되었습니다. (${booking.bookingNumber})`
        : `[${booking.performanceTitle}] 예매가 확정되었습니다. ${booking.seatCount}석, ${booking.totalAmount.toLocaleString('ko-KR')}원.`,
    createdAt: booking.bookedAt,
  }))

  // 예매와 무관한 알림 종류도 섞어 실제 알림함처럼 보이게 한다.
  bookingItems.push({
    type: 'WAITING_ROOM_OPENED',
    message: '관심 등록한 공연의 대기열 입장이 곧 시작됩니다.',
    createdAt: new Date().toISOString(),
  })

  const sorted = bookingItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // 가장 최근 2건만 안읽음으로 표시 — 데모용 고정 규칙.
  return sorted.map((item, index) => ({ id: index + 1, isRead: index >= 2, ...item }))
}

export const notificationHandlers = [
  http.get(`${BASE_URL}/api/notifications`, async () => {
    await delay(150)
    return HttpResponse.json<ApiResponse<Notification[]>>({
      success: true,
      data: buildNotifications(),
      errorCode: null,
      message: null,
    })
  }),
]
