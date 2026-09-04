import { describe, expect, it } from 'vitest'
import type { AllocationBasis } from './allocation'
import { allocateProducts } from './productAllocation'

const bases: AllocationBasis[] = [
  { id: 'area', name: 'Талбай', weight: 50, active: true, builtIn: true },
  { id: 'staff', name: 'Ажилтан', weight: 50, active: true, builtIn: true },
]

const departments = [
  { id: 'a', name: 'А цех', values: { area: 100, staff: 10 } },
  { id: 'b', name: 'Б цех', values: { area: 100, staff: 10 } },
]

const bills = [
  { kind: 'electricity', calc: { totalAmount: 1000 } },
  { kind: 'heat', calc: { totalAmount: 500 } },
  { kind: 'water', calc: { totalAmount: 250 } },
] as never[]

describe('Бүтээгдэхүүний дахин хуваарилалт', () => {
  it('цехийн зардлыг бүтээгдэхүүнд суурийн жингээр дахин хуваарилна', () => {
    const products = [
      { id: 'p1', departmentId: 'a', name: 'А', code: 'A', quantity: 10, values: { area: 25, staff: 10 } },
      { id: 'p2', departmentId: 'a', name: 'Б', code: 'B', quantity: 20, values: { area: 75, staff: 10 } },
      { id: 'p3', departmentId: 'b', name: 'В', code: 'V', quantity: 10, values: { area: 100, staff: 10 } },
    ]
    const result = allocateProducts(bills, departments, products, bases)

    expect(result[0].electricity).toBe(187.5)
    expect(result[1].electricity).toBe(312.5)
    expect(result[2].electricity).toBe(500)
    expect(result[0].total).toBe(328.125)
    expect(result[0].unitCost).toBe(32.8125)
  })
})