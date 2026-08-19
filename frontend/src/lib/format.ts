export function formatPriceRange(minPrice: number, maxPrice: number): string {
  const won = (n: number) => `${n.toLocaleString('ko-KR')}원`
  return minPrice === maxPrice ? won(minPrice) : `${won(minPrice)} ~ ${won(maxPrice)}`
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/** 회차 날짜+시간 표기 (예: 2026.09.12(토) 19:00). formatDateRange는 날짜만 다뤄 회차 표기엔 부족하다. */
export function formatSessionDateTime(iso: string): string {
  const d = new Date(iso)
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate(),
  ).padStart(2, '0')}(${WEEKDAY[d.getDay()]})`
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${date} ${time}`
}

export function formatDateRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
      d.getDate(),
    ).padStart(2, '0')}`
  }
  return startIso === endIso ? fmt(startIso) : `${fmt(startIso)} ~ ${fmt(endIso)}`
}
