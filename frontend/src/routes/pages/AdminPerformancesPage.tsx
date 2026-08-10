import { useState } from 'react'
import { ApiError } from '@/api/types'
import { getErrorMessage } from '@/lib/errorMessages'
import { ADMIN_GENRE_LABEL, ADMIN_STATUS_LABEL } from '@/features/admin/labels'
import { useAdminPerformances, useDeletePerformance } from '@/features/admin/hooks'
import { PerformanceForm } from '@/features/admin/components/PerformanceForm'
import type { AdminPerformance } from '@/features/admin/types'

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse bg-curtain-light/60 ring-1 ring-inset ring-mist/10" />
      ))}
    </div>
  )
}

function SectionError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof ApiError ? getErrorMessage(error) : '목록을 불러오지 못했습니다.'
  return (
    <div className="flex flex-col items-center justify-center gap-3 bg-curtain-light/40 px-4 py-10 text-center ring-1 ring-inset ring-mist/10">
      <p className="text-sm text-encore">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full border border-marquee/50 px-4 py-1.5 text-xs font-medium text-marquee hover:bg-marquee/10"
      >
        다시 시도
      </button>
    </div>
  )
}

function SeatGradeSummary({ seatGrades }: { seatGrades: AdminPerformance['seatGrades'] }) {
  if (seatGrades.length === 0) return <span className="text-mist/50">-</span>
  return (
    <span className="text-xs text-mist/80">
      {seatGrades.map((grade) => `${grade.name} ${grade.price.toLocaleString('ko-KR')}원`).join(' / ')}
    </span>
  )
}

function FormModal({ performance, onClose }: { performance: AdminPerformance | null; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-void/70 px-4 py-8"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-curtain p-6 ring-1 ring-inset ring-mist/10">
        <h2 className="mb-4 text-lg font-bold text-chalk">{performance ? '공연 수정' : '새 공연 등록'}</h2>
        <PerformanceForm performance={performance} onClose={onClose} />
      </div>
    </div>
  )
}

export function AdminPerformancesPage() {
  const { data, isPending, isError, error, refetch } = useAdminPerformances()
  const deletePerformance = useDeletePerformance()

  // 'create'/AdminPerformance/null 3단 구분 — null이면 모달 닫힘, 'create'면 등록, 그 외엔 수정 대상.
  const [formTarget, setFormTarget] = useState<'create' | AdminPerformance | null>(null)
  const [deleteError, setDeleteError] = useState<{ id: number; message: string } | null>(null)

  function handleDelete(performance: AdminPerformance) {
    if (!window.confirm(`"${performance.title}" 공연을 삭제하시겠습니까?`)) return
    setDeleteError(null)
    deletePerformance.mutate(performance.id, {
      onError: (err) => {
        // 예매/회차가 걸린 공연은 서버가 409 등으로 거부할 수 있다 — 무음 실패 없이 행 아래에 명확히 표시한다.
        setDeleteError({
          id: performance.id,
          message: err instanceof ApiError ? getErrorMessage(err) : '삭제에 실패했습니다.',
        })
      },
    })
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="font-label text-xs font-medium uppercase tracking-[0.3em] text-marquee">Admin</span>
          <h1 className="font-display text-2xl text-chalk">공연 관리</h1>
        </div>
        <button
          type="button"
          onClick={() => setFormTarget('create')}
          className="rounded-full bg-marquee px-5 py-2.5 text-sm font-bold text-void transition-colors hover:bg-marquee-dim"
        >
          + 새 공연 등록
        </button>
      </header>

      {isPending ? (
        <ListSkeleton />
      ) : isError ? (
        <SectionError error={error} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <p className="py-16 text-center text-sm text-mist">등록된 공연이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto bg-curtain ring-1 ring-inset ring-mist/10">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-mist/10 text-xs uppercase tracking-wide text-mist">
                <th className="px-4 py-3 font-medium">공연명</th>
                <th className="px-4 py-3 font-medium">장르</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">공연장</th>
                <th className="px-4 py-3 font-medium">좌석 등급</th>
                <th className="px-4 py-3 text-right font-medium">관리</th>
              </tr>
            </thead>
            <tbody>
              {data.map((performance) => (
                <tr key={performance.id} className="border-b border-mist/10 align-top last:border-0">
                  <td className="px-4 py-3 text-chalk">{performance.title}</td>
                  <td className="px-4 py-3 text-mist/80">{ADMIN_GENRE_LABEL[performance.genre]}</td>
                  <td className="px-4 py-3 text-mist/80">{ADMIN_STATUS_LABEL[performance.status]}</td>
                  <td className="px-4 py-3 text-mist/80">{performance.venueName}</td>
                  <td className="px-4 py-3">
                    <SeatGradeSummary seatGrades={performance.seatGrades} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setFormTarget(performance)}
                        className="rounded-full border border-mist/30 px-3 py-1.5 text-xs text-mist hover:bg-curtain-light"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(performance)}
                        disabled={deletePerformance.isPending}
                        className="rounded-full border border-encore/40 px-3 py-1.5 text-xs text-encore hover:bg-encore/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>
                    {deleteError?.id === performance.id && (
                      <p className="mt-1.5 text-right text-xs text-encore">{deleteError.message}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formTarget && (
        <FormModal performance={formTarget === 'create' ? null : formTarget} onClose={() => setFormTarget(null)} />
      )}
    </main>
  )
}
