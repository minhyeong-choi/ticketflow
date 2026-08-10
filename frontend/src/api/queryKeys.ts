// 쿼리 키 팩토리. feature별 hooks.ts에서 이 팩토리를 통해서만 키를 만든다(임의 문자열 배열 금지).
export const queryKeys = {
  catalog: {
    all: ['catalog', 'performances'] as const,
    list: () => [...queryKeys.catalog.all, 'list'] as const,
    detail: (id: number) => [...queryKeys.catalog.all, 'detail', id] as const,
    seats: (sessionId: number) => ['catalog', 'sessions', sessionId, 'seats'] as const,
    seatSummary: (sessionId: number) => [...queryKeys.catalog.seats(sessionId), 'summary'] as const,
    seatMap: (sessionId: number) => [...queryKeys.catalog.seats(sessionId), 'map'] as const,
  },
  auth: {
    me: ['auth', 'me'] as const,
  },
  waiting: {
    // enter는 POST지만 "이미 대기열에 있으면 현재 상태를 그대로 돌려주는" 멱등 조회에 가깝게 설계되어
    // 있어 query로 다룬다 — mutation을 마운트 시 useEffect에서 실행하면 StrictMode의 개발 모드
    // 이중 렌더링과 충돌해 요청이 유실될 수 있고, query는 캐시 키로 자연스럽게 중복 호출을 흡수한다.
    enter: (sessionId: number) => ['waiting', sessionId, 'enter'] as const,
    status: (sessionId: number) => ['waiting', sessionId, 'status'] as const,
  },
  mypage: {
    bookings: ['mypage', 'bookings'] as const,
    bookingDetail: (id: number) => ['mypage', 'bookings', id] as const,
    notifications: ['mypage', 'notifications'] as const,
  },
  admin: {
    performances: ['admin', 'performances'] as const,
    venues: ['admin', 'venues'] as const,
  },
}
