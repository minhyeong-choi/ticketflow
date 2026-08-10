import { useEffect, useRef } from 'react'

// 백그라운드 탭에서는 브라우저가 폴링 타이머를 스로틀링한다(FRONTEND.md 5절① — 대기실 폴링은 heartbeat다).
// 탭이 다시 visible로 바뀌는 순간 콜백을 1회 실행해 놓친 폴링을 즉시 만회한다.
// ref로 최신 콜백을 들고 있어 매 렌더마다 리스너를 재등록하지 않는다.
export function useVisibilityRefetch(onVisible: () => void) {
  const callbackRef = useRef(onVisible)

  useEffect(() => {
    callbackRef.current = onVisible
  })

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        callbackRef.current()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])
}
