import { useState } from 'react'
import { PosterPlaceholder } from '../../../components/PosterPlaceholder'
import { formatDateRange, formatPriceRange } from '../../../lib/format'
import { GENRE_LABEL, GENRE_STYLE, STATUS_LABEL, STATUS_STYLE } from '../labels'
import type { PerformanceSummary } from '../types'

interface PerformanceCardProps {
  performance: PerformanceSummary
}

export function PerformanceCard({ performance }: PerformanceCardProps) {
  const isClosed = performance.status === 'CLOSED'
  const [imageFailed, setImageFailed] = useState(false)
  const hasImage = performance.posterImageUrl !== '' && !imageFailed

  return (
    <article
      className={`group flex flex-col overflow-hidden bg-curtain shadow-lg shadow-black/30 ring-1 ring-white/5 transition-all duration-200 [clip-path:polygon(0_0,calc(100%-16px)_0,100%_16px,100%_100%,0_100%)] ${
        isClosed
          ? 'opacity-60'
          : 'hover:-translate-y-1 hover:shadow-xl hover:shadow-marquee/10 hover:ring-marquee/25'
      }`}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-curtain-light">
        {hasImage ? (
          <img
            src={performance.posterImageUrl}
            alt={performance.title}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className={`h-full w-full object-cover transition-transform duration-500 ease-out ${
              isClosed ? 'grayscale' : 'group-hover:scale-110'
            }`}
          />
        ) : (
          <PosterPlaceholder
            title={performance.title}
            genre={performance.genre}
            variant="card"
            className={`transition-transform duration-500 ease-out ${
              isClosed ? 'grayscale' : 'group-hover:scale-110'
            }`}
          />
        )}
        <span
          className={`absolute left-2 top-2 rounded-sm px-2 py-1 text-xs font-bold ${STATUS_STYLE[performance.status]}`}
        >
          {STATUS_LABEL[performance.status]}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 border-t border-dashed border-mist/25 p-4 sm:p-5">
        <span
          className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${GENRE_STYLE[performance.genre]}`}
        >
          {GENRE_LABEL[performance.genre]}
        </span>

        <h3 className="line-clamp-2 text-lg font-extrabold leading-tight text-chalk">
          {performance.title}
        </h3>

        <div className="space-y-0.5">
          <p className="line-clamp-1 text-sm font-medium text-chalk/75">
            {performance.venueName}
          </p>
          <p className="font-label text-xs tracking-wide text-mist/80">
            {formatDateRange(performance.periodStart, performance.periodEnd)}
          </p>
        </div>

        <p className="mt-auto pt-2 text-sm font-bold text-marquee">
          {formatPriceRange(performance.minPrice, performance.maxPrice)}
        </p>
      </div>
    </article>
  )
}
