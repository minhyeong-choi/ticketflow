import { Link, useLocation, useParams } from 'react-router-dom'
import type { ConfirmBookingResponse } from '@/features/booking/types'

interface CompleteLocationState {
  booking?: ConfirmBookingResponse
}

// 확정(POST /api/bookings) 성공 직후 navigate state로 넘어온 응답만 보여준다. 별도 예매 상세
// 조회 API는 마이페이지 STEP 몫이라(이번 STEP 범위 아님) state 없이 진입(새로고침 등)한 경우는
// 최소 안내만 하고 상세 재조회를 시도하지 않는다.
export function BookingCompletePage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const booking = (location.state as CompleteLocationState | null)?.booking

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <span className="font-label text-xs font-medium uppercase tracking-[0.3em] text-marquee">Step 4</span>
      <h1 className="font-display text-2xl text-chalk">예매가 완료되었습니다</h1>

      {booking ? (
        <div className="w-full bg-curtain px-6 py-6 text-left ring-1 ring-inset ring-mist/20">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-mist/70">예매 번호</dt>
              <dd className="font-bold text-chalk">{booking.bookingNumber}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-mist/70">좌석 수</dt>
              <dd className="text-chalk">{booking.sessionSeatIds.length}석</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-mist/70">결제 금액</dt>
              <dd className="font-bold text-marquee">{booking.totalAmount.toLocaleString('ko-KR')}원</dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="text-sm text-mist/80">
          예매 번호 #{id}. 상세 내역은 마이페이지 예매 내역에서 확인할 수 있습니다.
        </p>
      )}

      <Link
        to="/"
        className="rounded-full bg-marquee px-5 py-2 text-sm font-bold text-void transition-colors hover:bg-marquee-dim"
      >
        홈으로 돌아가기
      </Link>
    </main>
  )
}
