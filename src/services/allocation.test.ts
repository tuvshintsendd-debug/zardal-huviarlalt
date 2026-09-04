import { describe, expect, it } from 'vitest'
import {
  defaultAllocationBases,
  isWeightComplete,
  totalActiveWeight,
} from './allocation'

describe('Хуваарилалтын суурийн жин', () => {
  it('зөвхөн идэвхтэй суурийн жинг нийлүүлнэ', () => {
    const bases = defaultAllocationBases().map((basis, index) => ({
      ...basis,
      active: index < 2,
      weight: index < 2 ? 50 : 20,
    }))

    expect(totalActiveWeight(bases)).toBe(100)
    expect(isWeightComplete(bases)).toBe(true)
  })

  it('нийлбэр 100 биш бол тохиргоо бүрэн биш', () => {
    const bases = defaultAllocationBases().map((basis, index) => ({
      ...basis,
      active: index === 0,
      weight: index === 0 ? 80 : 0,
    }))

    expect(totalActiveWeight(bases)).toBe(80)
    expect(isWeightComplete(bases)).toBe(false)
  })
})