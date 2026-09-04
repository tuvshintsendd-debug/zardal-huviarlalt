import { MONTH_NAMES } from '../constants/utilities'

const numberFormatter = new Intl.NumberFormat('mn-MN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/** 1234567.5 -> "1,234,567.5" */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return numberFormatter.format(value)
}

/** 1234567.5 -> "1,234,567.5 ₮" */
export function formatMoney(value: number): string {
  return `${formatNumber(value)} ₮`
}

/** Хэрэглэгчийн бичсэн текстийг тоо болгох. Хоосон/буруу бол 0. */
export function parseNumber(input: string | number | undefined | null): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0
  if (input === undefined || input === null) return 0
  const cleaned = String(input).replace(/\s/g, '').replace(/,/g, '')
  if (cleaned === '') return 0
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

/** '2026-08' -> '2026 оны 8-р сар' */
export function formatPeriod(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period)
  if (!match) return period
  const year = match[1]
  const monthIndex = Number(match[2]) - 1
  const monthName = MONTH_NAMES[monthIndex] ?? `${match[2]}-р сар`
  return `${year} оны ${monthName}`
}

/** Одоогийн сарыг 'YYYY-MM' хэлбэрээр буцаана */
export function currentPeriod(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${month}`
}

/** Excel-ээс ирсэн огноо/текстийг 'YYYY-MM' болгон хөрвүүлэх */
export function normalizePeriod(value: unknown): string {
  if (value instanceof Date) {
    const month = String(value.getMonth() + 1).padStart(2, '0')
    return `${value.getFullYear()}-${month}`
  }
  const text = String(value ?? '').trim()
  if (text === '') return ''

  // 2026-08, 2026/8, 2026.08
  const ym = /^(\d{4})[-/.](\d{1,2})/.exec(text)
  if (ym) return `${ym[1]}-${String(Number(ym[2])).padStart(2, '0')}`

  // 08-2026, 8/2026
  const my = /^(\d{1,2})[-/.](\d{4})$/.exec(text)
  if (my) return `${my[2]}-${String(Number(my[1])).padStart(2, '0')}`

  return text
}

/** 0.1 + 0.2 маягийн хөвөгч цэгийн алдааг арилгах */
export function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}
