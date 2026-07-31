export function formatPriceRange(minPrice: number, maxPrice: number): string {
  const won = (n: number) => `${n.toLocaleString('ko-KR')}원`
  return minPrice === maxPrice ? won(minPrice) : `${won(minPrice)} ~ ${won(maxPrice)}`
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
