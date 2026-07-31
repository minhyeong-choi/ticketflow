import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-3 px-4 text-center">
      <span className="font-label text-xs font-medium uppercase tracking-[0.3em] text-marquee">404</span>
      <h1 className="font-display text-2xl text-chalk">페이지를 찾을 수 없습니다.</h1>
      <Link to="/" className="mt-4 rounded-full bg-marquee px-6 py-3 text-sm font-bold text-void hover:bg-marquee-dim">
        홈으로 돌아가기
      </Link>
    </main>
  )
}
