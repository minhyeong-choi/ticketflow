import type { PerformanceDetail, PerformanceSummary } from '@/features/catalog/types'

// 프로토타입용 더미 데이터. 실 데이터는 SP2에서 GET /api/performances 로 교체.
// posterImageUrl: Unsplash 고정 photo-id 직링크(hotlink 가능한 CDN URL, source.unsplash.com 랜덤
// 리다이렉트 방식은 쓰지 않는다 — 주제와 무관한 사진이 걸리는 걸 막기 위해 장르별로 실제 내용을
// 육안 확인하고 골랐다: 콘서트=무대조명/관중, 뮤지컬=오페라하우스/커튼, 연극=소극장 무대.
// 이미지 로드 실패 시 PerformanceCard가 PosterPlaceholder로 폴백한다.
const unsplash = (photoId: string) =>
  `https://images.unsplash.com/${photoId}?w=1600&q=75&auto=format&fit=crop`

export const dummyPerformances: PerformanceSummary[] = [
  {
    id: 1,
    title: '2026 아이유 콘서트 : The Golden Hour',
    posterImageUrl: unsplash('photo-1459749411175-04bf5292ceea'),
    genre: 'CONCERT',
    status: 'ON_SALE',
    venueName: '올림픽공원 KSPO DOME',
    periodStart: '2026-09-12',
    periodEnd: '2026-09-13',
    minPrice: 110000,
    maxPrice: 165000,
  },
  {
    id: 2,
    title: '뮤지컬 <레미제라블>',
    posterImageUrl: unsplash('photo-1580809361436-42a7ec204889'),
    genre: 'MUSICAL',
    status: 'ON_SALE',
    venueName: '블루스퀘어 신한카드홀',
    periodStart: '2026-08-01',
    periodEnd: '2026-11-29',
    minPrice: 70000,
    maxPrice: 180000,
  },
  {
    id: 3,
    title: '연극 <햄릿>',
    posterImageUrl: unsplash('photo-1507676184212-d03ab07a01bf'),
    genre: 'PLAY',
    status: 'SCHEDULED',
    venueName: '예술의전당 자유소극장',
    periodStart: '2026-10-05',
    periodEnd: '2026-10-26',
    minPrice: 45000,
    maxPrice: 65000,
  },
  {
    id: 4,
    title: '아이브 팬미팅 : IVE SWITCH',
    posterImageUrl: unsplash('photo-1516450360452-9312f5e86fc7'),
    genre: 'CONCERT',
    status: 'CLOSED',
    venueName: '고척스카이돔',
    periodStart: '2026-06-20',
    periodEnd: '2026-06-21',
    minPrice: 132000,
    maxPrice: 198000,
  },
  {
    id: 5,
    title: '뮤지컬 <위키드>',
    posterImageUrl: unsplash('photo-1516307365426-bea591f05011'),
    genre: 'MUSICAL',
    status: 'ON_SALE',
    venueName: '샤롯데씨어터',
    periodStart: '2026-07-15',
    periodEnd: '2027-01-31',
    minPrice: 80000,
    maxPrice: 190000,
  },
  {
    id: 6,
    title: '연극 <프루프>',
    posterImageUrl: unsplash('photo-1560184611-ff3e53f00e8f'),
    genre: 'PLAY',
    status: 'ON_SALE',
    venueName: '대학로 티오엠',
    periodStart: '2026-08-10',
    periodEnd: '2026-09-20',
    minPrice: 39000,
    maxPrice: 55000,
  },
  {
    id: 7,
    title: '2026 락 페스티벌 : SUMMER SONIC',
    posterImageUrl: unsplash('photo-1531058020387-3be344556be6'),
    genre: 'CONCERT',
    status: 'SCHEDULED',
    venueName: '난지한강공원 특설무대',
    periodStart: '2026-08-22',
    periodEnd: '2026-08-23',
    minPrice: 143000,
    maxPrice: 143000,
  },
  {
    id: 8,
    title: '뮤지컬 <오페라의 유령>',
    posterImageUrl: unsplash('photo-1598387993441-a364f854c3e1'),
    genre: 'MUSICAL',
    status: 'CLOSED',
    venueName: '샤롯데씨어터',
    periodStart: '2026-03-01',
    periodEnd: '2026-05-31',
    minPrice: 90000,
    maxPrice: 200000,
  },
  {
    id: 9,
    title: '임영웅 전국투어 : IM HERO',
    posterImageUrl: unsplash('photo-1470229722913-7c0e2dbbafd3'),
    genre: 'CONCERT',
    status: 'ON_SALE',
    venueName: '인스파이어 아레나',
    periodStart: '2026-09-26',
    periodEnd: '2026-09-27',
    minPrice: 121000,
    maxPrice: 176000,
  },
  {
    id: 10,
    title: '연극 <라이어>',
    posterImageUrl: unsplash('photo-1547153760-18fc86324498'),
    genre: 'PLAY',
    status: 'SCHEDULED',
    venueName: '대학로 SH아트홀',
    periodStart: '2026-11-01',
    periodEnd: '2027-02-28',
    minPrice: 35000,
    maxPrice: 48000,
  },
  {
    id: 11,
    title: '뮤지컬 <데스노트>',
    posterImageUrl: unsplash('photo-1514306191717-452ec28c7814'),
    genre: 'MUSICAL',
    status: 'ON_SALE',
    venueName: '충무아트센터 대극장',
    periodStart: '2026-10-01',
    periodEnd: '2026-12-14',
    minPrice: 66000,
    maxPrice: 154000,
  },
  {
    id: 12,
    title: '재즈 인 더 파크 : 가을밤 콘서트',
    posterImageUrl: unsplash('photo-1501281668745-f7f57925c3b4'),
    genre: 'CONCERT',
    status: 'CLOSED',
    venueName: '세종문화회관 야외마당',
    periodStart: '2026-05-09',
    periodEnd: '2026-05-10',
    minPrice: 55000,
    maxPrice: 55000,
  },
]

// 공연 상세(GET /api/performances/:id) 목업. 목록 fixture 중 id 1~3에 대해서만 상세를 갖춘다 —
// 나머지 id는 상세 화면 404(존재하지 않는 공연) 케이스 확인용으로 남겨둔다.
export const dummyPerformanceDetails: Record<number, PerformanceDetail> = {
  1: {
    ...dummyPerformances[0],
    description:
      '데뷔 이래 가장 화려한 무대 연출로 돌아오는 아이유의 단독 콘서트. ' +
      '"The Golden Hour"라는 타이틀처럼, 하루 중 가장 아름다운 빛의 시간을 함께 나누는 공연입니다. ' +
      '히트곡부터 신곡까지 3시간 가까운 러닝타임으로 채워집니다.',
    runningTimeMinutes: 170,
    sessions: [
      { id: 101, sessionAt: '2026-09-12T19:00:00+09:00', bookingOpenAt: '2026-08-10T14:00:00+09:00', status: 'ON_SALE' },
      { id: 102, sessionAt: '2026-09-13T18:00:00+09:00', bookingOpenAt: '2026-08-10T14:00:00+09:00', status: 'ON_SALE' },
    ],
    seatGrades: [
      { name: 'VIP', price: 165000 },
      { name: 'R', price: 143000 },
      { name: 'S', price: 121000 },
      { name: 'A', price: 110000 },
    ],
  },
  2: {
    ...dummyPerformances[1],
    description:
      '전 세계 6,500만 관객이 감동한 빅토르 위고 원작의 대서사. ' +
      '장발장의 구원과 혁명의 시대를 관통하는 넘버들이 라이브 오케스트라와 함께 펼쳐집니다.',
    runningTimeMinutes: 175,
    sessions: [
      { id: 201, sessionAt: '2026-08-01T19:30:00+09:00', bookingOpenAt: '2026-06-15T14:00:00+09:00', status: 'ON_SALE' },
      { id: 202, sessionAt: '2026-08-02T14:00:00+09:00', bookingOpenAt: '2026-06-15T14:00:00+09:00', status: 'SOLD_OUT' },
      { id: 203, sessionAt: '2026-11-29T19:30:00+09:00', bookingOpenAt: '2026-10-01T14:00:00+09:00', status: 'SCHEDULED' },
    ],
    seatGrades: [
      { name: 'VIP', price: 180000 },
      { name: 'R', price: 150000 },
      { name: 'S', price: 110000 },
      { name: 'A', price: 70000 },
    ],
  },
  3: {
    ...dummyPerformances[2],
    description:
      '셰익스피어 4대 비극의 정점, <햄릿>을 소극장의 밀도 높은 연출로 재해석했습니다. ' +
      '복수와 광기, 존재에 대한 질문을 배우들의 밀착 연기로 그려냅니다.',
    runningTimeMinutes: 130,
    sessions: [
      { id: 301, sessionAt: '2026-10-05T19:30:00+09:00', bookingOpenAt: '2026-09-01T14:00:00+09:00', status: 'SCHEDULED' },
      { id: 302, sessionAt: '2026-10-12T19:30:00+09:00', bookingOpenAt: '2026-09-01T14:00:00+09:00', status: 'SCHEDULED' },
      { id: 303, sessionAt: '2026-10-26T15:00:00+09:00', bookingOpenAt: '2026-09-01T14:00:00+09:00', status: 'SCHEDULED' },
    ],
    seatGrades: [
      { name: 'R', price: 65000 },
      { name: 'S', price: 55000 },
      { name: 'A', price: 45000 },
    ],
  },
}
