import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { formatDateRange } from '@/lib/format'
import { GENRE_LABEL } from '../labels'
import type { PerformanceSummary } from '../types'

const AUTOPLAY_MS = 5500

// PerformanceSummary에는 아직 마케팅 소개문구 필드가 없다(백엔드 계약 미정 — description 필드 요청 대상).
// 실 필드가 생기기 전까지는 장르별 고정 카피로 대체한다.
const GENRE_TAGLINE: Record<PerformanceSummary['genre'], string> = {
  CONCERT: '잊을 수 없는 무대, 지금 이 순간을 함께하세요.',
  MUSICAL: '화려한 무대와 감동의 서사가 펼쳐집니다.',
  PLAY: '배우들의 숨결을 가장 가까이서 만나보세요.',
}

interface HeroCarouselProps {
  performances: PerformanceSummary[]
}

export function HeroCarousel({ performances }: HeroCarouselProps) {
  const [index, setIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const prefersReducedMotionRef = useRef(false)
  const count = performances.length

  useEffect(() => {
    prefersReducedMotionRef.current =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  }, [])

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return
      setIndex(((next % count) + count) % count)
    },
    [count],
  )

  useEffect(() => {
    if (isPaused || prefersReducedMotionRef.current || count <= 1) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count)
    }, AUTOPLAY_MS)
    return () => window.clearInterval(timer)
  }, [isPaused, count])

  // 단독판매 뱃지 기준(데모용 임의 기준): 슬라이드 중 최고가(maxPrice) 좌석을 보유한 공연.
  // 실제로는 백엔드에 "단독/독점 판매" 여부 필드가 없어 임시로 가격만으로 근사한다.
  const exclusiveId = useMemo(
    () =>
      count > 0 ? performances.reduce((best, p) => (p.maxPrice > best.maxPrice ? p : best)).id : null,
    [performances, count],
  )
  // 마감임박 뱃지 기준(데모용 임의 기준): 슬라이드 중 공연 종료일(periodEnd)이 가장 빠른 공연.
  // 실제로는 잔여 좌석 수/서버가 계산한 D-day가 있어야 정확하지만 지금은 종료일로 근사한다.
  const closingSoonId = useMemo(
    () =>
      count > 0
        ? performances.reduce((best, p) => (p.periodEnd < best.periodEnd ? p : best)).id
        : null,
    [performances, count],
  )

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowRight') goTo(index + 1)
    if (e.key === 'ArrowLeft') goTo(index - 1)
  }

  if (count === 0) return null

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label="주요 공연"
      className="relative h-[440px] w-full overflow-hidden bg-void sm:h-[500px] lg:h-[580px]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onKeyDown={handleKeyDown}
    >
      {performances.map((performance, slideIndex) => {
        const isActive = slideIndex === index
        const badges = [
          performance.id === exclusiveId ? '단독판매' : null,
          performance.id === closingSoonId ? '마감임박' : null,
        ].filter((badge): badge is string => badge !== null)

        return (
          <div
            key={performance.id}
            aria-hidden={!isActive}
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${
              isActive ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            {/* 배경 이미지는 장식용 — 제목/장르 등 동일 정보를 우측 텍스트가 이미 전달하므로 alt는 비운다. */}
            <img
              src={performance.posterImageUrl}
              alt=""
              loading={slideIndex === 0 ? 'eager' : 'lazy'}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-void via-void/60 to-void/10" />
            <div className="absolute inset-0 bg-gradient-to-r from-void/95 via-void/35 to-transparent" />

            <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end gap-3 px-4 pb-14 sm:px-6 lg:px-8">
              {badges.length > 0 && (
                <div className="flex gap-2">
                  {badges.map((badge) => (
                    <span
                      key={badge}
                      className="font-label w-fit rounded-sm bg-marquee px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-void"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              )}

              <p className="font-label text-xs font-medium uppercase tracking-[0.3em] text-mist">
                {GENRE_LABEL[performance.genre]}
              </p>

              <h2 className="font-display max-w-2xl text-3xl leading-[1.15] text-chalk sm:text-4xl lg:text-5xl">
                {performance.title}
              </h2>

              <p className="max-w-lg text-sm leading-relaxed text-mist sm:text-base">
                {GENRE_TAGLINE[performance.genre]}
              </p>

              <p className="font-label text-sm tracking-wide text-mist">
                {performance.venueName} ·{' '}
                {formatDateRange(performance.periodStart, performance.periodEnd)}
              </p>

              <div className="mt-2">
                <Link
                  to={`/performances/${performance.id}`}
                  className="inline-block rounded-full bg-marquee px-6 py-3 text-sm font-bold text-void transition-colors hover:bg-marquee-dim"
                >
                  예매하기
                </Link>
              </div>
            </div>
          </div>
        )
      })}

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="이전 공연"
            className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-void/70 p-2.5 text-chalk shadow-lg shadow-black/50 ring-1 ring-white/25 backdrop-blur-sm transition-colors hover:bg-void/95 hover:ring-white/40 sm:left-6"
          >
            <ArrowIcon direction="left" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="다음 공연"
            className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-void/70 p-2.5 text-chalk shadow-lg shadow-black/50 ring-1 ring-white/25 backdrop-blur-sm transition-colors hover:bg-void/95 hover:ring-white/40 sm:right-6"
          >
            <ArrowIcon direction="right" />
          </button>

          <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-full bg-void/45 px-3 py-2 shadow-lg shadow-black/40 ring-1 ring-white/15 backdrop-blur-sm">
            {performances.map((performance, dotIndex) => (
              <button
                key={performance.id}
                type="button"
                onClick={() => goTo(dotIndex)}
                aria-label={`${dotIndex + 1}번째 공연으로 이동`}
                aria-current={dotIndex === index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  dotIndex === index
                    ? 'w-6 bg-marquee shadow-[0_0_6px_rgba(242,183,5,0.8)]'
                    : 'w-1.5 bg-chalk/60 ring-1 ring-void/30 hover:bg-chalk/80'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
