import { Link, useParams } from 'react-router-dom'
import { useState } from 'react'
import { ApiError } from '@/api/types'
import { PosterPlaceholder } from '@/components/PosterPlaceholder'
import { getErrorMessage } from '@/lib/errorMessages'
import { formatPriceRange, formatSessionDateTime } from '@/lib/format'
import {
  GENRE_LABEL,
  GENRE_STYLE,
  SESSION_STATUS_LABEL,
  SESSION_STATUS_STYLE,
  STATUS_LABEL,
  STATUS_STYLE,
} from '@/features/catalog/labels'
import { usePerformanceDetail } from '@/features/catalog/hooks'
import type { SessionSummary } from '@/features/catalog/types'

function DetailSkeleton() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <p className="font-label text-sm text-mist">공연 정보를 불러오는 중...</p>
    </main>
  )
}

function DetailError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const notFound = error instanceof ApiError && error.httpStatus === 404
  const message = error instanceof ApiError ? getErrorMessage(error) : '공연 정보를 불러오지 못했습니다.'

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm text-encore">{message}</p>
      {notFound ? (
        <Link
          to="/"
          className="rounded-full border border-marquee/50 px-4 py-2 text-sm font-medium text-marquee hover:bg-marquee/10"
        >
          목록으로 돌아가기
        </Link>
      ) : (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-marquee/50 px-4 py-2 text-sm font-medium text-marquee hover:bg-marquee/10"
        >
          다시 시도
        </button>
      )}
    </main>
  )
}

function SessionRow({ sessionId, session }: { sessionId: number; session: SessionSummary }) {
  const bookable = session.status === 'ON_SALE'

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-mist/20 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-chalk">{formatSessionDateTime(session.sessionAt)}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SESSION_STATUS_STYLE[session.status]}`}
        >
          {SESSION_STATUS_LABEL[session.status]}
        </span>
      </div>
      {bookable ? (
        <Link
          to={`/sessions/${sessionId}/waiting`}
          className="rounded-full bg-marquee px-4 py-1.5 text-xs font-bold text-void transition-colors hover:bg-marquee-dim"
        >
          좌석 선택
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-full bg-curtain-light px-4 py-1.5 text-xs font-bold text-mist/60 ring-1 ring-inset ring-mist/20"
        >
          좌석 선택
        </button>
      )}
    </li>
  )
}

export function PerformanceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const performanceId = Number(id)
  const { data: performance, isPending, isError, error, refetch } = usePerformanceDetail(performanceId)
  const [imageFailed, setImageFailed] = useState(false)

  if (isPending) return <DetailSkeleton />
  if (isError) return <DetailError error={error} onRetry={() => refetch()} />

  const hasImage = performance.posterImageUrl !== '' && !imageFailed

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 sm:grid-cols-[minmax(0,280px)_1fr]">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-curtain-light shadow-lg shadow-black/30 ring-1 ring-white/5">
          {hasImage ? (
            <img
              src={performance.posterImageUrl}
              alt={performance.title}
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <PosterPlaceholder title={performance.title} genre={performance.genre} variant="card" />
          )}
          <span
            className={`absolute left-2 top-2 rounded-sm px-2 py-1 text-xs font-bold ${STATUS_STYLE[performance.status]}`}
          >
            {STATUS_LABEL[performance.status]}
          </span>
        </div>

        <div className="flex flex-col gap-4">
          <span
            className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${GENRE_STYLE[performance.genre]}`}
          >
            {GENRE_LABEL[performance.genre]}
          </span>

          <h1 className="font-display text-2xl leading-tight text-chalk sm:text-3xl">{performance.title}</h1>

          <div className="space-y-1 text-sm text-chalk/80">
            <p>{performance.venueName}</p>
            <p className="text-mist/80">러닝타임 {performance.runningTimeMinutes}분</p>
          </div>

          <p className="text-lg font-bold text-marquee">
            {formatPriceRange(performance.minPrice, performance.maxPrice)}
          </p>

          <p className="whitespace-pre-line text-sm leading-relaxed text-chalk/75">{performance.description}</p>

          <div>
            <h2 className="font-label text-xs font-semibold uppercase tracking-wide text-mist">좌석 등급</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {performance.seatGrades.map((grade) => (
                <li
                  key={grade.name}
                  className="rounded-sm bg-curtain px-3 py-1.5 text-xs text-chalk ring-1 ring-inset ring-mist/20"
                >
                  <span className="font-semibold">{grade.name}</span>{' '}
                  <span className="text-mist/80">{grade.price.toLocaleString('ko-KR')}원</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold text-chalk">회차 선택</h2>
        {performance.sessions.length === 0 ? (
          <p className="py-8 text-center text-sm text-mist">등록된 회차가 없습니다.</p>
        ) : (
          <ul className="bg-curtain px-4 ring-1 ring-inset ring-mist/10 sm:px-5">
            {performance.sessions.map((session) => (
              <SessionRow key={session.id} sessionId={session.id} session={session} />
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
