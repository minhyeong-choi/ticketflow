import { useLocation } from 'react-router-dom'
import { LoginForm } from '@/features/auth/components/LoginForm'

export function LoginPage() {
  const location = useLocation()
  const signedUp = (location.state as { signedUp?: boolean } | null)?.signedUp

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="font-display mb-8 text-center text-2xl text-chalk">로그인</h1>
      {signedUp && (
        <p className="mb-4 rounded-md bg-marquee/10 px-3.5 py-2.5 text-center text-sm text-marquee">
          회원가입이 완료되었습니다. 로그인해주세요.
        </p>
      )}
      <LoginForm />
    </main>
  )
}
