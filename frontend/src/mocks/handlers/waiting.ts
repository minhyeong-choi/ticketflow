import { delay, http, HttpResponse } from 'msw'
import type { ApiResponse } from '@/api/types'
import type { WaitingStatus } from '@/features/waiting/types'
import { KNOWN_SESSION_IDS } from '../fixtures/seatMap'

const BASE_URL = import.meta.env.VITE_API_BASE_URL

interface WaitingEntry {
  status: 'WAITING' | 'ENTERED'
  rank?: number
  entryToken?: string
}

// 실제 다중 사용자 대기열은 흉내낼 수 없으니, 세션별 인메모리 상태로 "폴링마다 순번이 줄다가
// 0이 되면 입장 전환"만 데모한다. 서버 재시작(=페이지 새로고침으로 워커 재시작되진 않음) 전까지 유지.
const queueState = new Map<number, WaitingEntry>()

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function toResponse(entry: WaitingEntry): WaitingStatus {
  if (entry.status === 'ENTERED') {
    return { status: 'ENTERED', entryToken: entry.entryToken as string }
  }
  return { status: 'WAITING', rank: entry.rank as number }
}

// 제네릭으로 둔다 — 성공 응답과 실패 응답을 같은 핸들러 안에서 다른 타입 인자로 반환하면 tsc -b에서
// http.get/post<...>()의 ResponseBodyType 추론이 깨진다(call site에서 그 핸들러의 성공 응답 타입과
// 동일한 T를 명시해서 호출한다. data: T | null이라 null 대입 자체는 안전하다).
function notFoundResponse<T>() {
  return HttpResponse.json<ApiResponse<T>>(
    { success: false, data: null, errorCode: 'WAITING_001', message: '존재하지 않는 회차입니다.' },
    { status: 404 },
  )
}

export const waitingHandlers = [
  http.post(`${BASE_URL}/api/waiting/:id/enter`, async ({ params }) => {
    const sessionId = Number(params.id)
    if (!KNOWN_SESSION_IDS.has(sessionId)) return notFoundResponse<WaitingStatus>()

    await delay(200)

    let entry = queueState.get(sessionId)
    if (!entry) {
      // 저트래픽 fast-path(문서 근거: docs/study/02-developer-b-workflow.md) — 대기열이 비어있으면
      // enter 호출 즉시 ENTERED로 응답한다. 데모용으로 30% 확률로 이 경로를 재현한다.
      entry =
        Math.random() < 0.3
          ? { status: 'ENTERED', entryToken: crypto.randomUUID() }
          : { status: 'WAITING', rank: randomInt(5, 15) }
      queueState.set(sessionId, entry)
    }

    return HttpResponse.json<ApiResponse<WaitingStatus>>({
      success: true,
      data: toResponse(entry),
      errorCode: null,
      message: null,
    })
  }),

  // 폴링 = heartbeat(FRONTEND.md 5절①) — 호출될 때마다 순번을 소폭 줄이다가 0 이하가 되면 입장 허용한다.
  http.get(`${BASE_URL}/api/waiting/:id/status`, async ({ params }) => {
    const sessionId = Number(params.id)
    if (!KNOWN_SESSION_IDS.has(sessionId)) return notFoundResponse<WaitingStatus>()

    const entry = queueState.get(sessionId)
    if (!entry) {
      return HttpResponse.json<ApiResponse<WaitingStatus>>(
        {
          success: false,
          data: null,
          errorCode: 'WAITING_002',
          message: '대기열 참가 정보가 없습니다. 대기실에 다시 입장해주세요.',
        },
        { status: 404 },
      )
    }

    await delay(150)

    let next = entry
    if (entry.status === 'WAITING') {
      const nextRank = (entry.rank as number) - randomInt(1, 3)
      next =
        nextRank <= 0
          ? { status: 'ENTERED', entryToken: crypto.randomUUID() }
          : { status: 'WAITING', rank: nextRank }
      queueState.set(sessionId, next)
    }

    return HttpResponse.json<ApiResponse<WaitingStatus>>({
      success: true,
      data: toResponse(next),
      errorCode: null,
      message: null,
    })
  }),

  http.delete(`${BASE_URL}/api/waiting/:id`, ({ params }) => {
    const sessionId = Number(params.id)
    queueState.delete(sessionId)
    return HttpResponse.json<ApiResponse<null>>({ success: true, data: null, errorCode: null, message: null })
  }),
]
