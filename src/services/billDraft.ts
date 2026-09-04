import type { CalcMethod, UtilityBill, UtilityKind } from '../types'
import { createEmptyBill } from './calculation'
import { parseNumber } from '../utils/format'

/**
 * Формын түр төлөв. Тоон талбаруудыг string хэлбэрээр барьж байгаа нь
 * хэрэглэгч "0" гэсэн утгыг арилгаж бичих боломжтой байхын тулд.
 */
export interface BillDraft {
  id: string
  kind: UtilityKind
  period: string
  title: string
  method: CalcMethod
  startReading: string
  endReading: string
  kvts: string
  unitPrice: string
  directAmount: string
  hasSurcharge: boolean
  vatPercent: string
  extraCharge: string
  note: string
  createdAt: string
}

function numToText(value: number): string {
  return value === 0 ? '' : String(value)
}

export function billToDraft(bill: UtilityBill): BillDraft {
  return {
    id: bill.id,
    kind: bill.kind,
    period: bill.period,
    title: bill.title,
    method: bill.method,
    startReading: numToText(bill.startReading),
    endReading: numToText(bill.endReading),
    kvts: numToText(bill.kvts),
    unitPrice: numToText(bill.unitPrice),
    directAmount: numToText(bill.directAmount),
    hasSurcharge: bill.hasSurcharge,
    vatPercent: numToText(bill.vatPercent),
    extraCharge: numToText(bill.extraCharge),
    note: bill.note,
    createdAt: bill.createdAt,
  }
}

export function emptyDraft(kind: UtilityKind, period: string): BillDraft {
  return billToDraft(createEmptyBill(kind, period))
}

export function draftToBill(draft: BillDraft): UtilityBill {
  const now = new Date().toISOString()
  return {
    id: draft.id,
    kind: draft.kind,
    period: draft.period,
    title: draft.title.trim(),
    method: draft.method,
    startReading: parseNumber(draft.startReading),
    endReading: parseNumber(draft.endReading),
    kvts: parseNumber(draft.kvts),
    unitPrice: parseNumber(draft.unitPrice),
    directAmount: parseNumber(draft.directAmount),
    hasSurcharge: draft.hasSurcharge,
    vatPercent: draft.hasSurcharge ? parseNumber(draft.vatPercent) : 0,
    extraCharge: draft.hasSurcharge ? parseNumber(draft.extraCharge) : 0,
    note: draft.note.trim(),
    createdAt: draft.createdAt,
    updatedAt: now,
  }
}
