import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { HoldSnapshot } from './types'

interface HoldState {
  hold: HoldSnapshot | null
  setHold: (hold: HoldSnapshot) => void
  clearHold: () => void
}

// 전역 클라이언트 상태는 authStore/holdStore 2개로 제한한다(FRONTEND.md 2절). 새로고침·뒤로가기에서도
// 선점 상태를 복구해야 해서(5절⑥) sessionStorage에 영속화한다 — 탭을 닫으면 사라지는 게 의도(로그인
// 유지가 목적인 authStore의 localStorage와 다르다).
export const useHoldStore = create<HoldState>()(
  persist(
    (set) => ({
      hold: null,
      setHold: (hold) => set({ hold }),
      clearHold: () => set({ hold: null }),
    }),
    {
      name: 'tf-hold',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)
