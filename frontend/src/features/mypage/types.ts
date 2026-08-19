// SP2 이전 로컬 타입. 예매내역/알림 조회 API는 백엔드 미구현 상태(booking 도메인은 9~10주차,
// notification 도메인은 스키마조차 미설계 — docs/ROADMAP.md)라 MSW로만 응답한다.
// booking 상태값은 domain/booking/entity/BookingStatus.java 기준이며, 대기실/좌석 STEP(FRONTEND.md)에서
// 쓰는 세션/좌석 상태값과는 값 집합이 다르므로 이 파일에 별도로 둔다.

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED'

export interface BookingSummary {
  id: number
  bookingNumber: string
  status: BookingStatus
  performanceTitle: string
  /** 공연 회차 시각 (ISO datetime) */
  sessionAt: string
  venueName: string
  seatCount: number
  totalAmount: number
  /** 예매 생성 시각 (ISO datetime) */
  bookedAt: string
}

export interface BookingSeatDetail {
  grade: string
  section: string
  row: string
  seatNumber: number
  price: number
}

export interface BookingDetail extends BookingSummary {
  seats: BookingSeatDetail[]
}

// notification 테이블이 아직 설계되지 않아(docs/ROADMAP.md) 합리적으로 추정한 스키마.
// WAITING_ROOM_OPENED는 예매 흐름과 무관한 알림 종류가 섞이는 실제 알림함을 흉내내기 위한 데모용 타입이다.
export type NotificationType = 'BOOKING_CONFIRMED' | 'BOOKING_CANCELLED' | 'WAITING_ROOM_OPENED'

export interface Notification {
  id: number
  type: NotificationType
  message: string
  isRead: boolean
  createdAt: string
}
