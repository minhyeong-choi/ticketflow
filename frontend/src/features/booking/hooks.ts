import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import { bookingApi } from './api'
import { useHoldStore } from './store'
import type { ConfirmBookingRequest, HoldSeatsRequest, HoldSnapshot, ReleaseSeatsRequest } from './types'

// 만료 60초 전 경고(FRONTEND.md 5절②). 확정 버튼은 그보다 더 일찍 잠가 INV-2(락 잔여 시간 ≥ 결제
// 처리 여유)를 지킨다 — 결제가 단일 요청(U5)이라 실제 위험은 작지만, 왕복 지연이 남은 시간보다
// 커지는 경계 구간에서 "확정 버튼 눌렀는데 서버가 이미 만료 처리" 상황을 줄이기 위한 최소 여유다.
const HOLD_WARNING_THRESHOLD_SEC = 60
const HOLD_CONFIRM_LOCK_MARGIN_SEC = 5

// 좌석 선점/해제/확정은 자동 재시도 금지(FRONTEND.md 5절④) — 아래 세 mutation 모두 retry:0을 고정한다.

export function useHoldSeats() {
  const setHold = useHoldStore((s) => s.setHold)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: HoldSeatsRequest) => bookingApi.hold(body),
    retry: 0,
    onSuccess: ({ data, response }, variables) => {
      // 카운트다운은 클라이언트 시계가 아니라 서버 절대 시각 기준이어야 한다 — 응답의 Date 헤더로
      // 시계 오프셋을 1회 보정한다(FRONTEND.md 5절②). 헤더가 없으면(프록시가 제거하는 경우 등)
      // 오프셋 0으로 폴백한다.
      const dateHeader = response.headers.get('date')
      const clockOffsetMs = dateHeader ? Date.now() - new Date(dateHeader).getTime() : 0

      setHold({
        sessionId: variables.sessionId,
        sessionSeatIds: data.sessionSeatIds,
        holdExpiresAt: data.holdExpiresAt,
        clockOffsetMs,
        idempotencyKey: crypto.randomUUID(),
      })
    },
    onError: (_error, variables) => {
      // SEAT_ALREADY_BOOKED/HELD 등 다른 사람이 채간 좌석 상태를 배치도에 즉시 반영한다.
      queryClient.invalidateQueries({ queryKey: queryKeys.catalog.seatMap(variables.sessionId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.catalog.seatSummary(variables.sessionId) })
    },
  })
}

export function useReleaseSeats() {
  const clearHold = useHoldStore((s) => s.clearHold)

  return useMutation({
    mutationFn: (body: ReleaseSeatsRequest) => bookingApi.release(body),
    retry: 0,
    // 서버 응답과 무관하게 클라이언트 선점 상태는 정리한다 — 최종 안전장치는 서버 TTL이다.
    onSettled: () => clearHold(),
  })
}

export function useConfirmBooking() {
  const clearHold = useHoldStore((s) => s.clearHold)

  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: ConfirmBookingRequest; idempotencyKey: string }) =>
      bookingApi.confirm(body, idempotencyKey),
    retry: 0,
    onSuccess: () => clearHold(),
  })
}

interface HoldCountdown {
  remainingSec: number
  isWarning: boolean
  isConfirmLocked: boolean
}

// hold가 없으면(선점 전/해제/만료 후) 타이머를 돌리지 않는다.
export function useHoldCountdown(hold: HoldSnapshot | null): HoldCountdown {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!hold) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [hold])

  if (!hold) {
    return { remainingSec: 0, isWarning: false, isConfirmLocked: true }
  }

  // 남은시간 = holdExpiresAt - now + clockOffsetMs (FRONTEND.md 5절② 공식 그대로).
  const remainingMs = new Date(hold.holdExpiresAt).getTime() - now + hold.clockOffsetMs
  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000))

  return {
    remainingSec,
    isWarning: remainingSec > 0 && remainingSec <= HOLD_WARNING_THRESHOLD_SEC,
    isConfirmLocked: remainingSec <= HOLD_CONFIRM_LOCK_MARGIN_SEC,
  }
}
