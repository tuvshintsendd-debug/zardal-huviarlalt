import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { OrgUnitInput } from './OrgUnitInput'
import { Step1BaseInput } from './Step1BaseInput'
import { Step2CostCalculation } from './Step2CostCalculation'

// Step1BaseInput нь төлвөө localStorage-д бичдэг тул цэвэрлэхгүй бол өмнөх
// тестийн багана/мөр дараагийнхад нь дамжина.
beforeEach(() => {
  window.localStorage.clear()
})

// OrgUnitInput нь controlled — жагсаалт нь units prop-оос ирнэ. Тиймээс
// onChange-ийг буцаагаад prop руу нь холбож өгөхгүй бол нэмсэн нэр гарч
// ирэхгүй.
function OrgUnitInputHarness() {
  const [units, setUnits] = useState<string[]>([])
  return <OrgUnitInput units={units} onChange={setUnits} />
}

describe('OrgUnitInput', () => {
  it('шинэ алба нэгж нэмэхэд давхардлыг зөвшөөрөхгүй', () => {
    render(<OrgUnitInputHarness />)

    fireEvent.change(screen.getByPlaceholderText('Алба нэгжийн нэр'), {
      target: { value: 'Санхүү хэлтэс' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Нэмэх' }))

    expect(screen.getByText('Санхүү хэлтэс')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('Алба нэгжийн нэр'), {
      target: { value: 'Санхүү хэлтэс' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Нэмэх' }))

    expect(screen.getAllByText('Санхүү хэлтэс')).toHaveLength(1)
  })
})

describe('Step1BaseInput', () => {
  it('алба нэгж байхгүй үед анхааруулж, мөр нэмэх боломжгүй', () => {
    render(
      <Step1BaseInput
        orgUnits={[]}
        selectedMetrics={['Ажилтны тоо', 'Бүтээгдэхүүний тоо']}
      />,
    )

    expect(screen.getByText('Эхлээд алба нэгжээ оруулна уу.')).toBeTruthy()
    // Алба нэгж байхгүй бол хүснэгт бүхэлдээ харагдахгүй тул "Мөр нэмэх"
    // товч disabled биш, огт байхгүй байна.
    expect(screen.queryByRole('button', { name: 'Мөр нэмэх' })).toBeNull()
  })

  it('олж буй алба нэгжүүдээс dropdown-оор сонгоно', () => {
    render(
      <Step1BaseInput
        orgUnits={['Санхүү хэлтэс', 'Үйлдвэрлэлийн хэлтэс']}
        selectedMetrics={['Ажилтны тоо']}
      />,
    )

    // Эхэндээ мөр байхгүй тул dropdown бас байхгүй — мөр нэмсний дараа л
    // алба нэгжийн select болон үзүүлэлтийн checkbox үүснэ.
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Мөр нэмэх' }))

    const unitSelect = screen.getByRole('combobox', { name: 'Алба нэгж сонгох' })
    expect(unitSelect).toBeTruthy()
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['Алба нэгж сонгох', 'Санхүү хэлтэс', 'Үйлдвэрлэлийн хэлтэс'])
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0)
  })

  it('Үйлдвэрлэсэн бүтээгдэхүүний тоо бүлэг 2-р алхамд харагдахгүй', () => {
    render(
      <Step2CostCalculation
        rows={[{ unit: 'Үйлдвэрлэлийн хэсэг', indicators: { 'Үйлдвэрлэсэн бүтээгдэхүүний тоо': true } }]}
        totalCost={1000}
        isProductManufactured={false}
      />,
    )

    expect(screen.queryByText('Үйлдвэрлэсэн бүтээгдэхүүний тоо')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Бүтээгдэхүүн оруулах' })).toBeNull()
  })

  it('алба нэгжийн карт дээр Excel оруулах товч харагдана', () => {
    render(
      <Step2CostCalculation
        rows={[{ unit: 'ХТЭҮйлдвэр', indicators: { 'Тоолуурын бодит хэрэглээ': true } }]}
        totalCost={228165}
      />,
    )

    // Бүтээгдэхүүн бүртгээгүй үед товч харагддаг ч дарах боломжгүй.
    const importButton = screen.getByRole('button', { name: 'Excel оруулах' })
    expect(importButton.hasAttribute('disabled')).toBe(true)
  })

  it('импорт хадгалсны дараа ч ХТЭЙлдвэрийн ерөнхий Зардал талбар харагдана', () => {
    window.localStorage.setItem('zardal.product-allocation-sections.v1', JSON.stringify({
      'ХТЭЙлдвэр': [{
        id: 'section-1',
        title: 'Бүтээгдэхүүний үйлдвэрлэсэн зардал',
        rows: [{
          rowNumber: '1.00',
          innerCode: 'НИЙТ',
          productName: 'Нийт дүн',
          unit: '-',
          quantity: 10,
          allocatedCost: 1000,
          isTotal: true,
        }],
        isExpanded: true,
      }],
    }))

    render(
      <Step2CostCalculation
        rows={[{ unit: 'ХТЭЙлдвэр', indicators: { 'Үйлдвэрлэсэн бүтээгдэхүүний тоо': true } }]}
        totalCost={1000}
        isProductManufactured={false}
      />,
    )

    fireEvent.change(screen.getByLabelText('ХТЭЙлдвэр нийт зардалд эзлэх хувь'), {
      target: { value: '100' },
    })

    expect(screen.getAllByDisplayValue('1,000.00 ₮').length).toBeGreaterThan(0)
  })

})
