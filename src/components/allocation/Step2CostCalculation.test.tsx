import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Step2CostCalculation } from './Step2CostCalculation'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('Step2CostCalculation', () => {
  it('үзүүлэлтээр бүлэглэж, доор нь тухайн үзүүлэлтийг сонгосон алба нэгжүүдийг харуулна', () => {
    render(
      <Step2CostCalculation
        rows={[
          { unit: 'Маркетинг', indicators: { 'Борлуулалтын өсөлт': true, 'Зардлын хэмнэлт': false } },
          { unit: 'Санхүү', indicators: { 'Борлуулалтын өсөлт': true, 'Зардлын хэмнэлт': true } },
          { unit: 'Үйлдвэрлэл', indicators: { 'Борлуулалтын өсөлт': false, 'Зардлын хэмнэлт': true } },
        ]}
        totalCost={1000}
      />,
    )

    expect(screen.getByText('Борлуулалтын өсөлт')).toBeTruthy()
    expect(screen.getByText('Зардлын хэмнэлт')).toBeTruthy()
    expect(screen.getAllByText('Маркетинг').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Санхүү').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Үйлдвэрлэл').length).toBeGreaterThan(0)
  })

  it('хадгалсан Step2 утгыг дахин ачаална', () => {
    const storageKey = 'test.step2.save.v1'
    const rows = [{ unit: 'Санхүү', indicators: { 'Зардлын хэмнэлт': true } }]
    const firstRender = render(<Step2CostCalculation rows={rows} totalCost={1000} storageKey={storageKey} />)

    fireEvent.change(screen.getByLabelText('Санхүү нийт зардалд эзлэх хувь'), { target: { value: '100' } })
    expect(window.localStorage.getItem(storageKey)).toContain('100')
    firstRender.unmount()

    render(<Step2CostCalculation rows={rows} totalCost={1000} storageKey={storageKey} />)
    expect(screen.getByDisplayValue('100')).toBeTruthy()
  })

  it('factory-оор тодорхойлогдсон Step2 өгөгдлийг эхний үйлдвэрийн түлхүүрээр хадгална', () => {
    const storageKey = 'test.factory.step2.v1'
    const rows = [{ unit: 'Санхүү', indicators: { 'Зардлын хэмнэлт': true } }]
    const productRows = [
      { FactoryName: 'A үйлдвэр', ErpCode: 'ERP-A', ProductName: 'A бүтээгдэхүүн', Unit: 'ш', MachineHours: 5, BatchTheoreticalQty: 10 },
      { FactoryName: 'B үйлдвэр', ErpCode: 'ERP-B', ProductName: 'B бүтээгдэхүүн', Unit: 'ш', MachineHours: 7, BatchTheoreticalQty: 14 },
    ]

    render(
      <Step2CostCalculation
        rows={rows}
        totalCost={1000}
        productRows={productRows}
        storageKey={storageKey}
      />,
    )

    fireEvent.change(screen.getByLabelText('Санхүү нийт зардалд эзлэх хувь'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Хадгалах' }))

    expect(window.localStorage.getItem(`${storageKey}.a`)).toContain('100')
    expect(window.localStorage.getItem(`${storageKey}.b`)).toBeNull()
  })
})