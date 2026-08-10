import { useMemo, type MouseEvent } from 'react'
import { getSeatGradeColor, SEAT_STATUS_COLOR } from '../labels'
import type { SeatMapSeat } from '../types'

interface SeatMapProps {
  seats: SeatMapSeat[]
  selectedSeatIds: Set<number>
  onToggleSeat: (seat: SeatMapSeat) => void
}

// 좌석 1200개 각각을 React 컴포넌트로 만들지 않는다(FRONTEND.md 5절③) — 아래 치수 상수로
// 계산한 좌표에 <rect>를 직접 매핑해서 찍고, 클릭은 <svg> 컨테이너 하나에서 위임 처리한다.
const SEAT_W = 5
const SEAT_H = 6
const PITCH_X = 7
const PITCH_Y = 9
const SECTION_W = 30 * PITCH_X
const SECTION_H = 10 * PITCH_Y
const SECTION_GAP_X = 50
const SECTION_GAP_Y = 40
const MARGIN = 24
const STAGE_H = 28
const STAGE_GAP = 20

// venue_seat.pos_x/pos_y는 구역 내부 로컬 좌표(SeedDataRunner 기준 1~30 / 1~10)라서 구역을 화면
// 어디에 배치할지는 프론트가 section 값으로 정한다 — 무대와 가까운 FLOOR가 위, 2F가 아래.
const SECTION_OFFSET: Record<string, { x: number; y: number }> = {
  'FLOOR-A': { x: MARGIN, y: MARGIN + STAGE_H + STAGE_GAP },
  'FLOOR-B': { x: MARGIN + SECTION_W + SECTION_GAP_X, y: MARGIN + STAGE_H + STAGE_GAP },
  '2F-L': { x: MARGIN, y: MARGIN + STAGE_H + STAGE_GAP + SECTION_H + SECTION_GAP_Y },
  '2F-R': {
    x: MARGIN + SECTION_W + SECTION_GAP_X,
    y: MARGIN + STAGE_H + STAGE_GAP + SECTION_H + SECTION_GAP_Y,
  },
}

const SVG_WIDTH = MARGIN * 2 + SECTION_W * 2 + SECTION_GAP_X
const SVG_HEIGHT = MARGIN * 2 + STAGE_H + STAGE_GAP + SECTION_H * 2 + SECTION_GAP_Y

export function SeatMap({ seats, selectedSeatIds, onToggleSeat }: SeatMapProps) {
  const seatById = useMemo(() => {
    const map = new Map<number, SeatMapSeat>()
    for (const seat of seats) map.set(seat.id, seat)
    return map
  }, [seats])

  // 이벤트 핸들러는 <svg> 하나에만 붙인다 — 좌석마다 onClick을 달지 않는다(이벤트 위임).
  function handleClick(event: MouseEvent<SVGSVGElement>) {
    const target = event.target as SVGElement
    const seatIdAttr = target.getAttribute?.('data-seat-id')
    if (!seatIdAttr) return

    const seat = seatById.get(Number(seatIdAttr))
    if (!seat || seat.status === 'SOLD') return
    onToggleSeat(seat)
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="mx-auto block min-w-[640px] max-w-3xl select-none"
        onClick={handleClick}
        role="group"
        aria-label={`좌석 배치도, 총 ${seats.length}석`}
      >
        <rect
          x={MARGIN}
          y={MARGIN}
          width={SVG_WIDTH - MARGIN * 2}
          height={STAGE_H}
          rx={2}
          className="fill-curtain-light"
        />
        <text
          x={SVG_WIDTH / 2}
          y={MARGIN + STAGE_H / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-mist font-label text-[10px] tracking-[0.35em]"
        >
          STAGE
        </text>

        {Object.entries(SECTION_OFFSET).map(([section, offset]) => (
          <text
            key={section}
            x={offset.x}
            y={offset.y - 6}
            className="fill-mist/70 font-label text-[8px] tracking-wide"
          >
            {section}
          </text>
        ))}

        {seats.map((seat) => {
          const offset = SECTION_OFFSET[seat.section]
          if (!offset) return null // 목업이 아직 다루지 않는 구역명이 오면 조용히 무시(방어적 렌더링)

          const isSold = seat.status === 'SOLD'
          const isSelected = selectedSeatIds.has(seat.id)
          const fill = isSold
            ? SEAT_STATUS_COLOR.sold
            : isSelected
              ? SEAT_STATUS_COLOR.selected
              : getSeatGradeColor(seat.gradeName)

          return (
            <rect
              key={seat.id}
              data-seat-id={seat.id}
              x={offset.x + (seat.posX - 1) * PITCH_X}
              y={offset.y + (seat.posY - 1) * PITCH_Y}
              width={SEAT_W}
              height={SEAT_H}
              rx={1}
              fill={fill}
              stroke={isSelected ? '#f4f1fa' : 'none'}
              strokeWidth={isSelected ? 0.75 : 0}
              opacity={isSold ? 0.55 : 1}
              className={isSold ? 'cursor-not-allowed' : 'cursor-pointer'}
            >
              <title>
                {seat.section} {seat.rowLabel}열 {seat.seatNumber}번 · {seat.gradeName}
                {isSold ? ' · 판매완료' : ''}
              </title>
            </rect>
          )
        })}
      </svg>
    </div>
  )
}
