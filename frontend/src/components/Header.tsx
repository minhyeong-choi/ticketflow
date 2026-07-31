import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/store'

export function Header() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-10 border-b border-marquee/15 bg-curtain/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <Link to="/" className="group flex items-center gap-2.5">
          <svg
            aria-hidden="true"
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            className="shrink-0 text-marquee transition-transform duration-200 group-hover:-rotate-6"
          >
            <path
              d="M4 10.5c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v1a2 2 0 0 0 0 3.9v1.1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.1a2 2 0 0 0 0-3.9z"
              fill="currentColor"
            />
            <circle cx="18.5" cy="14" r="1.6" fill="var(--color-curtain)" />
            <circle cx="13.5" cy="14" r="1.6" fill="var(--color-curtain)" />
          </svg>
          <span className="text-lg font-semibold tracking-tight text-chalk">
            ticket<span className="font-display font-normal text-marquee">Flow</span>
          </span>
        </Link>

        <nav className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link to="/mypage/bookings" className="text-mist transition-colors hover:text-chalk">
                {user.name}님
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-marquee/50 px-3.5 py-1.5 font-medium text-marquee transition-colors hover:bg-marquee/10"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-mist transition-colors hover:text-chalk">
                로그인
              </Link>
              <Link
                to="/signup"
                className="rounded-full border border-marquee/50 px-3.5 py-1.5 font-medium text-marquee transition-colors hover:bg-marquee/10"
              >
                회원가입
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
