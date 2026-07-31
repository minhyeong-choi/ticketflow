import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate, Link } from 'react-router-dom'
import { z } from 'zod'
import { ApiError } from '@/api/types'
import { getErrorMessage } from '@/lib/errorMessages'
import { useSignup } from '../hooks'

const signupSchema = z
  .object({
    name: z.string().min(1, '이름을 입력해주세요.'),
    email: z.string().min(1, '이메일을 입력해주세요.').email('올바른 이메일 형식이 아닙니다.'),
    password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
    passwordConfirm: z.string().min(1, '비밀번호를 다시 입력해주세요.'),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['passwordConfirm'],
  })

type SignupFormValues = z.infer<typeof signupSchema>

export function SignupForm() {
  const navigate = useNavigate()
  const signup = useSignup()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({ resolver: zodResolver(signupSchema) })

  const onSubmit = handleSubmit(({ passwordConfirm: _passwordConfirm, ...payload }) => {
    signup.mutate(payload, {
      onSuccess: () => {
        navigate('/login', { replace: true, state: { signedUp: true } })
      },
    })
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="font-label text-xs uppercase tracking-wide text-mist">
          이름
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          className="rounded-md border border-mist/30 bg-curtain-light px-3.5 py-2.5 text-sm text-chalk outline-none focus:border-marquee"
          {...register('name')}
        />
        {errors.name && <p className="text-xs text-encore">{errors.name.message}</p>}
      </div>

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
          autoComplete="new-password"
          className="rounded-md border border-mist/30 bg-curtain-light px-3.5 py-2.5 text-sm text-chalk outline-none focus:border-marquee"
          {...register('password')}
        />
        {errors.password && <p className="text-xs text-encore">{errors.password.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="passwordConfirm" className="font-label text-xs uppercase tracking-wide text-mist">
          비밀번호 확인
        </label>
        <input
          id="passwordConfirm"
          type="password"
          autoComplete="new-password"
          className="rounded-md border border-mist/30 bg-curtain-light px-3.5 py-2.5 text-sm text-chalk outline-none focus:border-marquee"
          {...register('passwordConfirm')}
        />
        {errors.passwordConfirm && <p className="text-xs text-encore">{errors.passwordConfirm.message}</p>}
      </div>

      {signup.isError && (
        <p className="text-sm text-encore">
          {signup.error instanceof ApiError ? getErrorMessage(signup.error) : '회원가입에 실패했습니다.'}
        </p>
      )}

      <button
        type="submit"
        disabled={signup.isPending}
        className="mt-2 rounded-full bg-marquee px-6 py-3 text-sm font-bold text-void transition-colors hover:bg-marquee-dim disabled:cursor-not-allowed disabled:opacity-60"
      >
        {signup.isPending ? '가입 중...' : '회원가입'}
      </button>

      <p className="text-center text-sm text-mist">
        이미 계정이 있으신가요?{' '}
        <Link to="/login" className="font-semibold text-marquee hover:underline">
          로그인
        </Link>
      </p>
    </form>
  )
}
