import type { PerformanceGenre, PerformanceStatus, SessionStatus } from './types'

export const GENRE_LABEL: Record<PerformanceGenre, string> = {
  CONCERT: '콘서트',
  MUSICAL: '뮤지컬',
  PLAY: '연극',
}

// 장르 뱃지 색상 — CONCERT만 브랜드 시그니처(marquee)를 쓰고 나머지는 encore/paper로 구분한다.
// "노란색은 CTA·활성 탭·핵심 뱃지에만" 원칙에 따라 장르 태그 전체를 노란색으로 통일하지 않는다.
export const GENRE_STYLE: Record<PerformanceGenre, string> = {
  CONCERT: 'bg-marquee/15 text-marquee ring-1 ring-inset ring-marquee/30',
  MUSICAL: 'bg-encore/15 text-encore ring-1 ring-inset ring-encore/30',
  PLAY: 'bg-paper/15 text-paper ring-1 ring-inset ring-paper/30',
}

export const STATUS_LABEL: Record<PerformanceStatus, string> = {
  ON_SALE: '예매중',
  SCHEDULED: '오픈 예정',
  CLOSED: '예매 종료',
}

export const STATUS_STYLE: Record<PerformanceStatus, string> = {
  ON_SALE: 'bg-marquee text-void',
  SCHEDULED: 'bg-curtain-light text-paper ring-1 ring-inset ring-mist/30',
  CLOSED: 'bg-void/70 text-mist ring-1 ring-inset ring-mist/20',
}

// session.status는 performance.status와 값 집합이 달라(SOLD_OUT 추가) 별도 맵으로 분리한다.
export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  ON_SALE: '예매중',
  SCHEDULED: '오픈 예정',
  SOLD_OUT: '매진',
  CLOSED: '예매 종료',
}

// 노란색(marquee)은 CTA·활성 탭·핵심 뱃지 전용 원칙 유지: 예매 가능한 회차만 marquee, 나머지는 중립/경고 톤.
export const SESSION_STATUS_STYLE: Record<SessionStatus, string> = {
  ON_SALE: 'bg-marquee text-void',
  SCHEDULED: 'bg-curtain-light text-paper ring-1 ring-inset ring-mist/30',
  SOLD_OUT: 'bg-encore/15 text-encore ring-1 ring-inset ring-encore/30',
  CLOSED: 'bg-void/70 text-mist ring-1 ring-inset ring-mist/20',
}

// 좌석 등급(VIP/R/S/A — SeedDataRunner와 동일한 등급명) 색상. SVG <rect>의 fill 속성에 직접
// 꽂아 쓰므로 Tailwind 클래스가 아니라 순수 hex로 둔다(등급명은 API 응답 문자열이라 클래스명을
// 동적으로 조합할 수 없음). marquee(노랑)는 "선택됨" 강조 전용으로 예약하고 등급 색과는 분리한다.
const SEAT_GRADE_COLOR: Record<string, string> = {
  VIP: '#e0a63d',
  R: '#4fb3e8',
  S: '#5fcf9a',
  A: '#b39ddb',
}

const SEAT_GRADE_COLOR_FALLBACK = '#9089ac' // mist — 목록에 없는 등급명이 오면 무음 실패 대신 중립색 + 콘솔 경고

export function getSeatGradeColor(gradeName: string): string {
  const color = SEAT_GRADE_COLOR[gradeName]
  if (color) return color
  console.warn(`[labels] 등록되지 않은 좌석 등급: ${gradeName}`)
  return SEAT_GRADE_COLOR_FALLBACK
}

export const SEAT_STATUS_COLOR = {
  sold: '#463f5c',
  selected: '#f2b705', // marquee와 동일 — "선택됨"은 사실상 CTA 강조이므로 재사용한다.
} as const
