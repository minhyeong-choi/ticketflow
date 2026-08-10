import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ApiError } from '@/api/types'
import { getErrorMessage } from '@/lib/errorMessages'
import { useAuthStore } from '@/features/auth/store'
import { useChangePassword, useUpdateProfile } from '@/features/auth/hooks'

const profileSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요.'),
  phone: z.string().optional(),
})
type ProfileFormValues = z.infer<typeof profileSchema>

// 백엔드 ChangePasswordRequest.newPassword는 최소 8자를 요구한다(SignupForm의 password 규칙과 동일).
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, '현재 비밀번호를 입력해주세요.'),
    newPassword: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
    newPasswordConfirm: z.string().min(1, '새 비밀번호를 다시 입력해주세요.'),
  })
  .refine((values) => values.newPassword === values.newPasswordConfirm, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['newPasswordConfirm'],
  })
type PasswordFormValues = z.infer<typeof passwordSchema>

function ProfileSection() {
  const user = useAuthStore((s) => s.user)
  const updateProfile = useUpdateProfile()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: { name: user?.name ?? '', phone: user?.phone ?? '' },
  })

  const onSubmit = handleSubmit((values) => {
    updateProfile.mutate(
      { name: values.name, phone: values.phone?.trim() ? values.phone.trim() : null },
      { onSuccess: (updated) => reset({ name: updated.name, phone: updated.phone ?? '' }) },
    )
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
          value={user?.email ?? ''}
          disabled
          className="cursor-not-allowed rounded-md border border-mist/20 bg-void/40 px-3.5 py-2.5 text-sm text-mist/70 outline-none"
        />
      </div>

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
        <label htmlFor="phone" className="font-label text-xs uppercase tracking-wide text-mist">
          전화번호
        </label>
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="010-1234-5678"
          className="rounded-md border border-mist/30 bg-curtain-light px-3.5 py-2.5 text-sm text-chalk outline-none focus:border-marquee"
          {...register('phone')}
        />
        {errors.phone && <p className="text-xs text-encore">{errors.phone.message}</p>}
      </div>

      {updateProfile.isError && (
        <p className="text-sm text-encore">
          {updateProfile.error instanceof ApiError
            ? getErrorMessage(updateProfile.error)
            : '회원정보 수정에 실패했습니다.'}
        </p>
      )}
      {updateProfile.isSuccess && <p className="text-sm text-marquee">저장되었습니다.</p>}

      <button
        type="submit"
        disabled={updateProfile.isPending || !isDirty}
        className="mt-1 w-fit rounded-full bg-marquee px-6 py-2.5 text-sm font-bold text-void transition-colors hover:bg-marquee-dim disabled:cursor-not-allowed disabled:opacity-60"
      >
        {updateProfile.isPending ? '저장 중...' : '저장'}
      </button>
    </form>
  )
}

function PasswordSection() {
  const changePassword = useChangePassword()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) })

  const onSubmit = handleSubmit(({ newPasswordConfirm: _newPasswordConfirm, ...payload }) => {
    changePassword.mutate(payload, { onSuccess: () => reset() })
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="currentPassword" className="font-label text-xs uppercase tracking-wide text-mist">
          현재 비밀번호
        </label>
        <input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          className="rounded-md border border-mist/30 bg-curtain-light px-3.5 py-2.5 text-sm text-chalk outline-none focus:border-marquee"
          {...register('currentPassword')}
        />
        {errors.currentPassword && <p className="text-xs text-encore">{errors.currentPassword.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="newPassword" className="font-label text-xs uppercase tracking-wide text-mist">
          새 비밀번호
        </label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          className="rounded-md border border-mist/30 bg-curtain-light px-3.5 py-2.5 text-sm text-chalk outline-none focus:border-marquee"
          {...register('newPassword')}
        />
        {errors.newPassword && <p className="text-xs text-encore">{errors.newPassword.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="newPasswordConfirm" className="font-label text-xs uppercase tracking-wide text-mist">
          새 비밀번호 확인
        </label>
        <input
          id="newPasswordConfirm"
          type="password"
          autoComplete="new-password"
          className="rounded-md border border-mist/30 bg-curtain-light px-3.5 py-2.5 text-sm text-chalk outline-none focus:border-marquee"
          {...register('newPasswordConfirm')}
        />
        {errors.newPasswordConfirm && <p className="text-xs text-encore">{errors.newPasswordConfirm.message}</p>}
      </div>

      {changePassword.isError && (
        <p className="text-sm text-encore">
          {changePassword.error instanceof ApiError
            ? getErrorMessage(changePassword.error)
            : '비밀번호 변경에 실패했습니다.'}
        </p>
      )}
      {changePassword.isSuccess && <p className="text-sm text-marquee">비밀번호가 변경되었습니다.</p>}

      <button
        type="submit"
        disabled={changePassword.isPending}
        className="mt-1 w-fit rounded-full bg-marquee px-6 py-2.5 text-sm font-bold text-void transition-colors hover:bg-marquee-dim disabled:cursor-not-allowed disabled:opacity-60"
      >
        {changePassword.isPending ? '변경 중...' : '비밀번호 변경'}
      </button>
    </form>
  )
}

export function ProfileEditPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <span className="font-label text-xs font-medium uppercase tracking-[0.3em] text-marquee">My Page</span>
        <h1 className="font-display text-2xl text-chalk">회원정보 수정</h1>
      </header>

      <section className="mb-10 bg-curtain p-6 ring-1 ring-inset ring-mist/10">
        <h2 className="mb-4 text-sm font-bold text-chalk">기본 정보</h2>
        <ProfileSection />
      </section>

      <section className="bg-curtain p-6 ring-1 ring-inset ring-mist/10">
        <h2 className="mb-4 text-sm font-bold text-chalk">비밀번호 변경</h2>
        <PasswordSection />
      </section>
    </main>
  )
}
