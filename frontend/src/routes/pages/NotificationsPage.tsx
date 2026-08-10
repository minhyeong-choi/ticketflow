import { ApiError } from '@/api/types'
import { getErrorMessage } from '@/lib/errorMessages'
import { formatSessionDateTime } from '@/lib/format'
import { NOTIFICATION_TYPE_DOT_COLOR } from '@/features/mypage/labels'
import { useNotifications } from '@/features/mypage/hooks'

function ListSkeleton() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="h-16 animate-pulse bg-curtain-light/60 ring-1 ring-inset ring-mist/10" />
      ))}
    </ul>
  )
}

export function NotificationsPage() {
  const { data, isPending, isError, error, refetch } = useNotifications()

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6">
        <span className="font-label text-xs font-medium uppercase tracking-[0.3em] text-marquee">My Page</span>
        <h1 className="font-display text-2xl text-chalk">알림</h1>
      </header>

      {isPending ? (
        <ListSkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 bg-curtain-light/40 px-4 py-10 text-center ring-1 ring-inset ring-mist/10">
          <p className="text-sm text-encore">
            {error instanceof ApiError ? getErrorMessage(error) : '알림을 불러오지 못했습니다.'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-full border border-marquee/50 px-4 py-1.5 text-xs font-medium text-marquee hover:bg-marquee/10"
          >
            다시 시도
          </button>
        </div>
      ) : data.length === 0 ? (
        <p className="py-16 text-center text-sm text-mist">받은 알림이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {data.map((notification) => (
            <li
              key={notification.id}
              className={`flex items-start gap-3 px-4 py-3.5 ring-1 ring-inset ${
                notification.isRead ? 'bg-curtain ring-mist/10' : 'bg-curtain-light ring-marquee/30'
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${NOTIFICATION_TYPE_DOT_COLOR[notification.type]}`}
              />
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${notification.isRead ? 'text-chalk/80' : 'font-semibold text-chalk'}`}>
                  {notification.message}
                </p>
                <p className="mt-1 text-[11px] text-mist/60">{formatSessionDateTime(notification.createdAt)}</p>
              </div>
              {!notification.isRead && (
                <span className="mt-0.5 shrink-0 rounded-full bg-marquee px-1.5 py-0.5 text-[9px] font-bold text-void">
                  NEW
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
