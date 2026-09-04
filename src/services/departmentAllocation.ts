import type { AllocationBasis } from './allocation'

export interface Department {
  id: string
  name: string
  values: Record<string, number>
}

export interface DepartmentAllocation extends Department {
  amount: number
  share: number
}

const STORAGE_KEY = 'azh.departments.v1'

function createId(): string {
  return `department-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createEmptyDepartment(bases: AllocationBasis[]): Department {
  return {
    id: createId(),
    name: '',
    values: Object.fromEntries(bases.map((basis) => [basis.id, 0])),
  }
}

export function loadDepartments(): Department[] {
  if (typeof window === 'undefined' || !window.localStorage) return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as Department[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((department) => ({
      id: department.id || createId(),
      name: String(department.name ?? ''),
      values: Object.fromEntries(
        Object.entries(department.values ?? {}).map(([basisId, value]) => [basisId, Number(value) || 0]),
      ),
    }))
  } catch {
    return []
  }
}

export function saveDepartments(departments: Department[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(departments))
}

export function allocateDepartments(
  totalCost: number,
  departments: Department[],
  bases: AllocationBasis[],
): DepartmentAllocation[] {
  const activeBases = bases.filter((basis) => basis.active && basis.weight > 0)
  const basisTotals = new Map(
    activeBases.map((basis) => [
      basis.id,
      departments.reduce((sum, department) => sum + (department.values[basis.id] ?? 0), 0),
    ]),
  )

  return departments.map((department) => {
    const share = activeBases.reduce((sum, basis) => {
      const total = basisTotals.get(basis.id) ?? 0
      const departmentValue = department.values[basis.id] ?? 0
      const basisShare = total > 0 ? departmentValue / total : 0
      return sum + (basis.weight / 100) * basisShare
    }, 0)

    return {
      ...department,
      amount: totalCost * share,
      share: share * 100,
    }
  })
}
