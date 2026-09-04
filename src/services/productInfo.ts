import type { ProductInfoModel } from '../types'
import { createId } from '../utils/id'

export const PRODUCT_INFO_FIELD_LABELS: Record<keyof ProductInfoModel, string> = {
  id: 'ID',
  ErpCode: 'ERP код',
  ProductName: 'Бүтээгдэхүүний нэр',
  Unit: 'Хэмжих нэгж',
  MachineHours: 'Машин цаг',
  BatchTheoreticalQty: '1 цувралын онол тоо',
  FactoryName: 'Үйлдвэрийн нэр',
}

export const PRODUCT_INFO_ALIASES: Record<keyof ProductInfoModel, string[]> = {
  id: ['ID'],
  ErpCode: ['ERP код', 'ErpCode', 'ERP Code', 'erp code', 'erpcode'],
  ProductName: ['Бүтээгдэхүүний нэр', 'ProductName', 'Product Name', 'product name'],
  Unit: ['Хэмжих нэгж', 'Unit', 'unit'],
  MachineHours: ['Машин цаг', 'MachineHours', 'Machine Hours', 'machine hours'],
  BatchTheoreticalQty: ['1 цувралын онол тоо', 'BatchTheoreticalQty', 'Batch Theoretical Qty', 'batch theoretical qty'],
  FactoryName: ['Үйлдвэрийн нэр', 'FactoryName', 'Factory Name', 'factory name'],
}

export function createEmptyProductInfoRow(): ProductInfoModel {
  return {
    id: createId(),
    ErpCode: '',
    ProductName: '',
    Unit: '',
    MachineHours: 0,
    BatchTheoreticalQty: 0,
    FactoryName: '',
  }
}

export function loadProductInfoRows(): ProductInfoModel[] {
  if (typeof window === 'undefined' || !window.localStorage) return []

  try {
    const text = window.localStorage.getItem('zardal.electricity.productInfo.v1')
    if (!text) return []

    const parsed = JSON.parse(text) as ProductInfoModel[]
    if (!Array.isArray(parsed)) return []

    return parsed.map((row) => ({
      id: String(row.id ?? createId()),
      ErpCode: String(row.ErpCode ?? '').trim(),
      ProductName: String(row.ProductName ?? '').trim(),
      Unit: String(row.Unit ?? '').trim(),
      MachineHours: Number(row.MachineHours) || 0,
      BatchTheoreticalQty: Number(row.BatchTheoreticalQty) || 0,
      FactoryName: String(row.FactoryName ?? '').trim(),
    }))
  } catch {
    return []
  }
}

export function saveProductInfoRows(rows: ProductInfoModel[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  window.localStorage.setItem('zardal.electricity.productInfo.v1', JSON.stringify(rows))
}

function normalizeHeader(value: string): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function extractValue(row: Record<string, unknown>, aliases: string[]): string {
  const normalized = Object.keys(row).reduce<Record<string, unknown>>((result, key) => {
    result[normalizeHeader(key)] = row[key]
    return result
  }, {})

  for (const alias of aliases) {
    const key = normalizeHeader(alias)
    if (key in normalized) {
      const found = normalized[key]
      return String(found ?? '').trim()
    }
  }

  return ''
}

function parseDecimal(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null

  const normalized = String(value).trim().replace(/\s+/g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseProductInfoRow(row: Record<string, unknown>): { row?: ProductInfoModel; error?: string } {
  const ErpCode = extractValue(row, PRODUCT_INFO_ALIASES.ErpCode)
  const ProductName = extractValue(row, PRODUCT_INFO_ALIASES.ProductName)
  const Unit = extractValue(row, PRODUCT_INFO_ALIASES.Unit)
  const rawMachineHours = extractValue(row, PRODUCT_INFO_ALIASES.MachineHours)
  const rawBatchTheoreticalQty = extractValue(row, PRODUCT_INFO_ALIASES.BatchTheoreticalQty)
  const FactoryName = extractValue(row, PRODUCT_INFO_ALIASES.FactoryName)

  if (!ErpCode || !ProductName || !Unit || !FactoryName) {
    return {
      error: 'Шаардлагатай талбаруудын нэг нь хоосон байна.',
    }
  }

  const MachineHours = parseDecimal(rawMachineHours)
  const BatchTheoreticalQty = parseDecimal(rawBatchTheoreticalQty)

  if (MachineHours === null) {
    return { error: 'Машин цаг талбар буруу байна.' }
  }

  if (BatchTheoreticalQty === null) {
    return { error: '1 цувралын онол тоо талбар буруу байна.' }
  }

  return {
    row: {
      id: createId(),
      ErpCode: ErpCode.trim(),
      ProductName: ProductName.trim(),
      Unit: Unit.trim(),
      MachineHours,
      BatchTheoreticalQty,
      FactoryName: FactoryName.trim(),
    },
  }
}

export function findDuplicateErpCodes(rows: ProductInfoModel[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  rows.forEach((row) => {
    const code = row.ErpCode.trim()
    if (!code) return
    if (seen.has(code)) {
      duplicates.add(code)
      return
    }
    seen.add(code)
  })

  return Array.from(duplicates)
}

export async function importProductInfoFromExcel(file: File): Promise<{
  rows: ProductInfoModel[]
  errors: string[]
  duplicateCodes: string[]
}> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', raw: true })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    return { rows: [], errors: ['Excel sheet олдсонгүй.'], duplicateCodes: [] }
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], { defval: '' })
  const parsedRows: ProductInfoModel[] = []
  const errors: string[] = []
  const seen = new Set<string>()

  rows.forEach((row, index) => {
    const isEmpty = Object.values(row).every((value) => String(value ?? '').trim() === '')
    if (isEmpty) return

    const result = parseProductInfoRow(row)
    if (result.error) {
      errors.push(`${index + 2}-р мөр: ${result.error}`)
      return
    }

    if (!result.row) return

    const code = result.row.ErpCode.trim()
    if (code) {
      if (seen.has(code)) {
        errors.push(`${index + 2}-р мөр: ERP код давхардаж байна (${code})`)
        return
      }
      seen.add(code)
    }

    parsedRows.push(result.row)
  })

  return {
    rows: parsedRows,
    errors,
    duplicateCodes: findDuplicateErpCodes(parsedRows),
  }
}
