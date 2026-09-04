import { describe, expect, it } from 'vitest'
import type { AllocationBasis } from './allocation'
import { allocateDepartments } from './departmentAllocation'

const bases: AllocationBasis[] = [
  { id: 'area', name: 'Талбай', weight: 50, active: true, builtIn: true },
  { id: 'staff', name: 'Ажилтан', weight: 50, active: true, builtIn: true },
]

const departments = [
  { id: 'a', name: 'А цех', values: { area: 100, staff: 10 } },
  { id: 'b', name: 'Б цех', values: { area: 300, staff: 30 } },
]

describe('Цехийн зардал хуваарилалт', () => {
  it('идэвхтэй сууриудын жинтэй эзлэх хувийг үржүүлж тооцно', () => {
    const result = allocateDepartments(1000, departments, bases)

    expect(result[0].share).toBe(25)
    expect(result[0].amount).toBe(250)
    expect(result[1].share).toBe(75)
    expect(result[1].amount).toBe(750)
  })

  it('нийлбэр нь нийт зардалтай тэнцэнэ', () => {
    const result = allocateDepartments(125000, departments, bases)
    expect(result.reduce((sum, department) => sum + department.amount, 0)).toBe(125000)
  })
})
