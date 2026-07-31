import { QueryClient } from '@tanstack/react-query'

// mutation 기본 retry:0 — 선점/해제/확정/취소류는 재시도가 위험하므로 전역 기본값을 안전한 쪽으로 둔다.
// 그래도 각 mutation 훅에서 retry:0을 다시 명시해 의도를 드러낸다(FRONTEND.md 5절④, 전역 설정에 암묵적으로 의존하지 않음).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
})
