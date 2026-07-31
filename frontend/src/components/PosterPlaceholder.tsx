// picsum 등 외부 랜덤 이미지 대신, 장르 톤 + 타이틀 첫 글자로 만드는 자체 포스터 플레이스홀더.
// 실 포스터 이미지 API(SP2)가 들어오기 전까지 카드/히어로 티켓에서 공통으로 사용한다.
type PosterGenre = 'CONCERT' | 'MUSICAL' | 'PLAY'

const ACCENT: Record<PosterGenre, string> = {
  CONCERT: 'var(--color-marquee)',
  MUSICAL: 'var(--color-encore)',
  PLAY: 'var(--color-paper)',
}

interface PosterPlaceholderProps {
  title: string
  genre: PosterGenre
  variant?: 'card' | 'thumbnail'
  className?: string
}

export function PosterPlaceholder({
  title,
  genre,
  variant = 'card',
  className = '',
}: PosterPlaceholderProps) {
  const glyph = Array.from(title.trim())[0] ?? '?'
  const accent = ACCENT[genre]

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-[linear-gradient(155deg,var(--color-curtain-light)_0%,var(--color-curtain)_55%,var(--color-void)_100%)] ${className}`}
    >
      {/* 마퀴 전구 도트 텍스처 — 히어로 상단 전구줄과 같은 언어를 카드 안에서도 저강도로 반복 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle,var(--color-chalk)_1px,transparent_1.4px)] [background-size:14px_14px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(55% 55% at 50% 42%, color-mix(in srgb, ${accent} 35%, transparent), transparent 70%)`,
        }}
      />
      <span
        aria-hidden="true"
        className={`font-display relative select-none leading-none ${
          variant === 'card' ? 'text-6xl' : 'text-2xl'
        }`}
        style={{ color: accent }}
      >
        {glyph}
      </span>
    </div>
  )
}
