import { apiClient } from '@/api/client'
import type { BookingDetail, BookingSummary, Notification } from './types'

// 예매/알림 조회 경로의 실제 소유자는 B(CLAUDE.md API 경로 소유권 표: /api/bookings/**)지만,
// 백엔드 구현 전이라(docs/ROADMAP.md) 지금은 MSW 핸들러(mocks/handlers/booking.ts, notification.ts)가 응답한다.
export const mypageApi = {
  getBookings: () => apiClient.get<BookingSummary[]>('/api/bookings'),
  getBookingDetail: (id: number) => apiClient.get<BookingDetail>(`/api/bookings/${id}`),
  getNotifications: () => apiClient.get<Notification[]>('/api/notifications'),
}
