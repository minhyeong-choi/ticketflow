import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { ApiError } from '@/api/types'
import { getErrorMessage } from '@/lib/errorMessages'
import { ADMIN_GENRE_LABEL, ADMIN_STATUS_LABEL } from '../labels'
import { useCreatePerformance, useUpdatePerformance, useVenueOptions } from '../hooks'
import type { AdminPerformance, AdminPerformanceGenre, AdminPerformanceStatus } from '../types'

const GENRES: AdminPerformanceGenre[] = ['CONCERT', 'MUSICAL', 'PLAY']
const STATUSES: AdminPerformanceStatus[] = ['SCHEDULED', 'ON_SALE', 'CLOSED']

const inputClass =
  'rounded-md border border-mist/30 bg-curtain-light px-3.5 py-2.5 text-sm text-chalk outline-none focus:border-marquee'
const labelClass = 'font-label text-xs uppercase tracking-wide text-mist'

// 숫자 입력은 z.coerce 대신 RHF의 valueAsNumber(register 옵션)로 변환한다 — zodResolver(zod v4)는
// coerce 필드의 "입력 전" 타입(unknown)을 요구해 useForm<PerformanceFormValues>의 number 타입과
// 충돌한다. valueAsNumber는 빈 값을 NaN으로 만들고, Number.isInteger(NaN)이 false라 .int() 검증이
// "값 없음"까지 함께 잡아준다.
const seatGradeSchema = z.object({
  name: z.string().min(1, '등급명을 입력해주세요.').max(20, '등급명은 20자 이내여야 합니다.'),
  price: z.number().int('올바른 가격을 입력해주세요.').min(0, '0원 이상이어야 합니다.'),
})

const performanceSchema = z.object({
  title: z.string().min(1, '공연명을 입력해주세요.'),
  description: z.string().min(1, '공연 설명을 입력해주세요.'),
  posterImageUrl: z.string().min(1, '포스터 이미지 URL을 입력해주세요.').url('올바른 URL 형식이 아닙니다.'),
  genre: z.enum(['CONCERT', 'MUSICAL', 'PLAY']),
  status: z.enum(['SCHEDULED', 'ON_SALE', 'CLOSED']),
  runningTimeMinutes: z.number().int('올바른 러닝타임을 입력해주세요.').min(1, '1분 이상이어야 합니다.'),
  venueId: z.number().int().min(1, '공연장을 선택해주세요.'),
  seatGrades: z.array(seatGradeSchema).min(1, '좌석 등급을 최소 1개 등록해주세요.'),
})

type PerformanceFormValues = z.infer<typeof performanceSchema>

interface PerformanceFormProps {
  /** null/undefined면 등록, 값이 있으면 수정 모드. */
  performance?: AdminPerformance | null
  onClose: () => void
}

// 등록/수정 겸용 폼 — SignupForm.tsx 패턴(react-hook-form + zod, 필드별 인라인 에러) 재사용.
// "공연 1건 = 공연장 1곳"(CLAUDE.md) 원칙에 따라 venueId 단일 선택만 제공한다.
export function PerformanceForm({ performance, onClose }: PerformanceFormProps) {
  const isEdit = !!performance
  const venues = useVenueOptions()
  const createPerformance = useCreatePerformance()
  const updatePerformance = useUpdatePerformance()
  const mutation = isEdit ? updatePerformance : createPerformance

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PerformanceFormValues>({
    resolver: zodResolver(performanceSchema),
    defaultValues: performance
      ? {
          title: performance.title,
          description: performance.description,
          posterImageUrl: performance.posterImageUrl,
          genre: performance.genre,
          status: performance.status,
          runningTimeMinutes: performance.runningTimeMinutes,
          venueId: performance.venueId,
          seatGrades: performance.seatGrades,
        }
      : {
          title: '',
          description: '',
          posterImageUrl: '',
          genre: 'CONCERT',
          status: 'SCHEDULED',
          runningTimeMinutes: 120,
          venueId: 0,
          seatGrades: [{ name: '', price: 0 }],
        },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'seatGrades' })

  const onSubmit = handleSubmit((values) => {
    if (isEdit && performance) {
      updatePerformance.mutate({ id: performance.id, payload: values }, { onSuccess: onClose })
    } else {
      createPerformance.mutate(values, { onSuccess: onClose })
    }
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className={labelClass}>
          공연명
        </label>
        <input id="title" type="text" className={inputClass} {...register('title')} />
        {errors.title && <p className="text-xs text-encore">{errors.title.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className={labelClass}>
          공연 설명
        </label>
        <textarea id="description" rows={3} className={inputClass} {...register('description')} />
        {errors.description && <p className="text-xs text-encore">{errors.description.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="posterImageUrl" className={labelClass}>
          포스터 이미지 URL
        </label>
        <input id="posterImageUrl" type="text" className={inputClass} {...register('posterImageUrl')} />
        {errors.posterImageUrl && <p className="text-xs text-encore">{errors.posterImageUrl.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="genre" className={labelClass}>
            장르
          </label>
          <select id="genre" className={inputClass} {...register('genre')}>
            {GENRES.map((genre) => (
              <option key={genre} value={genre}>
                {ADMIN_GENRE_LABEL[genre]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className={labelClass}>
            상태
          </label>
          <select id="status" className={inputClass} {...register('status')}>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {ADMIN_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="runningTimeMinutes" className={labelClass}>
            러닝타임(분)
          </label>
          <input
            id="runningTimeMinutes"
            type="number"
            min={1}
            className={inputClass}
            {...register('runningTimeMinutes', { valueAsNumber: true })}
          />
          {errors.runningTimeMinutes && <p className="text-xs text-encore">{errors.runningTimeMinutes.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="venueId" className={labelClass}>
            공연장
          </label>
          {venues.isPending ? (
            <p className="py-2.5 text-xs text-mist">공연장 목록을 불러오는 중...</p>
          ) : venues.isError ? (
            <div className="flex items-center gap-2">
              <p className="text-xs text-encore">
                {venues.error instanceof ApiError ? getErrorMessage(venues.error) : '공연장 목록을 불러오지 못했습니다.'}
              </p>
              <button
                type="button"
                onClick={() => venues.refetch()}
                className="shrink-0 text-xs font-medium text-marquee hover:underline"
              >
                다시 시도
              </button>
            </div>
          ) : (
            <select id="venueId" className={inputClass} {...register('venueId', { valueAsNumber: true })}>
              <option value={0} disabled>
                선택해주세요
              </option>
              {venues.data.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          )}
          {errors.venueId && <p className="text-xs text-encore">{errors.venueId.message}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className={labelClass}>좌석 등급</span>
          <button
            type="button"
            onClick={() => append({ name: '', price: 0 })}
            className="text-xs font-medium text-marquee hover:underline"
          >
            + 등급 추가
          </button>
        </div>
        {errors.seatGrades?.message && <p className="text-xs text-encore">{errors.seatGrades.message}</p>}

        <div className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="등급명 (예: VIP)"
                  className={`flex-1 ${inputClass}`}
                  {...register(`seatGrades.${index}.name`)}
                />
                <input
                  type="number"
                  placeholder="가격"
                  min={0}
                  className={`w-32 ${inputClass}`}
                  {...register(`seatGrades.${index}.price`, { valueAsNumber: true })}
                />
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={fields.length <= 1}
                  className="shrink-0 rounded-md px-2 py-2 text-xs text-mist hover:text-encore disabled:cursor-not-allowed disabled:opacity-40"
                >
                  삭제
                </button>
              </div>
              {(errors.seatGrades?.[index]?.name || errors.seatGrades?.[index]?.price) && (
                <p className="text-xs text-encore">
                  {errors.seatGrades[index]?.name?.message ?? errors.seatGrades[index]?.price?.message}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {mutation.isError && (
        <p className="text-sm text-encore">
          {mutation.error instanceof ApiError ? getErrorMessage(mutation.error) : '저장에 실패했습니다.'}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-full bg-marquee px-6 py-2.5 text-sm font-bold text-void transition-colors hover:bg-marquee-dim disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mutation.isPending ? '저장 중...' : isEdit ? '수정' : '등록'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-mist/30 px-6 py-2.5 text-sm text-mist hover:bg-curtain-light"
        >
          취소
        </button>
      </div>
    </form>
  )
}
