import { DAY_MS } from '../config'

export function normalizeDateOnly(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day))
  }
  const parsed = new Date(value as any)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()))
}

export function toISODate(value: unknown): string | null {
  const date = normalizeDateOnly(value)
  if (!date) return null
  return date.toISOString().split('T')[0]
}

export function computeNextDeliveryDate(startDate: unknown, intervalDays: number | null | undefined): Date | null {
  if (!startDate || !intervalDays) return null
  const start = normalizeDateOnly(startDate)
  if (!start || Number.isNaN(start.getTime())) return null
  if (intervalDays <= 0) return start
  const today = normalizeDateOnly(new Date())
  if (!today) return null
  if (start > today) return start
  const elapsedMs = today.getTime() - start.getTime()
  const intervalsElapsed = Math.floor(elapsedMs / (intervalDays * DAY_MS)) + 1
  return new Date(start.getTime() + intervalsElapsed * intervalDays * DAY_MS)
}
