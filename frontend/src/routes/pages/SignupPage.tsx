import { SignupForm } from '@/features/auth/components/SignupForm'

export function SignupPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="font-display mb-8 text-center text-2xl text-chalk">회원가입</h1>
      <SignupForm />
    </main>
  )
}
