import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserResponse } from './types'

interface AuthState {
  accessToken: string | null
  user: UserResponse | null
  setSession: (accessToken: string, user: UserResponse) => void
  updateUser: (user: UserResponse) => void
  logout: () => void
}

// 전역 클라이언트 상태는 authStore/holdStore 2개로 제한한다(FRONTEND.md). 화면 로직은 여기 두지 않는다.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setSession: (accessToken, user) => set({ accessToken, user }),
      // 회원정보 수정(PATCH /api/users/me) 성공 직후 Header 등 user를 직접 구독하는 화면에 즉시 반영한다.
      updateUser: (user) => set({ user }),
      logout: () => set({ accessToken: null, user: null }),
    }),
    {
      name: 'tf-auth',
    },
  ),
)
