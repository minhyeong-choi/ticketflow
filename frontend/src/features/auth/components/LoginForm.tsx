import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { z } from 'zod'
import { ApiError } from '@/api/types'
import { getErrorMessage } from '@/lib/errorMessages'
import { useLogin } from '../hooks'

const loginSchema = z.object({
  email: z.string().min(1, '이메일을 입력해주세요.').email('올바른 이메일 형식이 아닙니다.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useLogin()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: () => {
        const redirectTo = (location.state as { from?: string } | null)?.from ?? '/'
        navigate(redirectTo, { replace: true })
      },
    })
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="font-label text-xs uppercase tracking-wide text-mist">
          이메일
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="rounded-md border border-mist/30 bg-curtain-light px-3.5 py-2.5 text-sm text-chalk outline-none focus:border-marquee"
          {...register('email')}
        />
        {errors.email && <p className="text-xs text-encore">{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="font-label text-xs uppercase tracking-wide text-mist">
          비밀번호
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="rounded-md border border-mist/30 bg-curtain-light px-3.5 py-2.5 text-sm text-chalk outline-none focus:border-marquee"
          {...register('password')}
        />
        {errors.password && <p className="text-xs text-encore">{errors.password.message}</p>}
      </div>

      {login.isError && (
        <p className="text-sm text-encore">
          {login.error instanceof ApiError ? getErrorMessage(login.error) : '로그인에 실패했습니다.'}
        </p>
      )}

      <button
        type="submit"
        disabled={login.isPending}
        className="mt-2 rounded-full bg-marquee px-6 py-3 text-sm font-bold text-void transition-colors hover:bg-marquee-dim disabled:cursor-not-allowed disabled:opacity-60"
      >
        {login.isPending ? '로그인 중...' : '로그인'}
      </button>

      <p className="text-center text-sm text-mist">
        아직 계정이 없으신가요?{' '}
        <Link to="/signup" className="font-semibold text-marquee hover:underline">
          회원가입
        </Link>
      </p>
    </form>
  )
}
