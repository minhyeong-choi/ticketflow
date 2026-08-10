import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '@/api/types'
import { getErrorMessage } from '@/lib/errorMessages'
import { saveEntryToken, useEnterWaiting, useLeaveWaiting, useWaitingStatus } from '@/features/waiting/hooks'

function InlineError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof ApiError ? getErrorMessage(error) : '알 수 없는 오류가 발생했습니다.'
  return (
    <div className="flex flex-col items-center gap-3 bg-curtain-light/40 px-6 py-8 text-center ring-1 ring-inset ring-mist/10">
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

export function WaitingRoomPage() {
  const { id } = useParams<{ id: string }>()
  const sessionId = Number(id)
  const navigate = useNavigate()

  // 대기열 진입(enter)은 query다 — mount 시 mutation을 useEffect에서 실행하는 흔한 패턴은 StrictMode의
  // 개발 모드 이중 mount와 부딪혀 요청이 응답을 받고도 화면에 반영되지 않는 문제가 실측으로 확인됐다
  // (hooks.ts 주석 참고). enter는 이미 대기열에 있으면 현재 상태를 그대로 반환하는 멱등 동작이라 query로
  // 다뤄도 안전하다.
  const enterQuery = useEnterWaiting(sessionId)
  const [abandoned, setAbandoned] = useState(false)
  const shouldPoll = !abandoned && enterQuery.data?.status === 'WAITING'
  const statusQuery = useWaitingStatus(sessionId, shouldPoll)
  const leaveMutation = useLeaveWaiting(sessionId)

  const status = statusQuery.data ?? enterQuery.data

  useEffect(() => {
    if (!abandoned && status?.status === 'ENTERED') {
      saveEntryToken(sessionId, status.entryToken)
      navigate(`/sessions/${sessionId}/seats`, { replace: true })
    }
  }, [abandoned, status, sessionId, navigate])

  function handleLeave() {
    setAbandoned(true)
    leaveMutation.mutate(undefined, {
      onSuccess: () => navigate('/'),
      onError: () => setAbandoned(false),
    })
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

  // 401(FRONTEND.md 5절⑤): 대기 중 토큰이 만료되면 폴링이 조용히 끊기지 않도록 별도 안내를 명확히 노출한다.
  const authExpiredError = [enterQuery.error, statusQuery.error].find(
    (error) => error instanceof ApiError && error.httpStatus === 401,
  )

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 text-center">
        <span className="font-label text-xs font-medium uppercase tracking-[0.3em] text-marquee">
          Step 3
        </span>
        <h1 className="font-display text-2xl text-chalk">가상 대기실</h1>
      </header>

      {authExpiredError ? (
        <div className="flex flex-col items-center gap-4 bg-curtain-light/40 px-6 py-10 text-center ring-1 ring-inset ring-mist/10">
          <p className="text-sm text-encore">
            로그인 세션이 만료되었습니다. 재로그인 후 대기열에 처음부터 다시 입장해야 합니다.
          </p>
          <Link
            to="/login"
            className="rounded-full bg-marquee px-5 py-2 text-sm font-bold text-void transition-colors hover:bg-marquee-dim"
          >
            다시 로그인하기
          </Link>
        </div>
      ) : enterQuery.isError ? (
        <InlineError error={enterQuery.error} onRetry={() => enterQuery.refetch()} />
      ) : statusQuery.isError ? (
        <InlineError error={statusQuery.error} onRetry={() => statusQuery.refetch()} />
      ) : status?.status === 'ENTERED' ? (
        <div className="flex flex-col items-center gap-3 bg-curtain-light/40 px-6 py-10 text-center ring-1 ring-inset ring-mist/10">
          <p className="text-sm text-chalk">입장이 허용되었습니다. 좌석 선택 화면으로 이동합니다...</p>
        </div>
      ) : status?.status === 'WAITING' ? (
        <div className="flex flex-col items-center gap-6 bg-curtain-light/40 px-6 py-10 text-center ring-1 ring-inset ring-mist/10">
          <div>
            <p className="font-label text-xs uppercase tracking-widest text-mist">현재 나의 대기 순번</p>
            <p className="mt-2 font-display text-5xl text-marquee">{status.rank}</p>
            <p className="mt-1 text-xs text-mist/80">번째</p>
          </div>

          <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-curtain">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-marquee" />
          </div>

          <p className="text-sm text-chalk/80">
            순서대로 자동 입장됩니다. 완료되면 좌석 선택 화면으로 바로 이동해요.
          </p>

          <p className="rounded-sm bg-void/40 px-3 py-2 text-xs text-mist ring-1 ring-inset ring-mist/20">
            이 탭을 닫거나 백그라운드로 오래 두면 순번을 잃을 수 있습니다. 이 탭을 열어두세요.
          </p>

          <button
            type="button"
            onClick={handleLeave}
            disabled={leaveMutation.isPending}
            className="rounded-full border border-mist/40 px-5 py-2 text-sm font-medium text-mist transition-colors hover:bg-curtain-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            {leaveMutation.isPending ? '대기 취소 중...' : '대기 포기'}
          </button>

          {leaveMutation.isError && (
            <p className="text-xs text-encore">
              {leaveMutation.error instanceof ApiError
                ? getErrorMessage(leaveMutation.error)
                : '대기 포기 처리 중 오류가 발생했습니다.'}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 bg-curtain-light/40 px-6 py-10 text-center ring-1 ring-inset ring-mist/10">
          <p className="text-sm text-mist">대기열 확인 중...</p>
        </div>
      )}
    </main>
  )
}
