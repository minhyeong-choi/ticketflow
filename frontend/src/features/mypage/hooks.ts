import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import { mypageApi } from './api'

export function useBookings() {
  return useQuery({
    queryKey: queryKeys.mypage.bookings,
    queryFn: mypageApi.getBookings,
  })
}

// 목록에서 항목을 펼쳤을 때만 상세를 불러온다 — enabled로 지연 로딩한다.
export function useBookingDetail(id: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.mypage.bookingDetail(id),
    queryFn: () => mypageApi.getBookingDetail(id),
    enabled: enabled && Number.isFinite(id),
  })
}

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.mypage.notifications,
    queryFn: mypageApi.getNotifications,
  })
}
