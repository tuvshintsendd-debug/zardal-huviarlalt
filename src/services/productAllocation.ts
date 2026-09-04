import type { AllocationBasis } from './allocation'
import type { Department } from './departmentAllocation'
import { allocateDepartments } from './departmentAllocation'
import type { BillWithCalc, UtilityKind } from '../types'

export interface Product {
  id: string
  departmentId: string
  name: string
  code: string
  quantity: number
  values: Record<string, number>
}

export interface ProductAllocation extends Product {
  electricity: number
  heat: number
  water: number
  total: number
  unitCost: number
}

const STORAGE_KEY = 'azh.products.v1'

export const PRODUCT_COLUMNS = {
  department: 'Цех/алба',
  name: 'Бүтээгдэхүүний нэр',
  code: 'Бүтээгдэхүүний код',
  quantity: 'Үйлдвэрлэсэн тоо',
  machineHours: 'Машин цаг',
  laborHours: 'Хөдөлмөрийн цаг',
} as const

function createId(): string {
  return `product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createEmptyProduct(bases: AllocationBasis[], departmentId = ''): Product {
  return {
    id: createId(),
    departmentId,
    name: '',
    code: '',
    quantity: 0,
    values: Object.fromEntries(bases.map((basis) => [basis.id, 0])),
  }
}

export function loadProducts(): Product[] {
  if (typeof window === 'undefined' || !window.localStorage) return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as Product[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((product) => ({
      id: product.id || createId(),
      departmentId: String(product.departmentId ?? ''),
      name: String(product.name ?? ''),
      code: String(product.code ?? ''),
      quantity: Number(product.quantity) || 0,
      values: Object.fromEntries(Object.entries(product.values ?? {}).map(([id, value]) => [id, Number(value) || 0])),
    }))
  } catch {
    return []
  }
}

export function saveProducts(products: Product[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(products))
}

export async function importProductsFromExcel(
  file: File,
  departments: Department[],
  bases: AllocationBasis[],
): Promise<Product[]> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' })
  const findValue = (row: Record<string, unknown>, label: string) => {
    const key = Object.keys(row).find((item) => item.trim().toLowerCase() === label.toLowerCase())
    return key ? row[key] : ''
  }
  return rows.map((row) => {
    const departmentName = String(findValue(row, PRODUCT_COLUMNS.department)).trim()
    const department = departments.find((item) => item.name.trim() === departmentName)
    const values: Record<string, number> = {}
    for (const basis of bases) {
      const label = basis.name === 'Машин цаг'
        ? PRODUCT_COLUMNS.machineHours
        : basis.name === 'Хөдөлмөрийн цаг'
          ? PRODUCT_COLUMNS.laborHours
          : basis.name
      values[basis.id] = Number(findValue(row, label)) || 0
    }
    return {
      ...createEmptyProduct(bases, department?.id ?? ''),
      departmentId: department?.id ?? '',
      name: String(findValue(row, PRODUCT_COLUMNS.name)).trim(),
      code: String(findValue(row, PRODUCT_COLUMNS.code)).trim(),
      quantity: Number(findValue(row, PRODUCT_COLUMNS.quantity)) || 0,
      values,
    }
  }).filter((product) => product.name || product.code)
}

function allocateKind(
  cost: number,
  departments: Department[],
  products: Product[],
  bases: AllocationBasis[],
): Map<string, number> {
  const departmentCosts = allocateDepartments(cost, departments, bases)
  const result = new Map<string, number>()
  for (const department of departments) {
    const departmentProducts = products.filter((product) => product.departmentId === department.id)
    const activeBases = bases.filter((basis) => basis.active && basis.weight > 0)
    const totals = new Map(activeBases.map((basis) => [
      basis.id,
      departmentProducts.reduce((sum, product) => sum + productBasisValue(product, basis), 0),
    ]))
    const departmentCost = departmentCosts.find((item) => item.id === department.id)?.amount ?? 0
    for (const product of departmentProducts) {
      const share = activeBases.reduce((sum, basis) => {
        const total = totals.get(basis.id) ?? 0
        return sum + (basis.weight / 100) * (productBasisValue(product, basis) / (total || 1))
      }, 0)
      result.set(product.id, departmentCost * share)
    }
  }
  return result
}

function productBasisValue(product: Product, basis: AllocationBasis): number {
  if (basis.name === 'Бүтээгдэхүүний үйлдвэрлэсэн тоо') return product.quantity
  return product.values[basis.id] ?? 0
}

export function allocateProducts(
  bills: BillWithCalc[],
  departments: Department[],
  products: Product[],
  bases: AllocationBasis[],
): ProductAllocation[] {
  const costs = new Map<UtilityKind, number>([
    ['electricity', bills.filter((bill) => bill.kind === 'electricity').reduce((sum, bill) => sum + bill.calc.totalAmount, 0)],
    ['heat', bills.filter((bill) => bill.kind === 'heat').reduce((sum, bill) => sum + bill.calc.totalAmount, 0)],
    ['water', bills.filter((bill) => bill.kind === 'water').reduce((sum, bill) => sum + bill.calc.totalAmount, 0)],
  ])
  const byKind = new Map([...costs].map(([kind, cost]) => [kind, allocateKind(cost, departments, products, bases)]))
  return products.map((product) => {
    const electricity = byKind.get('electricity')?.get(product.id) ?? 0
    const heat = byKind.get('heat')?.get(product.id) ?? 0
    const water = byKind.get('water')?.get(product.id) ?? 0
    const total = electricity + heat + water
    return { ...product, electricity, heat, water, total, unitCost: product.quantity > 0 ? total / product.quantity : 0 }
  })
}
