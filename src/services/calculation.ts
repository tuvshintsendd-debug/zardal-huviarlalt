import type {
  BillCalculation,
  BillWithCalc,
  KindSummary,
  UtilityBill,
  UtilityKind,
  ValidationErrors,
} from '../types'
import { UTILITY_KINDS } from '../constants/utilities'
import { createId } from '../utils/id'
import { currentPeriod, round } from '../utils/format'

/**
 * Тоолуурын хэрэглээ.
 * Хэрэглээ = (Сүүлийн заалт − Эхний заалт) × Квц
 * Шууд дүнгээр тооцсон бичилтэд хэрэглээ байхгүй (null).
 */
export function calculateUsage(bill: UtilityBill): number | null {
  if (bill.method !== 'meter') return null
  return round((bill.endReading - bill.startReading) * bill.kvts, 4)
}

/**
 * Нэг нэхэмжлэлийн бүрэн тооцоолол.
 *
 *   Заалтаар:  Хэрэглээ = (Сүүлийн заалт − Эхний заалт) × Квц
 *              Үндсэн дүн = Хэрэглээ × Нэгж үнэ
 *   Шууд:      Үндсэн дүн = Нэхэмжлэлийн нийт дүн
 *
 *   НӨАТ       = Үндсэн дүн × НӨАТ хувь / 100
 *   Нийт дүн   = Үндсэн дүн + НӨАТ + Нэмэлт төлбөр
 */
export function calculateBill(bill: UtilityBill): BillCalculation {
  const usage = calculateUsage(bill)

  const baseAmount =
    bill.method === 'meter'
      ? round((usage ?? 0) * bill.unitPrice)
      : round(bill.directAmount)

  const vatAmount = bill.hasSurcharge
    ? round((baseAmount * bill.vatPercent) / 100)
    : 0
  const extraAmount = bill.hasSurcharge ? round(bill.extraCharge) : 0
  const surchargeAmount = round(vatAmount + extraAmount)

  return {
    usage,
    baseAmount,
    vatAmount,
    extraAmount,
    surchargeAmount,
    totalAmount: round(baseAmount + surchargeAmount),
  }
}

/** Бичилт бүрт тооцооллыг хавсаргах */
export function withCalculations(bills: UtilityBill[]): BillWithCalc[] {
  return bills.map((bill) => ({ ...bill, calc: calculateBill(bill) }))
}

/** Төрөл тус бүрээр нэгтгэх — зүүн талын самбарын үзүүлэлт */
export function summarizeByKind(bills: UtilityBill[]): KindSummary[] {
  return UTILITY_KINDS.map((kind) => {
    const own = bills.filter((bill) => bill.kind === kind)
    return own.reduce<KindSummary>(
      (acc, bill) => {
        const calc = calculateBill(bill)
        acc.count += 1
        acc.usage = round(acc.usage + (calc.usage ?? 0), 4)
        acc.totalAmount = round(acc.totalAmount + calc.totalAmount)
        return acc
      },
      { kind, count: 0, usage: 0, totalAmount: 0 },
    )
  })
}

/** Бүх бичилтийн нийт дүн */
export function totalAmountOf(bills: UtilityBill[]): number {
  return round(
    bills.reduce((sum, bill) => sum + calculateBill(bill).totalAmount, 0),
  )
}

/** Хадгалахын өмнөх шалгалт. Хоосон объект буцвал алдаагүй. */
export function validateBill(bill: UtilityBill): ValidationErrors {
  const errors: ValidationErrors = {}

  if (!/^\d{4}-\d{2}$/.test(bill.period)) {
    errors.period = 'Тайлант сарыг сонгоно уу'
  }
  if (bill.method === 'meter') {
    if (bill.endReading < bill.startReading) {
      errors.endReading = 'Сүүлийн заалт эхний заалтаас бага байж болохгүй'
    }
    if (bill.startReading < 0) {
      errors.startReading = 'Заалт сөрөг байж болохгүй'
    }
    if (bill.kvts <= 0) {
      errors.kvts = 'Квц 0-ээс их байх ёстой'
    }
    if (bill.unitPrice <= 0) {
      errors.unitPrice = 'Нэгж үнэ 0-ээс их байх ёстой'
    }
  } else if (bill.directAmount <= 0) {
    errors.directAmount = 'Нэхэмжлэлийн дүн 0-ээс их байх ёстой'
  }

  if (bill.hasSurcharge) {
    if (bill.vatPercent < 0 || bill.vatPercent > 100) {
      errors.vatPercent = 'НӨАТ 0–100 хооронд байна'
    }
    if (bill.extraCharge < 0) {
      errors.extraCharge = 'Нэмэлт төлбөр сөрөг байж болохгүй'
    }
  }

  return errors
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0
}

/** Шинэ хоосон бичилт үүсгэх */
export function createEmptyBill(
  kind: UtilityKind = 'electricity',
  period: string = currentPeriod(),
): UtilityBill {
  const now = new Date().toISOString()
  return {
    id: createId(),
    kind,
    period,
    title: '',
    method: 'meter',
    startReading: 0,
    endReading: 0,
    kvts: 1,
    unitPrice: 0,
    directAmount: 0,
    hasSurcharge: false,
    vatPercent: 0,
    extraCharge: 0,
    note: '',
    createdAt: now,
    updatedAt: now,
  }
}

/** Дурын объектыг (LocalStorage / Excel) бүрэн UtilityBill болгож ариутгах */
export function normalizeBill(raw: Partial<UtilityBill>): UtilityBill {
  const base = createEmptyBill()
  return {
    ...base,
    ...raw,
    id: raw.id ?? base.id,
    kind: (raw.kind ?? base.kind) as UtilityKind,
    method: raw.method === 'direct' ? 'direct' : 'meter',
    startReading: Number(raw.startReading ?? 0) || 0,
    endReading: Number(raw.endReading ?? 0) || 0,
    kvts: Number(raw.kvts ?? 1) || 1,
    unitPrice: Number(raw.unitPrice ?? 0) || 0,
    directAmount: Number(raw.directAmount ?? 0) || 0,
    hasSurcharge: Boolean(raw.hasSurcharge),
    vatPercent: Number(raw.vatPercent ?? 0) || 0,
    extraCharge: Number(raw.extraCharge ?? 0) || 0,
    title: String(raw.title ?? ''),
    note: String(raw.note ?? ''),
    createdAt: raw.createdAt ?? base.createdAt,
    updatedAt: raw.updatedAt ?? base.updatedAt,
  }
}
