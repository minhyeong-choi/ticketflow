import { useState } from 'react'
import { ApiError } from '@/api/types'
import { getErrorMessage } from '@/lib/errorMessages'
import { formatSessionDateTime } from '@/lib/format'
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_STYLE } from '@/features/mypage/labels'
import { useBookingDetail, useBookings } from '@/features/mypage/hooks'
import type { BookingSummary } from '@/features/mypage/types'

function ListSkeleton() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="h-24 animate-pulse bg-curtain-light/60 ring-1 ring-inset ring-mist/10" />
      ))}
    </ul>
  )
}

function SectionError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof ApiError ? getErrorMessage(error) : '정보를 불러오지 못했습니다.'
  return (
    <div className="flex flex-col items-center justify-center gap-3 bg-curtain-light/40 px-4 py-10 text-center ring-1 ring-inset ring-mist/10">
      <p className="text-sm text-encore">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full border border-marquee/50 px-4 py-1.5 text-xs font-medium text-marquee hover:bg-marquee/10"
      >
        다시 시도
      </button>
    </div>
  )
}

function BookingDetailPanel({ bookingId }: { bookingId: number }) {
  const { data, isPending, isError, error, refetch } = useBookingDetail(bookingId)

  if (isPending) {
    return <p className="border-t border-mist/10 px-4 py-4 text-xs text-mist">좌석 정보를 불러오는 중...</p>
  }
  if (isError) {
    return (
      <div className="border-t border-mist/10 px-4 py-4">
        <SectionError error={error} onRetry={() => refetch()} />
      </div>
    )
  }

  return (
    <ul className="divide-y divide-mist/10 border-t border-mist/10 px-4 py-1">
      {data.seats.map((seat, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-xs">
          <span className="text-chalk">
            {seat.section} {seat.row}열 {seat.seatNumber}번{' '}
            <span className="text-mist/60">({seat.grade})</span>
          </span>
          <span className="text-mist/80">{seat.price.toLocaleString('ko-KR')}원</span>
        </li>
      ))}
    </ul>
  )
}

function BookingRow({
  booking,
  expanded,
  onToggle,
}: {
  booking: BookingSummary
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <li className="bg-curtain ring-1 ring-inset ring-mist/10">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${BOOKING_STATUS_STYLE[booking.status]}`}
            >
              {BOOKING_STATUS_LABEL[booking.status]}
            </span>
            <span className="text-sm font-medium text-chalk">{booking.performanceTitle}</span>
          </div>
          <p className="mt-1.5 text-xs text-mist/80">
            {formatSessionDateTime(booking.sessionAt)} · {booking.venueName} · {booking.seatCount}석
          </p>
          <p className="mt-0.5 text-[11px] text-mist/60">예매번호 {booking.bookingNumber}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <p className="text-sm font-bold text-marquee">{booking.totalAmount.toLocaleString('ko-KR')}원</p>
          <span
            aria-hidden="true"
            className={`text-mist transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            ▾
          </span>
        </div>
      </button>
      {expanded && <BookingDetailPanel bookingId={booking.id} />}
    </li>
  )
}

export function MyBookingsPage() {
  const { data, isPending, isError, error, refetch } = useBookings()
  const [expandedId, setExpandedId] = useState<number | null>(null)

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6">
        <span className="font-label text-xs font-medium uppercase tracking-[0.3em] text-marquee">My Page</span>
        <h1 className="font-display text-2xl text-chalk">예매 내역</h1>
      </header>

      {isPending ? (
        <ListSkeleton />
      ) : isError ? (
        <SectionError error={error} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <p className="py-16 text-center text-sm text-mist">예매 내역이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((booking) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              expanded={expandedId === booking.id}
              onToggle={() => setExpandedId((prev) => (prev === booking.id ? null : booking.id))}
            />
          ))}
        </ul>
      )}
    </main>
  )
}
