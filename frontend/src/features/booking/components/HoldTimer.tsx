interface HoldTimerProps {
  remainingSec: number
  isWarning: boolean
}

function formatRemaining(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// 표시 전용 컴포넌트 — 카운트다운 계산(서버 절대 시각 기준, FRONTEND.md 5절②)은 hooks.ts의
// useHoldCountdown이 전담하고, 이 컴포넌트는 그 결과를 그리기만 한다.
export function HoldTimer({ remainingSec, isWarning }: HoldTimerProps) {
  return (
    <p className={`text-sm font-bold ${isWarning ? 'text-encore' : 'text-chalk'}`}>
      선점 남은 시간{' '}
      <span className="font-display text-lg tabular-nums">{formatRemaining(remainingSec)}</span>
      {isWarning && <span className="ml-2 text-xs font-normal text-encore">곧 만료됩니다!</span>}
    </p>
  )
}
