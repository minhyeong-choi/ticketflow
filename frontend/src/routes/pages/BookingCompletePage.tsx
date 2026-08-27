import type { ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ApiError } from '@/api/types'
import { getErrorMessage } from '@/lib/errorMessages'
import { useBookingDetail } from '@/features/mypage/hooks'
import type { ConfirmBookingResponse } from '@/features/booking/types'

interface CompleteLocationState {
  booking?: ConfirmBookingResponse
}

function SummaryCard({
  bookingNumber,
  seatCount,
  totalAmount,
}: {
  bookingNumber: string
  seatCount: number
  totalAmount: number
}) {
  return (
    <div className="w-full bg-curtain px-6 py-6 text-left ring-1 ring-inset ring-mist/20">
      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-mist/70">예매 번호</dt>
          <dd className="font-bold text-chalk">{bookingNumber}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-mist/70">좌석 수</dt>
          <dd className="text-chalk">{seatCount}석</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-mist/70">결제 금액</dt>
          <dd className="font-bold text-marquee">{totalAmount.toLocaleString('ko-KR')}원</dd>
        </div>
      </dl>
    </div>
  )
}

// 확정(POST /api/bookings) 성공 직후에는 navigate state로 받은 응답을 바로 보여준다.
// state 없이 진입한 경우(새로고침·직접 URL 접근)에는 마이페이지가 쓰는 예매 상세 조회
// 훅(useBookingDetail)으로 폴백한다 — bookingId만 있으면 되므로 별도 API·컴포넌트 없이 재사용한다.
export function BookingCompletePage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const stateBooking = (location.state as CompleteLocationState | null)?.booking
  const bookingId = Number(id)
  const shouldFetchDetail = !stateBooking && Number.isFinite(bookingId)

  const { data, isPending, isError, error, refetch } = useBookingDetail(bookingId, shouldFetchDetail)

  let body: ReactNode
  if (stateBooking) {
    body = (
      <SummaryCard
        bookingNumber={stateBooking.bookingNumber}
        seatCount={stateBooking.sessionSeatIds.length}
        totalAmount={stateBooking.totalAmount}
      />
    )
  } else if (!Number.isFinite(bookingId)) {
    body = <p className="text-sm text-mist/80">예매 정보를 찾을 수 없습니다.</p>
  } else if (isPending) {
    body = <p className="text-sm text-mist/80">예매 정보를 불러오는 중...</p>
  } else if (isError) {
    const message = error instanceof ApiError ? getErrorMessage(error) : '예매 정보를 불러오지 못했습니다.'
    body = (
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-encore">{message}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-full border border-marquee/50 px-4 py-1.5 text-xs font-medium text-marquee hover:bg-marquee/10"
        >
          다시 시도
        </button>
      </div>
    )
  } else {
    body = <SummaryCard bookingNumber={data.bookingNumber} seatCount={data.seatCount} totalAmount={data.totalAmount} />
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <span className="font-label text-xs font-medium uppercase tracking-[0.3em] text-marquee">Step 4</span>
      <h1 className="font-display text-2xl text-chalk">예매가 완료되었습니다</h1>

      {body}

      <Link
        to="/"
        className="rounded-full bg-marquee px-5 py-2 text-sm font-bold text-void transition-colors hover:bg-marquee-dim"
      >
        홈으로 돌아가기
      </Link>
    </main>
  )
}
