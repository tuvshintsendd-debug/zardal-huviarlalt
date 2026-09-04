import type { BillWithCalc, ProductInfoModel } from '../../types'
import { useEffect, useMemo, useState } from 'react'
import type { AllocationBasis } from '../../services/allocation'
import { formatMoney, formatPeriod } from '../../utils/format'
import { JournalEntryStep, type JournalEntryRow } from './JournalEntryStep'
import { OrgUnitInput } from './OrgUnitInput'
import { Step1BaseInput, type BaseInputRow } from './Step1BaseInput'
import { PRODUCT_COUNT_INDICATOR, Step2CostCalculation } from './Step2CostCalculation'

interface AllocationPageProps {
  period: string
  bills: BillWithCalc[]
  bases: AllocationBasis[]
  onBack: () => void
}

export function AllocationPage({ period, bills, bases, onBack }: AllocationPageProps) {
  const [orgUnits, setOrgUnits] = useState<string[]>(() => {
    const saved = window.localStorage.getItem('zardal.electricity.orgUnits.v1')
    if (!saved) return []
    try {
      const parsed = JSON.parse(saved)
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
    } catch {
      return []
    }
  })
  const [baseRows, setBaseRows] = useState<BaseInputRow[]>([])
  const [productRows, setProductRows] = useState<ProductInfoModel[]>([])
  const [rowCosts, setRowCosts] = useState<JournalEntryRow[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [step2CanProceed, setStep2CanProceed] = useState(false)
  const totalWithVat = bills.reduce((sum, bill) => sum + bill.calc.totalAmount, 0)
  /** Бүртгэсэн зардал (НӨАТ-тай) дүнгээс НӨАТ-ыг хасаж (1.1-д хуваасан дүн) Зардал хуваарилах алхмуудад ашиглана */
  const total = totalWithVat / 1.1

  const selectedMetrics = useMemo(
    () => bases.map((basis) => basis.name).filter((name) => name.trim() !== ''),
    [bases],
  )

  /** Алхам 1: энэ үзүүлэлтийг чеклэсэн алба нэгж байвал сайн "1.00 Бүтээгдэхүүний үйлдвэрлэсэн зардал" бүлгийг харуулна */
  const isProductManufactured = useMemo(
    () => baseRows.some((row) => Boolean(row.indicators[PRODUCT_COUNT_INDICATOR])),
    [baseRows],
  )

  useEffect(() => {
    window.localStorage.setItem('zardal.electricity.orgUnits.v1', JSON.stringify(orgUnits))
  }, [orgUnits])

  const stepContent = (
    <>
      {currentStep > 0 && (
        <div className="allocation-previous-step">
          <button
            type="button"
            className="btn btn--ghost allocation-previous-step__button"
            onClick={() => setCurrentStep((step) => Math.max(step - 1, 0))}
          >
            ← Өмнөх алхам руу буцах
          </button>
        </div>
      )}

      <div className={currentStep === 0 ? 'allocation-step' : 'allocation-step allocation-step--hidden'}>
        <OrgUnitInput units={orgUnits} onChange={setOrgUnits} />
      </div>
      <div className={currentStep === 1 ? 'allocation-step' : 'allocation-step allocation-step--hidden'}>
        <Step1BaseInput
          orgUnits={orgUnits}
          selectedMetrics={selectedMetrics}
          onChange={setBaseRows}
          onProductRowsChange={setProductRows}
        />
      </div>
      <div className={currentStep === 2 ? 'allocation-step' : 'allocation-step allocation-step--hidden'}>
        <Step2CostCalculation
          rows={baseRows}
          totalCost={total}
          productRows={productRows}
          storageKey={`zardal.electricity.step2.${period}.v1`}
          isProductManufactured={isProductManufactured}
          onCanProceed={setStep2CanProceed}
          onRowCostsChange={setRowCosts}
          onNext={() => setCurrentStep(3)}
        />
      </div>
      <div className={currentStep === 3 ? 'allocation-step' : 'allocation-step allocation-step--hidden'}>
        <JournalEntryStep period={period} entries={rowCosts} totalCost={total} />
      </div>

      {currentStep < 2 && <div className="stepper-nav">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            if (currentStep < 2) setCurrentStep((step) => step + 1)
          }}
          disabled={orgUnits.length === 0 || (currentStep === 2 && !step2CanProceed)}
        >
          Дараах
        </button>
      </div>}
    </>
  )

  return (
    <main className="allocation-page">
      <div className="allocation-page__head">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          ← Бүртгэсэн зардал руу буцах
        </button>
        <div>
          <span className="step-label">3-р алхам</span>
          <h2 className="allocation-page__title">Зардал хуваарилах</h2>
          <p className="card__subtitle">{formatPeriod(period)} · {bills.length} мөр</p>
        </div>
        <div className="allocation-page__total">
          <span>Хуваарилах нийт зардал</span>
          <strong>{formatMoney(total)}</strong>
        </div>
      </div>

      <div className="allocation-page__notice">
        Суурийн жинг тохируулсны дараа дараагийн шатанд цех/алба болон бүтээгдэхүүний хэмжээг оруулж, зардлыг автоматаар хуваарилна.
      </div>

      {stepContent}
    </main>
  )
}
