import { useMutation, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import { ApiError } from '@/api/types'
import { useVisibilityRefetch } from '@/hooks/useVisibilityRefetch'
import { waitingApi } from './api'

// C5(FRONTEND.md 5절①/9절): 폴링 주기와 유령 판정 TTL의 비율은 B와 합의 필요 — 미합의 상태의 잠정값.
// 서버 생존 판정 TTL을 설계상 30초로 잡고 있어(문서 기준), 그보다 충분히 짧은 4초로 둔다.
const POLL_INTERVAL_MS = 4000

// 대기열 진입은 mutation이 아니라 query로 다룬다. mount 시 useEffect에서 mutate()를 호출하는 흔한 패턴은
// React 19 StrictMode의 개발 모드 이중 mount(setup→cleanup→setup)와 부딪혀 mutate 호출이 응답을
// 받고도 화면에 반영되지 않고 무한 대기 상태로 남는 문제가 실측(E2E)으로 확인됐다 — mutation은
// 이 이중 호출에 안전하지 않다. enter는 "이미 대기열에 있으면 현재 상태 그대로 반환"하는 멱등
// 동작으로 mock/서버 양쪽에서 설계했으므로, query로 옮기면 캐시 키 dedup이 중복 호출을 자연히 흡수한다.
export function useEnterWaiting(sessionId: number) {
  return useQuery({
    queryKey: queryKeys.waiting.enter(sessionId),
    queryFn: () => waitingApi.enter(sessionId),
    enabled: Number.isFinite(sessionId),
    retry: 0,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

export function useWaitingStatus(sessionId: number, enabled: boolean) {
  const query = useQuery({
    queryKey: queryKeys.waiting.status(sessionId),
    queryFn: () => waitingApi.getStatus(sessionId),
    enabled: enabled && Number.isFinite(sessionId),
    // ENTERED로 전환되면 폴링을 멈춘다 — 더 이상 heartbeat를 보낼 이유가 없다.
    refetchInterval: (q) => (q.state.data?.status === 'ENTERED' ? false : POLL_INTERVAL_MS),
    // 백그라운드 탭의 setInterval 스로틀링은 그대로 받아들이고, 대신 탭 복귀 시 아래 useVisibilityRefetch로 즉시 만회한다.
    refetchIntervalInBackground: false,
    // 401/403은 재시도해도 결과가 같다 — 대기 화면은 "재로그인 필요"를 명확히 안내해야 하므로(5절⑤)
    // 조용히 재시도만 반복하지 않는다.
    retry: (failureCount, error) => {
      if (error instanceof ApiError && (error.httpStatus === 401 || error.httpStatus === 403)) return false
      return failureCount < 1
    },
  })

  useVisibilityRefetch(() => {
    if (enabled) query.refetch()
  })

  return query
}

// 대기 포기는 사용자가 버튼을 눌러야 실행되는 명확한 1회성 행동이라 mutation으로 다뤄도 안전하다
// (mount 직후 자동 실행되는 게 아니므로 StrictMode 이중 호출 문제와 무관하다).
export function useLeaveWaiting(sessionId: number) {
  return useMutation({
    mutationFn: () => waitingApi.leave(sessionId),
    retry: 0,
  })
}

const ENTRY_TOKEN_STORAGE_PREFIX = 'tf-entry-token'

// entryToken은 다음 STEP(좌석 선점 API 호출)에서 필요하다 — 지금은 저장만 해두고 소비하지 않는다.
export function saveEntryToken(sessionId: number, entryToken: string) {
  sessionStorage.setItem(`${ENTRY_TOKEN_STORAGE_PREFIX}:${sessionId}`, entryToken)
}

export function getEntryToken(sessionId: number): string | null {
  return sessionStorage.getItem(`${ENTRY_TOKEN_STORAGE_PREFIX}:${sessionId}`)
}
