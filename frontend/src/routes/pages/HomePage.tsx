import { useState } from 'react'
import { HeroCarousel } from '../../features/catalog/components/HeroCarousel'
import { usePerformances } from '../../features/catalog/hooks'
import { PerformanceCard } from '../../features/catalog/components/PerformanceCard'
import type { PerformanceStatus } from '../../features/catalog/types'

// 예매 가능한 공연을 먼저 보여준다: 진행중 > 오픈 예정 > 종료.
const STATUS_ORDER: Record<PerformanceStatus, number> = {
  ON_SALE: 0,
  SCHEDULED: 1,
  CLOSED: 2,
}

const HERO_SLIDE_COUNT = 5

type StatusFilter = 'ALL' | PerformanceStatus

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'ON_SALE', label: '예매중' },
  { key: 'SCHEDULED', label: '오픈 예정' },
  { key: 'CLOSED', label: '예매 종료' },
]

function HomePageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <p className="font-label text-sm text-mist">공연 목록을 불러오는 중...</p>
    </div>
  )
}

function HomePageError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <p className="text-sm text-encore">공연 목록을 불러오지 못했습니다.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-full border border-marquee/50 px-4 py-2 text-sm font-medium text-marquee hover:bg-marquee/10"
      >
        다시 시도
      </button>
    </div>
  )
}

export function HomePage() {
  const { data: performances, isPending, isError, refetch } = usePerformances()
  const [filter, setFilter] = useState<StatusFilter>('ALL')

  if (isPending) return <HomePageSkeleton />
  if (isError) return <HomePageError onRetry={() => refetch()} />

  if (performances.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-sm text-mist">현재 예매 가능한 공연이 없습니다.</p>
      </div>
    )
  }

  const onSalePerformances = performances.filter((p) => p.status === 'ON_SALE')
  const sortedPerformances = [...performances].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  )
  // 히어로는 예매중 공연 위주로 순환한다. 예매중 공연이 없으면(전부 오픈예정/종료) 목록 상단으로 대체한다.
  const heroSlides = (onSalePerformances.length > 0 ? onSalePerformances : sortedPerformances).slice(
    0,
    HERO_SLIDE_COUNT,
  )

  // 탭별 건수 — 정렬된 목록 기준으로 세되, 필터링 시에도 진행중 > 오픈예정 > 종료 순서는 그대로 유지한다.
  const statusCounts: Record<StatusFilter, number> = {
    ALL: performances.length,
    ON_SALE: onSalePerformances.length,
    SCHEDULED: performances.filter((p) => p.status === 'SCHEDULED').length,
    CLOSED: performances.filter((p) => p.status === 'CLOSED').length,
  }
  const filteredPerformances =
    filter === 'ALL' ? sortedPerformances : sortedPerformances.filter((p) => p.status === filter)

  return (
    <main>
      <HeroCarousel performances={heroSlides} />

      <div id="performance-list" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-label text-xs font-medium uppercase tracking-[0.25em] text-marquee">
              All Shows
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-chalk sm:text-3xl">
              예매 가능한 공연
            </h1>
            <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="공연 상태 필터">
              {FILTER_TABS.map((tab) => {
                const isActive = filter === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setFilter(tab.key)}
                    className={`font-label rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors sm:text-sm ${
                      isActive
                        ? 'bg-marquee/15 text-marquee ring-1 ring-inset ring-marquee/40'
                        : 'text-mist ring-1 ring-inset ring-white/10 hover:text-chalk hover:ring-white/20'
                    }`}
                  >
                    {tab.label} {statusCounts[tab.key]}
                  </button>
                )
              })}
            </div>
          </div>
          <span className="font-label text-sm font-normal text-mist">
            총 {performances.length}건
          </span>
        </div>

        {filteredPerformances.length === 0 ? (
          <p className="py-16 text-center text-sm text-mist">해당 조건의 공연이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-3 lg:grid-cols-4">
            {filteredPerformances.map((performance) => (
              <PerformanceCard key={performance.id} performance={performance} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
