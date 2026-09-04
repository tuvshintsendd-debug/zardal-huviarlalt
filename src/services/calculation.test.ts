import { describe, expect, it } from 'vitest'
import {
  calculateBill,
  calculateUsage,
  createEmptyBill,
  summarizeByKind,
  totalAmountOf,
  validateBill,
} from './calculation'
import type { UtilityBill } from '../types'

function makeBill(overrides: Partial<UtilityBill>): UtilityBill {
  return { ...createEmptyBill(), ...overrides }
}

describe('Цахилгааны зардал — заалтаар', () => {
  const bill = makeBill({
    kind: 'electricity',
    period: '2026-08',
    title: 'Гален цех',
    method: 'meter',
    startReading: 125400,
    endReading: 138900,
    kvts: 1,
    unitPrice: 190.5,
  })

  it('Хэрэглээ = Сүүлийн заалт − Эхний заалт', () => {
    expect(calculateUsage(bill)).toBe(13500)
  })

  it('Квц-ийн утгыг хэрэглээнд үржүүлнэ', () => {
    expect(calculateUsage({ ...bill, kvts: 0.5 })).toBe(6750)
  })

  it('Квц 0 бол алдаа', () => {
    const errors = validateBill({ ...bill, kvts: 0 })
    expect(errors.kvts).toBeDefined()
  })

  it('Үндсэн дүн = Хэрэглээ × Нэгж үнэ', () => {
    expect(calculateBill(bill).baseAmount).toBe(2571750)
  })

  it('НӨАТ 10% нэмэгдэнэ', () => {
    const withVat = { ...bill, hasSurcharge: true, vatPercent: 10 }
    const calc = calculateBill(withVat)
    expect(calc.vatAmount).toBe(257175)
    expect(calc.totalAmount).toBe(2828925)
  })

  it('НӨАТ ба нэмэлт төлбөр хоёулаа нэмэгдэнэ', () => {
    const withBoth = {
      ...bill,
      hasSurcharge: true,
      vatPercent: 10,
      extraCharge: 25000,
    }
    const calc = calculateBill(withBoth)
    expect(calc.surchargeAmount).toBe(282175)
    expect(calc.totalAmount).toBe(2853925)
  })

  it('hasSurcharge=false үед НӨАТ бодохгүй', () => {
    const calc = calculateBill({ ...bill, hasSurcharge: false, vatPercent: 10 })
    expect(calc.vatAmount).toBe(0)
    expect(calc.totalAmount).toBe(2571750)
  })
})

describe('Дулаан / ус — нийт дүнгээр', () => {
  const heat = makeBill({
    kind: 'heat',
    period: '2026-08',
    title: 'ДДЭШ',
    method: 'direct',
    directAmount: 4850000,
    hasSurcharge: true,
    vatPercent: 10,
    extraCharge: 25000,
  })

  it('Шууд дүнгээр тооцоход хэрэглээ null байна', () => {
    expect(calculateBill(heat).usage).toBeNull()
  })

  it('Нийт дүн = Дүн + НӨАТ + Нэмэлт', () => {
    const calc = calculateBill(heat)
    expect(calc.baseAmount).toBe(4850000)
    expect(calc.vatAmount).toBe(485000)
    expect(calc.totalAmount).toBe(5360000)
  })

  it('Усны хувьд заалтаар ч тооцож болно', () => {
    const water = makeBill({
      kind: 'water',
      method: 'meter',
      startReading: 8120,
      endReading: 8940,
      unitPrice: 1450,
    })
    expect(calculateBill(water).totalAmount).toBe(1189000)
  })
})

describe('Бутархай ба хөвөгч цэгийн нарийвчлал', () => {
  it('0.1 + 0.2 маягийн алдаа гарахгүй', () => {
    const bill = makeBill({
      method: 'meter',
      startReading: 100.1,
      endReading: 100.3,
      kvts: 1,
      unitPrice: 10,
    })
    expect(calculateUsage(bill)).toBe(0.2)
    expect(calculateBill(bill).baseAmount).toBe(2)
  })
})

describe('Нэгтгэл', () => {
  const bills = [
    makeBill({ kind: 'electricity', method: 'direct', directAmount: 1000 }),
    makeBill({ kind: 'electricity', method: 'direct', directAmount: 500 }),
    makeBill({
      kind: 'water',
      method: 'meter',
      startReading: 0,
      endReading: 100,
      unitPrice: 20,
    }),
  ]

  it('Төрөл тус бүрээр нийлбэр гаргана', () => {
    const summaries = summarizeByKind(bills)
    const electricity = summaries.find((s) => s.kind === 'electricity')!
    const water = summaries.find((s) => s.kind === 'water')!
    const heat = summaries.find((s) => s.kind === 'heat')!

    expect(electricity.count).toBe(2)
    expect(electricity.totalAmount).toBe(1500)
    expect(water.usage).toBe(100)
    expect(water.totalAmount).toBe(2000)
    expect(heat.count).toBe(0)
    expect(heat.totalAmount).toBe(0)
  })

  it('Нийт дүн', () => {
    expect(totalAmountOf(bills)).toBe(3500)
  })
})

describe('Шалгалт', () => {
  it('Сүүлийн заалт эхнийхээс бага бол алдаа', () => {
    const errors = validateBill(
      makeBill({
        title: 'Тест',
        period: '2026-08',
        method: 'meter',
        startReading: 500,
        endReading: 400,
        unitPrice: 10,
      }),
    )
    expect(errors.endReading).toBeDefined()
  })

  it('Нэгж үнэ 0 бол алдаа', () => {
    const errors = validateBill(
      makeBill({ title: 'Тест', period: '2026-08', method: 'meter', unitPrice: 0 }),
    )
    expect(errors.unitPrice).toBeDefined()
  })

  it('Шууд дүн 0 бол алдаа', () => {
    const errors = validateBill(
      makeBill({ title: 'Тест', period: '2026-08', method: 'direct', directAmount: 0 }),
    )
    expect(errors.directAmount).toBeDefined()
  })

  it('Зөв бичилтэд алдаа гарахгүй', () => {
    const errors = validateBill(
      makeBill({
        title: 'Гален цех',
        period: '2026-08',
        method: 'meter',
        startReading: 100,
        endReading: 200,
        unitPrice: 190,
      }),
    )
    expect(Object.keys(errors)).toHaveLength(0)
  })
})
