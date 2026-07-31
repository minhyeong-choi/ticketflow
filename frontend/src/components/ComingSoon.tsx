interface ComingSoonProps {
  title: string
  description?: string
}

// 미구현 라우트 공용 스텁 — 라우트 뼈대만 먼저 깔고 실제 화면은 이후 주차에 채운다.
export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-3 px-4 text-center">
      <span className="font-label text-xs font-medium uppercase tracking-[0.3em] text-marquee">
        Coming Soon
      </span>
      <h1 className="font-display text-2xl text-chalk">{title}</h1>
      {description && <p className="text-sm text-mist">{description}</p>}
    </main>
  )
}
