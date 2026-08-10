import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import { ApiError } from '@/api/types'
import { getErrorMessage } from '@/lib/errorMessages'
import { getSeatGradeColor, SEAT_STATUS_COLOR } from '@/features/catalog/labels'
import { useSeatMap, useSeatSummary } from '@/features/catalog/hooks'
import { getEntryToken } from '@/features/waiting/hooks'
import { SeatMap } from '@/features/catalog/components/SeatMap'
import { HoldTimer } from '@/features/booking/components/HoldTimer'
import { useConfirmBooking, useHoldCountdown, useHoldSeats, useReleaseSeats } from '@/features/booking/hooks'
import { useHoldStore } from '@/features/booking/store'
import type { SeatMapSeat } from '@/features/catalog/types'

// booking_seat는 한 예매에 좌석 2~4석을 함께 담는다(CLAUDE.md) — 배치도 조회/로컬 선택 단계에서도
// 같은 상한을 미리 안내해 다음 STEP(선점 요청)에서 거절당할 선택을 애초에 막는다.
const MAX_SELECTABLE_SEATS = 4

function SummarySkeleton() {
  return (
    <ul className="flex flex-wrap gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <li
          key={i}
          className="h-9 w-24 animate-pulse rounded-sm bg-curtain-light ring-1 ring-inset ring-mist/10"
        />
      ))}
    </ul>
  )
}

function SeatMapSkeleton() {
  return (
    <div className="flex h-72 items-center justify-center bg-curtain-light/40 ring-1 ring-inset ring-mist/10 sm:h-96">
      <p className="font-label text-xs text-mist">좌석 배치도를 불러오는 중...</p>
    </div>
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

function mutationErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? getErrorMessage(error) : fallback
}

export function SeatMapPage() {
  const { id } = useParams<{ id: string }>()
  const sessionId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const summaryQuery = useSeatSummary(sessionId)
  const seatMapQuery = useSeatMap(sessionId)

  const [selectedSeatIds, setSelectedSeatIds] = useState<Set<number>>(new Set())
  const [limitWarning, setLimitWarning] = useState(false)

  const holdSnapshot = useHoldStore((s) => s.hold)
  const clearHold = useHoldStore((s) => s.clearHold)
  const holdMutation = useHoldSeats()
  const releaseMutation = useReleaseSeats()
  const confirmMutation = useConfirmBooking()

  const entryToken = getEntryToken(sessionId)

  // 이 회차에 대한 선점이면서 이미 만료 시각이 지났다면 새로고침 직후 즉시 폐기한다(FRONTEND.md 5절⑥).
  useEffect(() => {
    if (
      holdSnapshot &&
      holdSnapshot.sessionId === sessionId &&
      new Date(holdSnapshot.holdExpiresAt).getTime() <= Date.now()
    ) {
      clearHold()
    }
    // sessionId가 바뀔 때(=이 페이지에 새로 진입할 때)만 검사한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const hasActiveHold =
    holdSnapshot !== null &&
    holdSnapshot.sessionId === sessionId &&
    new Date(holdSnapshot.holdExpiresAt).getTime() > Date.now()

  const countdown = useHoldCountdown(hasActiveHold ? holdSnapshot : null)
  const expiredHandledRef = useRef(false)

  // 카운트다운 0 도달 → 자동으로 선점 해제 상태로 되돌리고 배치도를 무효화한다(FRONTEND.md 5절②).
  // 서버 TTL이 최후 안전장치이므로 여기서는 클라이언트 상태 정리만 하고 별도 release 호출은 하지 않는다.
  useEffect(() => {
    if (!hasActiveHold) {
      expiredHandledRef.current = false
      return
    }
    if (countdown.remainingSec > 0 || expiredHandledRef.current) return

    expiredHandledRef.current = true
    clearHold()
    setSelectedSeatIds(new Set())
    queryClient.invalidateQueries({ queryKey: queryKeys.catalog.seatMap(sessionId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.catalog.seatSummary(sessionId) })
  }, [hasActiveHold, countdown.remainingSec, clearHold, queryClient, sessionId])

  useEffect(() => {
    if (!limitWarning) return
    const timer = setTimeout(() => setLimitWarning(false), 2500)
    return () => clearTimeout(timer)
  }, [limitWarning])

  const seats = seatMapQuery.data
  const seatById = useMemo(() => {
    const map = new Map<number, SeatMapSeat>()
    for (const seat of seats ?? []) map.set(seat.id, seat)
    return map
  }, [seats])

  const gradePriceByName = useMemo(() => {
    const map = new Map<string, number>()
    for (const grade of summaryQuery.data ?? []) map.set(grade.name, grade.price)
    return map
  }, [summaryQuery.data])

  function handleToggleSeat(seat: SeatMapSeat) {
    if (hasActiveHold) return // 선점 중에는 좌석 선택을 바꿀 수 없다 — 취소 후 다시 선택해야 한다.
    setSelectedSeatIds((prev) => {
      const next = new Set(prev)
      if (next.has(seat.id)) {
        next.delete(seat.id)
        return next
      }
      if (next.size >= MAX_SELECTABLE_SEATS) {
        setLimitWarning(true)
        return prev
      }
      next.add(seat.id)
      return next
    })
  }

  // 선점 성공 이후엔 "내가 잡은 좌석"(holdStore)이 화면상 선택 상태의 기준이 된다(FRONTEND.md 5절⑥).
  const displaySeatIds =
    hasActiveHold && holdSnapshot ? new Set(holdSnapshot.sessionSeatIds) : selectedSeatIds
  const displaySeats = [...displaySeatIds]
    .map((seatId) => seatById.get(seatId))
    .filter((seat): seat is SeatMapSeat => seat !== undefined)

  const totalPrice = displaySeats.reduce(
    (sum, seat) => sum + (gradePriceByName.get(seat.gradeName) ?? 0),
    0,
  )

  function handleHoldClick() {
    if (!entryToken || displaySeats.length === 0) return
    holdMutation.mutate({
      sessionId,
      sessionSeatIds: displaySeats.map((seat) => seat.id),
      entryToken,
    })
  }

  function handleReleaseClick() {
    if (!holdSnapshot) return
    releaseMutation.mutate({ sessionSeatIds: holdSnapshot.sessionSeatIds })
    setSelectedSeatIds(new Set())
  }

  function handleConfirmClick() {
    if (!holdSnapshot || !entryToken) return
    confirmMutation.mutate(
      {
        body: { sessionId, sessionSeatIds: holdSnapshot.sessionSeatIds, entryToken },
        idempotencyKey: holdSnapshot.idempotencyKey,
      },
      {
        onSuccess: (booking) => {
          navigate(`/bookings/${booking.id}/complete`, { replace: true, state: { booking } })
        },
      },
    )
  }

  if (!Number.isFinite(sessionId)) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-encore">잘못된 회차입니다.</p>
        <Link
          to="/"
          className="rounded-full border border-marquee/50 px-4 py-2 text-sm font-medium text-marquee hover:bg-marquee/10"
        >
          목록으로 돌아가기
        </Link>
      </main>
    )
  }

  // 입장 토큰 없이 URL 직접 접근한 경우 대기실로 되돌린다(FRONTEND.md 6절 라우트 가드).
  if (!entryToken) {
    return <Navigate to={`/sessions/${sessionId}/waiting`} replace />
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6">
        <span className="font-label text-xs font-medium uppercase tracking-[0.3em] text-marquee">
          Step 2
        </span>
        <h1 className="font-display text-2xl text-chalk">좌석 선택</h1>
      </header>

      {/* 등급별 잔여 요약 — 배치도보다 가볍고 먼저 뜬다(FRONTEND.md 5절③ 2단계 로딩). */}
      <section className="mb-6">
        <h2 className="mb-2 font-label text-xs font-semibold uppercase tracking-wide text-mist">
          좌석 등급
        </h2>
        {summaryQuery.isPending ? (
          <SummarySkeleton />
        ) : summaryQuery.isError ? (
          <SectionError error={summaryQuery.error} onRetry={() => summaryQuery.refetch()} />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {summaryQuery.data.map((grade) => (
              <li
                key={grade.name}
                className="flex items-center gap-2 bg-curtain px-3 py-2 text-xs ring-1 ring-inset ring-mist/20"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: getSeatGradeColor(grade.name) }}
                />
                <span className="font-semibold text-chalk">{grade.name}</span>
                <span className="text-mist/80">{grade.price.toLocaleString('ko-KR')}원</span>
                <span className="text-mist/60">
                  잔여 {grade.remaining}/{grade.total}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 배치도 — summary와 별개 쿼리라 독립적으로 로딩/에러/성공 상태를 갖는다. */}
      <section className="mb-6 bg-curtain p-4 ring-1 ring-inset ring-mist/10 sm:p-6">
        {seatMapQuery.isPending ? (
          <SeatMapSkeleton />
        ) : seatMapQuery.isError ? (
          <SectionError error={seatMapQuery.error} onRetry={() => seatMapQuery.refetch()} />
        ) : (
          <>
            <SeatMap
              seats={seatMapQuery.data}
              selectedSeatIds={displaySeatIds}
              onToggleSeat={handleToggleSeat}
            />
            <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-mist/80">
              {[...gradePriceByName.keys()].map((name) => (
                <li key={name} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: getSeatGradeColor(name) }}
                  />
                  {name}
                </li>
              ))}
              <li className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: SEAT_STATUS_COLOR.selected }}
                />
                {hasActiveHold ? '내가 선점한 좌석' : '선택됨'}
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-sm opacity-55"
                  style={{ backgroundColor: SEAT_STATUS_COLOR.sold }}
                />
                판매완료
              </li>
            </ul>
          </>
        )}
      </section>

      {/* 선택/선점 요약 + CTA — 선점 전에는 좌석 선택 상한 안내, 선점 후에는 만료 타이머와 확정 버튼. */}
      <section className="sticky bottom-4 bg-curtain px-4 py-4 shadow-lg shadow-black/40 ring-1 ring-inset ring-mist/20 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            {hasActiveHold ? (
              <>
                <p className="text-sm text-chalk">
                  선점 좌석 <span className="font-bold text-marquee">{displaySeats.length}석</span>
                </p>
                <div className="mt-1">
                  <HoldTimer remainingSec={countdown.remainingSec} isWarning={countdown.isWarning} />
                </div>
              </>
            ) : (
              <p className="text-sm text-chalk">
                선택 좌석{' '}
                <span className="font-bold text-marquee">
                  {displaySeats.length}/{MAX_SELECTABLE_SEATS}
                </span>
              </p>
            )}

            {displaySeats.length > 0 ? (
              <p className="mt-1 text-xs text-mist/80">
                {displaySeats
                  .map((seat) => `${seat.section} ${seat.rowLabel}${seat.seatNumber}`)
                  .join(', ')}
              </p>
            ) : (
              !hasActiveHold && <p className="mt-1 text-xs text-mist/60">좌석을 선택해주세요.</p>
            )}

            {limitWarning && (
              <p className="mt-1 text-xs text-encore">
                최대 {MAX_SELECTABLE_SEATS}석까지 선택할 수 있어요.
              </p>
            )}
            {holdMutation.isError && (
              <p className="mt-1 text-xs text-encore">
                {mutationErrorMessage(holdMutation.error, '좌석 선점 중 오류가 발생했습니다.')}
              </p>
            )}
            {confirmMutation.isError && (
              <p className="mt-1 text-xs text-encore">
                {mutationErrorMessage(confirmMutation.error, '예매 확정 중 오류가 발생했습니다.')}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <p className="text-lg font-bold text-marquee">{totalPrice.toLocaleString('ko-KR')}원</p>

            {hasActiveHold ? (
              <>
                <button
                  type="button"
                  onClick={handleReleaseClick}
                  disabled={releaseMutation.isPending || confirmMutation.isPending}
                  className="rounded-full border border-mist/40 px-4 py-2 text-sm font-medium text-mist transition-colors hover:bg-curtain-light disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {releaseMutation.isPending ? '취소 중...' : '선점 취소'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClick}
                  disabled={confirmMutation.isPending || countdown.isConfirmLocked}
                  className="rounded-full bg-marquee px-5 py-2 text-sm font-bold text-void transition-colors hover:bg-marquee-dim disabled:cursor-not-allowed disabled:bg-curtain-light disabled:text-mist/60 disabled:ring-1 disabled:ring-inset disabled:ring-mist/20"
                >
                  {confirmMutation.isPending ? '예매 확정 중...' : '예매 확정하기'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleHoldClick}
                disabled={displaySeats.length === 0 || holdMutation.isPending}
                className="rounded-full bg-marquee px-5 py-2 text-sm font-bold text-void transition-colors hover:bg-marquee-dim disabled:cursor-not-allowed disabled:bg-curtain-light disabled:text-mist/60 disabled:ring-1 disabled:ring-inset disabled:ring-mist/20"
              >
                {holdMutation.isPending ? '선점 중...' : '선점하기'}
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
