import type { PerformanceGenre, PerformanceStatus } from './types'

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
