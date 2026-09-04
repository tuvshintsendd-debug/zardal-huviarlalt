import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { COLUMNS, importBillsFromExcel } from './excel'
import { calculateBill } from './calculation'

/** Хүснэгтийн мөрүүдээс xlsx File үүсгэх (браузерын оронд санах ойд) */
function makeXlsxFile(rows: Record<string, string | number>[]): File {
  const sheet = XLSX.utils.json_to_sheet(rows, {
    header: Object.values(COLUMNS) as string[],
  })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Ашиглалтын зардал')
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new File([buffer], 'test.xlsx')
}

const validRow = {
  [COLUMNS.kind]: 'Цахилгаан',
  [COLUMNS.period]: '2026-08',
  [COLUMNS.title]: 'Гален цех',
  [COLUMNS.method]: 'Заалтаар тооцох',
  [COLUMNS.startReading]: 125400,
  [COLUMNS.endReading]: 138900,
  [COLUMNS.kvts]: 0.5,
  [COLUMNS.unitPrice]: 190.5,
  [COLUMNS.vatPercent]: 10,
  [COLUMNS.extraCharge]: 0,
  [COLUMNS.note]: 'жишээ',
}

describe('Excel импорт', () => {
  it('Заалттай мөрийг зөв уншиж тооцоолно', async () => {
    const result = await importBillsFromExcel(makeXlsxFile([validRow]))

    expect(result.errors).toHaveLength(0)
    expect(result.bills).toHaveLength(1)

    const bill = result.bills[0]
    expect(bill.kind).toBe('electricity')
    expect(bill.period).toBe('2026-08')
    expect(bill.method).toBe('meter')
    expect(bill.startReading).toBe(125400)
    expect(bill.kvts).toBe(0.5)
    expect(bill.hasSurcharge).toBe(true)

    const calc = calculateBill(bill)
    expect(calc.usage).toBe(6750)
    expect(calc.totalAmount).toBe(1414462.5)
  })

  it('Нийт дүнгээр оруулсан мөрийг уншина', async () => {
    const result = await importBillsFromExcel(
      makeXlsxFile([
        {
          [COLUMNS.kind]: 'Дулаан',
          [COLUMNS.period]: '2026-08',
          [COLUMNS.title]: 'ДДЭШ',
          [COLUMNS.method]: 'Нийт дүнгээр оруулах',
          [COLUMNS.directAmount]: 4850000,
          [COLUMNS.vatPercent]: 10,
        },
      ]),
    )

    expect(result.bills).toHaveLength(1)
    expect(result.bills[0].method).toBe('direct')
    expect(calculateBill(result.bills[0]).totalAmount).toBe(5335000)
  })

  it('2026/8 гэх мэт огнооны бичлэгийг хөрвүүлнэ', async () => {
    const result = await importBillsFromExcel(
      makeXlsxFile([{ ...validRow, [COLUMNS.period]: '2026/8' }]),
    )
    expect(result.bills[0].period).toBe('2026-08')
  })

  it('Танигдахгүй төрөлтэй мөрийг алгасаад алдаа мэдээлнэ', async () => {
    const result = await importBillsFromExcel(
      makeXlsxFile([validRow, { ...validRow, [COLUMNS.kind]: 'Хий' }]),
    )
    expect(result.bills).toHaveLength(1)
    expect(result.skipped).toBe(1)
    expect(result.errors[0]).toContain('3-р мөр')
  })

  it('Буруу заалттай мөрийг алгасна', async () => {
    const result = await importBillsFromExcel(
      makeXlsxFile([{ ...validRow, [COLUMNS.startReading]: 900, [COLUMNS.endReading]: 100 }]),
    )
    expect(result.bills).toHaveLength(0)
    expect(result.skipped).toBe(1)
  })

  it('Гарчгийн том/жижиг үсэг, илүү зайг үл тоомсорлоно', async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['  төрөл ', 'ТАЙЛАНТ САР', 'Нэр/Тайлбар', 'Тооцох арга', 'Эхний заалт', 'Сүүлийн заалт', 'Нэгж үнэ'],
      ['Ус', '2026-08', 'УСУГ', 'Заалтаар тооцох', 8120, 8940, 1450],
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Ашиглалтын зардал')
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

    const result = await importBillsFromExcel(new File([buffer], 'test.xlsx'))
    expect(result.bills).toHaveLength(1)
    expect(result.bills[0].kind).toBe('water')
    expect(calculateBill(result.bills[0]).totalAmount).toBe(1189000)
  })
})
