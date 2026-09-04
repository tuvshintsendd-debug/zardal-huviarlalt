export interface AllocationBasis {
  id: string
  name: string
  weight: number
  active: boolean
  builtIn: boolean
}

const STORAGE_KEY = 'azh.allocation-bases.v1'

const BUILT_IN_BASES: Array<Omit<AllocationBasis, 'id'>> = [
  { name: 'Ажилтны тоо', weight: 0, active: false, builtIn: true },
  { name: 'Машин цаг', weight: 0, active: false, builtIn: true },
  { name: 'Хөдөлмөрийн цаг', weight: 0, active: false, builtIn: true },
  { name: 'Талбайн хэмжээ (м²)', weight: 0, active: false, builtIn: true },
  { name: 'Тоолуурын бодит хэрэглээ', weight: 0, active: false, builtIn: true },
]

function createId(): string {
  return `basis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function defaultAllocationBases(): AllocationBasis[] {
  return BUILT_IN_BASES.map((basis) => ({ ...basis, id: createId() }))
}

export function loadAllocationBases(): AllocationBasis[] {
  if (typeof window === 'undefined' || !window.localStorage) return defaultAllocationBases()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultAllocationBases()
    const parsed = JSON.parse(raw) as AllocationBasis[]
    if (!Array.isArray(parsed)) return defaultAllocationBases()
    return parsed.filter((basis) => basis && typeof basis.name === 'string').map((basis) => ({
      id: basis.id || createId(),
      name: basis.name.trim(),
      weight: Number(basis.weight) || 0,
      active: Boolean(basis.active),
      builtIn: Boolean(basis.builtIn),
    }))
  } catch {
    return defaultAllocationBases()
  }
}

export function saveAllocationBases(bases: AllocationBasis[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bases))
}

export function totalActiveWeight(bases: AllocationBasis[]): number {
  return bases.reduce((sum, basis) => sum + (basis.active ? basis.weight : 0), 0)
}

export function isWeightComplete(bases: AllocationBasis[]): boolean {
  return Math.abs(totalActiveWeight(bases) - 100) < 0.0001
}

export function createCustomBasis(name: string): AllocationBasis {
  return { id: createId(), name: name.trim(), weight: 0, active: true, builtIn: false }
}
