import type { WorkSheet } from 'xlsx'
import type { ImportResult, UtilityBill } from '../types'
import {
  KIND_BY_LABEL,
  METHOD_BY_LABEL,
  METHOD_LABELS,
  UTILITY_MAP,
} from '../constants/utilities'
import { calculateBill, createEmptyBill, summarizeByKind, totalAmountOf } from './calculation'
import { formatPeriod, normalizePeriod, parseNumber } from '../utils/format'
import { createId } from '../utils/id'

/** Excel-ийн баганын гарчгууд — импорт/экспорт хоёулаа үүнийг ашиглана */
export const COLUMNS = {
  kind: 'Төрөл',
  period: 'Тайлант сар',
  title: 'Нэр/Тайлбар',
  method: 'Тооцох арга',
  startReading: 'Эхний заалт',
  endReading: 'Сүүлийн заалт',
  kvts: 'Квц',
  unitPrice: 'Нэгж үнэ',
  usage: 'Хэрэглээ',
  unit: 'Хэмжих нэгж',
  directAmount: 'Нэхэмжлэлийн дүн',
  vatPercent: 'НӨАТ (%)',
  extraCharge: 'Нэмэлт төлбөр',
  baseAmount: 'Үндсэн дүн',
  vatAmount: 'НӨАТ-ын дүн',
  totalAmount: 'Нийт дүн',
  note: 'Тэмдэглэл',
} as const

type XlsxModule = typeof import('xlsx')

/**
 * xlsx сан ~500 kB тул анхны ачаалалтад оруулахгүй,
 * зөвхөн импорт/экспорт хийх мөчид динамикаар татна.
 */
function loadXlsx(): Promise<XlsxModule> {
  return import('xlsx')
}

const SHEET_NAME = 'Ашиглалтын зардал'
const SUMMARY_SHEET = 'Нэгтгэл'

const COLUMN_WIDTHS = [
  12, 12, 26, 22, 12, 13, 8, 11, 11, 11, 17, 9, 13, 14, 13, 15, 22,
].map((wch) => ({ wch }))

// ---------------------------------------------------------------- Экспорт

/** Тооцоолсон бичилтүүдийг xlsx болгож татах */
export async function exportBillsToExcel(
  bills: UtilityBill[],
  fileName = 'ashiglaltiin-zardal.xlsx',
): Promise<void> {
  const XLSX = await loadXlsx()
  const rows = bills.map((bill) => {
    const calc = calculateBill(bill)
    const meta = UTILITY_MAP[bill.kind]
    return {
      [COLUMNS.kind]: meta.label,
      [COLUMNS.period]: bill.period,
      [COLUMNS.title]: bill.title,
      [COLUMNS.method]: METHOD_LABELS[bill.method],
      [COLUMNS.startReading]: bill.method === 'meter' ? bill.startReading : '',
      [COLUMNS.endReading]: bill.method === 'meter' ? bill.endReading : '',
      [COLUMNS.kvts]: bill.method === 'meter' ? bill.kvts : '',
      [COLUMNS.unitPrice]: bill.method === 'meter' ? bill.unitPrice : '',
      [COLUMNS.usage]: calc.usage ?? '',
      [COLUMNS.unit]: bill.method === 'meter' ? meta.unit : '',
      [COLUMNS.directAmount]: bill.method === 'direct' ? bill.directAmount : '',
      [COLUMNS.vatPercent]: bill.hasSurcharge ? bill.vatPercent : 0,
      [COLUMNS.extraCharge]: bill.hasSurcharge ? bill.extraCharge : 0,
      [COLUMNS.baseAmount]: calc.baseAmount,
      [COLUMNS.vatAmount]: calc.vatAmount,
      [COLUMNS.totalAmount]: calc.totalAmount,
      [COLUMNS.note]: bill.note,
    }
  })

  const sheet = XLSX.utils.json_to_sheet(rows, {
    header: Object.values(COLUMNS) as string[],
  })
  sheet['!cols'] = COLUMN_WIDTHS

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, SHEET_NAME)
  XLSX.utils.book_append_sheet(workbook, buildSummarySheet(XLSX, bills), SUMMARY_SHEET)
  XLSX.writeFile(workbook, fileName)
}

function buildSummarySheet(XLSX: XlsxModule, bills: UtilityBill[]): WorkSheet {
  const summaries = summarizeByKind(bills)
  const rows = summaries.map((summary) => {
    const meta = UTILITY_MAP[summary.kind]
    return {
      Төрөл: meta.label,
      'Бичилтийн тоо': summary.count,
      Хэрэглээ: summary.usage,
      'Хэмжих нэгж': meta.unit,
      'Нийт дүн (₮)': summary.totalAmount,
    }
  })

  rows.push({
    Төрөл: 'НИЙТ ДҮН',
    'Бичилтийн тоо': bills.length,
    Хэрэглээ: '' as unknown as number,
    'Хэмжих нэгж': '',
    'Нийт дүн (₮)': totalAmountOf(bills),
  })

  const sheet = XLSX.utils.json_to_sheet(rows)
  sheet['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 13 }, { wch: 18 }]
  return sheet
}

/** Хоосон загвар файл татах (хэрэглэгч бөглөөд буцааж импортлоно) */
export async function downloadTemplate(
  fileName = 'zardal-oruulah-zagvar.xlsx',
): Promise<void> {
  const XLSX = await loadXlsx()
  const example: Record<string, string | number>[] = [
    {
      [COLUMNS.kind]: 'Цахилгаан',
      [COLUMNS.period]: '2026-08',
      [COLUMNS.title]: 'Гален цех — үндсэн тоолуур',
      [COLUMNS.method]: METHOD_LABELS.meter,
      [COLUMNS.startReading]: 125400,
      [COLUMNS.endReading]: 138900,
      [COLUMNS.kvts]: 1,
      [COLUMNS.unitPrice]: 190.5,
      [COLUMNS.usage]: '',
      [COLUMNS.unit]: '',
      [COLUMNS.directAmount]: '',
      [COLUMNS.vatPercent]: 10,
      [COLUMNS.extraCharge]: 0,
      [COLUMNS.baseAmount]: '',
      [COLUMNS.vatAmount]: '',
      [COLUMNS.totalAmount]: '',
      [COLUMNS.note]: 'Заалтаар тооцсон жишээ',
    },
    {
      [COLUMNS.kind]: 'Дулаан',
      [COLUMNS.period]: '2026-08',
      [COLUMNS.title]: 'ДДЭШ нэхэмжлэл',
      [COLUMNS.method]: METHOD_LABELS.direct,
      [COLUMNS.startReading]: '',
      [COLUMNS.endReading]: '',
      [COLUMNS.kvts]: '',
      [COLUMNS.unitPrice]: '',
      [COLUMNS.usage]: '',
      [COLUMNS.unit]: '',
      [COLUMNS.directAmount]: 4850000,
      [COLUMNS.vatPercent]: 10,
      [COLUMNS.extraCharge]: 25000,
      [COLUMNS.baseAmount]: '',
      [COLUMNS.vatAmount]: '',
      [COLUMNS.totalAmount]: '',
      [COLUMNS.note]: 'Нийт дүнгээр оруулсан жишээ',
    },
    {
      [COLUMNS.kind]: 'Ус',
      [COLUMNS.period]: '2026-08',
      [COLUMNS.title]: 'УСУГ — үйлдвэрийн ус',
      [COLUMNS.method]: METHOD_LABELS.meter,
      [COLUMNS.startReading]: 8120,
      [COLUMNS.endReading]: 8940,
      [COLUMNS.kvts]: 1,
      [COLUMNS.unitPrice]: 1450,
      [COLUMNS.usage]: '',
      [COLUMNS.unit]: '',
      [COLUMNS.directAmount]: '',
      [COLUMNS.vatPercent]: 0,
      [COLUMNS.extraCharge]: 0,
      [COLUMNS.baseAmount]: '',
      [COLUMNS.vatAmount]: '',
      [COLUMNS.totalAmount]: '',
      [COLUMNS.note]: '',
    },
  ]

  const sheet = XLSX.utils.json_to_sheet(example, {
    header: Object.values(COLUMNS) as string[],
  })
  sheet['!cols'] = COLUMN_WIDTHS

  const guide = XLSX.utils.aoa_to_sheet([
    ['Ашиглалтын зардал оруулах загвар — заавар'],
    [],
    [`${COLUMNS.kind}`, 'Цахилгаан / Дулаан / Ус гэсэн гурвын нэг'],
    [`${COLUMNS.period}`, 'YYYY-MM хэлбэрээр. Жишээ: 2026-08'],
    [`${COLUMNS.method}`, `${METHOD_LABELS.meter} эсвэл ${METHOD_LABELS.direct}`],
    [
      `${COLUMNS.startReading} / ${COLUMNS.endReading} / ${COLUMNS.kvts} / ${COLUMNS.unitPrice}`,
      'Зөвхөн "Заалтаар тооцох" үед бөглөнө. Квц нь заалтын зөрүүтэй үржинэ.',
    ],
    [`${COLUMNS.directAmount}`, 'Зөвхөн "Нийт дүнгээр оруулах" үед бөглөнө'],
    [`${COLUMNS.vatPercent}`, 'Жишээ: 10. НӨАТ бодохгүй бол 0'],
    [`${COLUMNS.extraCharge}`, 'Тогтмол дүнтэй нэмэлт төлбөр (₮). Байхгүй бол 0'],
    [],
    ['Тооцоолол', 'Хэрэглээ = Сүүлийн заалт − Эхний заалт'],
    ['', 'Хэрэглээ = (Сүүлийн заалт − Эхний заалт) × Квц'],
    ['', 'Үндсэн дүн = Хэрэглээ × Нэгж үнэ (эсвэл нэхэмжлэлийн дүн)'],
    ['', 'Нийт дүн = Үндсэн дүн + НӨАТ + Нэмэлт төлбөр'],
    [],
    [
      'Анхаар',
      'Хэрэглээ, Үндсэн дүн, НӨАТ-ын дүн, Нийт дүн баганыг систем өөрөө бодно — хоосон орхиж болно.',
    ],
  ])
  guide['!cols'] = [{ wch: 44 }, { wch: 70 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, SHEET_NAME)
  XLSX.utils.book_append_sheet(workbook, guide, 'Заавар')
  XLSX.writeFile(workbook, fileName)
}

// ---------------------------------------------------------------- Импорт

/** Гарчгийг харьцуулахад ашиглах — том/жижиг үсэг, зай үл хамаарна */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/\s+/g, ' ').trim()
}

type RawRow = Record<string, unknown>

function pick(row: RawRow, column: string): unknown {
  const target = normalizeHeader(column)
  for (const key of Object.keys(row)) {
    if (normalizeHeader(key) === target) return row[key]
  }
  return undefined
}

function pickText(row: RawRow, column: string): string {
  const value = pick(row, column)
  return value === undefined || value === null ? '' : String(value).trim()
}

function pickNumber(row: RawRow, column: string): number {
  return parseNumber(pick(row, column) as string | number | undefined)
}

/** xlsx файлыг уншиж UtilityBill жагсаалт болгох */
export async function importBillsFromExcel(file: File): Promise<ImportResult> {
  const XLSX = await loadXlsx()
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

  const sheetName =
    workbook.SheetNames.find((name) => name === SHEET_NAME) ?? workbook.SheetNames[0]
  if (!sheetName) {
    return { bills: [], errors: ['Файлаас хуудас олдсонгүй'], skipped: 0 }
  }

  const rows = XLSX.utils.sheet_to_json<RawRow>(workbook.Sheets[sheetName], {
    defval: '',
    raw: false,
  })

  const bills: UtilityBill[] = []
  const errors: string[] = []
  let skipped = 0

  rows.forEach((row, index) => {
    const excelRow = index + 2 // 1-р мөр гарчиг
    const kindText = pickText(row, COLUMNS.kind)
    const periodText = normalizePeriod(pick(row, COLUMNS.period))

    // Бүхэлдээ хоосон мөрийг чимээгүй алгасна
    const isEmpty = Object.values(row).every(
      (value) => value === '' || value === null || value === undefined,
    )
    if (isEmpty) return

    const kind = KIND_BY_LABEL[kindText.toLowerCase()]
    if (!kind) {
      errors.push(`${excelRow}-р мөр: "${COLUMNS.kind}" талбар танигдсангүй ("${kindText}")`)
      skipped += 1
      return
    }
    if (!/^\d{4}-\d{2}$/.test(periodText)) {
      errors.push(`${excelRow}-р мөр: "${COLUMNS.period}" буруу байна (YYYY-MM байх ёстой)`)
      skipped += 1
      return
    }

    const methodText = pickText(row, COLUMNS.method).toLowerCase()
    const directAmount = pickNumber(row, COLUMNS.directAmount)
    const method =
      METHOD_BY_LABEL[methodText] ?? (directAmount > 0 ? 'direct' : 'meter')

    const vatPercent = pickNumber(row, COLUMNS.vatPercent)
    const extraCharge = pickNumber(row, COLUMNS.extraCharge)

    const bill: UtilityBill = {
      ...createEmptyBill(kind, periodText),
      id: createId(),
      title: pickText(row, COLUMNS.title) || `${formatPeriod(periodText)} нэхэмжлэл`,
      method,
      startReading: pickNumber(row, COLUMNS.startReading),
      endReading: pickNumber(row, COLUMNS.endReading),
      kvts: pickNumber(row, COLUMNS.kvts) || 1,
      unitPrice: pickNumber(row, COLUMNS.unitPrice),
      directAmount,
      hasSurcharge: vatPercent > 0 || extraCharge > 0,
      vatPercent,
      extraCharge,
      note: pickText(row, COLUMNS.note),
    }

    if (method === 'meter' && bill.endReading < bill.startReading) {
      errors.push(`${excelRow}-р мөр: Сүүлийн заалт эхний заалтаас бага байна`)
      skipped += 1
      return
    }

    bills.push(bill)
  })

  if (bills.length === 0 && errors.length === 0) {
    errors.push('Файлд оруулах мөр олдсонгүй')
  }

  return { bills, errors, skipped }
}
