import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OrgUnitInput } from './OrgUnitInput'
import { Step1BaseInput } from './Step1BaseInput'
import { Step2CostCalculation } from './Step2CostCalculation'

describe('OrgUnitInput', () => {
  it('шинэ алба нэгж нэмэхэд давхардлыг зөвшөөрөхгүй', () => {
    render(<OrgUnitInput units={[]} onChange={() => undefined} />)

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
  expect(screen.getByRole('button', { name: 'Мөр нэмэх' }).hasAttribute('disabled')).toBe(true)
  })

  it('олж буй алба нэгжүүдээс dropdown-оор сонгоно', () => {
    render(
      <Step1BaseInput
        orgUnits={['Санхүү хэлтэс', 'Үйлдвэрлэлийн хэлтэс']}
        selectedMetrics={['Ажилтны тоо']}
      />,
    )

    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Мөр нэмэх' }))
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

  it('алба нэгжийн карт дээр Excel экспортлох товч харагдана', () => {
    render(
      <Step2CostCalculation
        rows={[{ unit: 'ХТЭҮйлдвэр', indicators: { 'Тоолуурын бодит хэрэглээ': true } }]}
        totalCost={228165}
      />,
    )

    expect(screen.getByRole('button', { name: 'Excel экспортлох' })).toBeTruthy()
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
