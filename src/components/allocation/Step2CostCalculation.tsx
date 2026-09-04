import { useEffect, useMemo, useRef, useState } from 'react'
import type { BaseInputRow } from './Step1BaseInput'

/** "1.00 Бүтээгдэхүүний үйлдвэрлэсэн зардал" бүлэгийг тэмдэглэх тусгай үзүүлэлтийн нэр
 */
export const PRODUCT_COUNT_INDICATOR = 'Үйлдвэрлэсэн бүтээгдэхүүний тоо'

/** "Ажилтны тоо" бүлэгийг Excel-ээс автоматаар хуваарилахад тэмдэглэх үзүүлэлтийн нэр */
const EMPLOYEE_COUNT_INDICATOR = 'Ажилтны тоо'

/** "Хөдөлмөрийн цаг" бүлэг — Ажилтны тоо-той яг адил зарчмаар (цаг × эзлэх хувь) тооцоолно */
const LABOR_HOURS_INDICATOR = 'Хөдөлмөрийн цаг'

/** Ажилтны тоо / Хөдөлмөрийн цаг бүлгийн хамтад "Тоолуурын бодит хэрэглээ"-г чеклэсэн үед бүлгийн нийт зардлыг тоолуурын заалтаар тооцох pseudo-мөрийн түлхүүр */
const EMPLOYEE_METER_KEY = '__employee_meter__'
const LABOR_METER_KEY = '__labor_meter__'

interface Step2CostCalculationProps {
  rows: BaseInputRow[]
  totalCost: number
  productRows?: Array<{ ProductName: string; ErpCode: string; BatchTheoreticalQty: number; Unit: string; MachineHours: number; FactoryName: string }>
  storageKey?: string
  /** Алхам 1-ийн "Үйлдвэрлэсэн бүтээгдэхүүний тоо" checkbox-ын төлөв — Group болон түүний хүүхэд элементийн Visibility-г барина */
  isProductManufactured?: boolean
  onCanProceed?: (canProceed: boolean) => void
  onNext?: () => void
  /** Алба нэгж бүрийн эцсэн тооцоолсон зардалыг эцсэн алхамд (Журналын бичилт) ашиглахад дамжуулана */
  /** Алба нэгж бүрийн эцсэн тооцоолсон зардалыг эцсэн алхамд (Журналын бичилт) ашиглахад дамжуулана. Уйлдвэрлэг алба нэгжийн бол бүтээгдэхүүн тус бүрийн ERP кодоор мөр бүрийг тасна */
  onRowCostsChange?: (entries: Array<{ unit: string; amount: number; productErpCode?: string; productName?: string }>) => void
}

interface CostRowState {
  readingDifference: string
  coefficient: string
  unitPrice: string
  percentage: string
}

interface SavedStep2Data {
  state: Record<string, CostRowState>
  rowsSignature: string
  savedAt: string
}

interface ImportPreviewRow {
  rowNumber: string
  innerCode: string
  productName: string
  unit: string
  quantity: number
  seriesQty?: number
  totalMachineHours?: number
  allocatedCost: number
  isTotal?: boolean
  warning?: string
}

interface SavedAllocationSection {
  id: string
  title: string
  rows: ImportPreviewRow[]
  isExpanded: boolean
}

function createCostRow(): CostRowState {
  return {
    readingDifference: '',
    coefficient: '1',
    unitPrice: '',
    percentage: '',
  }
}

function numberValue(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function formatAmount(value: number): string {
  return `${value.toLocaleString('mn-MN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₮`
}

function formatQuantity(value: number): string {
  return value.toLocaleString('mn-MN', { maximumFractionDigits: 0 })
}

function createRowsSignature(rows: BaseInputRow[]): string {
  return JSON.stringify(rows.map((row) => ({ unit: row.unit, indicators: row.indicators })))
}

function normalizeFactoryKey(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'default'
}

/** Кирилл үсэгтэй нэрсийг (Yйлдвэр/алба нэгж) хооронд нь агуулагдах эсэхийг шалгахад ашиглах, зөвхөн
 *  үсэг/тоог үлдээж бусад тэмдэгт, зайг арилгасан жиших түлхүүр */
function normalizeMatchText(value: string): string {
  return String(value ?? '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}


export function Step2CostCalculation({
  rows,
  totalCost,
  productRows = [],
  storageKey = 'zardal.step2.v1',
  isProductManufactured = true,
  onCanProceed,
  onNext,
  onRowCostsChange,
}: Step2CostCalculationProps) {
  const factoryOptions = useMemo(
    () => Array.from(new Set(productRows.map((product) => product.FactoryName).filter((factory) => factory && factory.trim() !== ''))),
    [productRows],
  )
  /** Yйлдвэр сонгох сонголт UI-аас хасагдсан тул анхны (эхний) үйлдвэрийг автоматаар ашиглана */
  const resolvedFactory = factoryOptions[0] ?? ''
  const scopedStorageKey = resolvedFactory ? `${storageKey}.${normalizeFactoryKey(resolvedFactory)}` : storageKey
  const sectionsStorageKey = resolvedFactory ? `${storageKey}.sections.${normalizeFactoryKey(resolvedFactory)}` : `${storageKey}.sections`

  const [state, setState] = useState<Record<string, CostRowState>>({})
  const [savedRowsSignature, setSavedRowsSignature] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [needsRecalculation, setNeedsRecalculation] = useState(false)
  const [, setImportError] = useState('')
  const [employeeCounts, setEmployeeCounts] = useState<Record<string, number>>({})
  /** "Ажилтны тоо" бүлгийн нийт зардалд эзлэх хувь — энэ хувийн дүнг ажилтны тоогоор цааш хуваарилна */
  const [employeeGroupPercent, setEmployeeGroupPercent] = useState('')
  const [laborHours, setLaborHours] = useState<Record<string, number>>({})
  /** "Хөдөлмөрийн цаг" бүлгийн нийт зардалд эзлэх хувь — энэ хувийн дүнг хөдөлмөрийн цагаар цааш хуваарилна */
  const [laborHoursGroupPercent, setLaborHoursGroupPercent] = useState('')
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [expandedIndicators, setExpandedIndicators] = useState<Record<string, boolean>>({})
  const [expandedLiveSections, setExpandedLiveSections] = useState<Record<string, boolean>>({})
  const [savedSectionsByUnit, setSavedSectionsByUnit] = useState<Record<string, SavedAllocationSection[]>>({})

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = window.localStorage.getItem(scopedStorageKey)
      const parsed = saved ? JSON.parse(saved) as SavedStep2Data : null
      setState(parsed?.state && typeof parsed.state === 'object' ? parsed.state : {})
      setSavedRowsSignature(typeof parsed?.rowsSignature === 'string' ? parsed.rowsSignature : '')
    } catch {
      setState({})
      setSavedRowsSignature('')
    }

    try {
      const savedSections = window.localStorage.getItem(sectionsStorageKey)
      const parsedSections = savedSections ? JSON.parse(savedSections) : {}
      if (parsedSections && typeof parsedSections === 'object' && !Array.isArray(parsedSections)) {
        setSavedSectionsByUnit(parsedSections as Record<string, SavedAllocationSection[]>)
      } else {
        setSavedSectionsByUnit({})
      }
    } catch {
      setSavedSectionsByUnit({})
    }
  }, [scopedStorageKey, sectionsStorageKey])

  const currentRowsSignature = createRowsSignature(rows)
  const isStale = Boolean(savedRowsSignature && savedRowsSignature !== currentRowsSignature)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(sectionsStorageKey, JSON.stringify(savedSectionsByUnit))
    }
  }, [savedSectionsByUnit, sectionsStorageKey])

  const employeeCountsStorageKey = `${storageKey}.employeeCounts`

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = window.localStorage.getItem(employeeCountsStorageKey)
      const parsed = saved ? JSON.parse(saved) as Record<string, number> : {}
      setEmployeeCounts(parsed && typeof parsed === 'object' ? parsed : {})
    } catch {
      setEmployeeCounts({})
    }
  }, [employeeCountsStorageKey])

  const employeeGroupPercentStorageKey = `${storageKey}.employeeGroupPercent`

  useEffect(() => {
    if (typeof window === 'undefined') return
    setEmployeeGroupPercent(window.localStorage.getItem(employeeGroupPercentStorageKey) ?? '')
  }, [employeeGroupPercentStorageKey])

  const laborHoursStorageKey = `${storageKey}.laborHours`

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = window.localStorage.getItem(laborHoursStorageKey)
      const parsed = saved ? JSON.parse(saved) as Record<string, number> : {}
      setLaborHours(parsed && typeof parsed === 'object' ? parsed : {})
    } catch {
      setLaborHours({})
    }
  }, [laborHoursStorageKey])

  const laborHoursGroupPercentStorageKey = `${storageKey}.laborHoursGroupPercent`

  useEffect(() => {
    if (typeof window === 'undefined') return
    setLaborHoursGroupPercent(window.localStorage.getItem(laborHoursGroupPercentStorageKey) ?? '')
  }, [laborHoursGroupPercentStorageKey])

  const activeFactoryProducts = useMemo(
    () => resolvedFactory
      ? productRows.filter((product) => product.FactoryName === resolvedFactory)
      : productRows,
    [productRows, resolvedFactory],
  )

  /** Алба нэгжийн нэрээр харгалзах "Yйлдвэр"-ийг автоматаар тааруулж, тухайн алба нэгжид зориулсан
   *  бүтээгдэхүүний жагсаалтыг буцаана. Ямар ч шинэ Yйлдвэр/алба нэгж нэмэгдсэн ч дэлгэц дээр гараар
   *  сонгосон Yйлдвэрээс үл хамааран зөв тааруулагдана; тохирох нэр олдоогүй бол одоо сонгогдсон
   *  Yйлдвэрийн жагсаалт руу буцна. */
  function getProductsForUnit(unitName: string) {
    const normalizedUnit = normalizeMatchText(unitName)
    const matchedFactory = normalizedUnit
      ? factoryOptions.find((factory) => {
          const normalizedFactory = normalizeMatchText(factory)
          return normalizedFactory !== '' && (normalizedUnit.includes(normalizedFactory) || normalizedFactory.includes(normalizedUnit))
        })
      : undefined
    return matchedFactory
      ? productRows.filter((product) => product.FactoryName === matchedFactory)
      : activeFactoryProducts
  }

  const selectedIndicators = useMemo(() => {
    const indicatorSet = new Set<string>()
    rows.forEach((row) => {
      Object.entries(row.indicators ?? {}).forEach(([indicator, isSelected]) => {
        if (isSelected) {
          indicatorSet.add(indicator)
        }
      })
    })
    return Array.from(indicatorSet)
  }, [rows])

  const indicatorGroups = useMemo(() => {
    return selectedIndicators.map((indicator) => ({
      indicator,
      departments: rows
        .filter((row) => Boolean(row.indicators[indicator]))
        .map((row) => row.unit),
    }))
  }, [rows, selectedIndicators])

  const productCountGroup = useMemo(
    () => indicatorGroups.find((group) => group.indicator === PRODUCT_COUNT_INDICATOR) ?? null,
    [indicatorGroups],
  )

  useEffect(() => {
    setExpandedIndicators((current) => {
      const next = { ...current }
      selectedIndicators.forEach((indicator) => {
        if (!(indicator in next)) {
          next[indicator] = true
        }
      })
      return next
    })
  }, [selectedIndicators])

  function toggleIndicatorGroup(indicator: string) {
    setExpandedIndicators((current) => ({
      ...current,
      [indicator]: !(current[indicator] ?? true),
    }))
  }

  function handleSaveStep2() {
    const savedData: SavedStep2Data = {
      state,
      rowsSignature: currentRowsSignature,
      savedAt: new Date().toISOString(),
    }
    window.localStorage.setItem(scopedStorageKey, JSON.stringify(savedData))
    setSavedRowsSignature(currentRowsSignature)
    setSaveMessage('Хадгалагдлаа')
  }

  function handleRefreshStep2() {
    setState((current) => {
      const refreshed = Object.fromEntries(rows.map((row) => [row.unit, current[row.unit] ?? createCostRow()]))
      // Ажилтны тоо/Хөдөлмөрийн цаг бүлгийн тоолуурын заалтын pseudo-мөрийг устгалгүй хэвээр үлдээнэ
      ;[EMPLOYEE_METER_KEY, LABOR_METER_KEY].forEach((key) => {
        if (current[key]) refreshed[key] = current[key]
      })
      const savedData: SavedStep2Data = {
        state: refreshed,
        rowsSignature: currentRowsSignature,
        savedAt: new Date().toISOString(),
      }
      window.localStorage.setItem(scopedStorageKey, JSON.stringify(savedData))
      return refreshed
    })

    setSavedSectionsByUnit((current) => {
      const next = { ...current }
      rows.forEach((row) => {
        const unitTotal = calculateRow(row)
        const existing = current[row.unit] ?? []
        if (existing.length === 0) {
          next[row.unit] = []
          return
        }
        next[row.unit] = existing.map((section) => ({
          ...section,
          rows: recalculateImportedSections(unitTotal, section.rows, getProductsForUnit(row.unit)),
        }))
      })
      return next
    })

    setSavedRowsSignature(currentRowsSignature)
    setNeedsRecalculation(false)
    setSaveMessage('Шинэчлэгдлээ')
  }

  function getState(unit: string): CostRowState {
    return state[unit] ?? createCostRow()
  }

  function updateState(unit: string, changes: Partial<CostRowState>) {
    setState((current) => {
      const next = {
        ...current,
        [unit]: { ...(current[unit] ?? createCostRow()), ...changes },
      }
      window.localStorage.setItem(scopedStorageKey, JSON.stringify({
        state: next,
        rowsSignature: currentRowsSignature,
        savedAt: new Date().toISOString(),
      }))
      return next
    })
  }

  function updateNumber(unit: string, field: 'readingDifference' | 'coefficient' | 'unitPrice' | 'percentage', value: string) {
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return
    updateState(unit, { [field]: value })
    setNeedsRecalculation(true)
  }

  function usesReadingDifference(row: BaseInputRow): boolean {
    return Boolean(row.indicators['Тоолуурын бодит хэрэглээ'])
  }

  /** Ажилтны тоо/Хөдөлмөрийн цаг бүлэгт хамаарах мөр эсэх — тийм бол зардлыг үргэлж бүлгийн эзлэх хувиар тооцно, тухайн мөрийн өөрийн тоолуурын заалт (хэрэв хамт чеклэгдсэн бол) бүлгийн pseudo-мөрөөр аль хэдийн тооцогдсон байдаг */
  function isCountGroupMember(row: BaseInputRow): boolean {
    return Boolean(row.indicators[EMPLOYEE_COUNT_INDICATOR] || row.indicators[LABOR_HOURS_INDICATOR])
  }

  useEffect(() => {
    setState((current) => {
      const nextState = { ...current }
      rows.forEach((row) => {
        const rowState = nextState[row.unit]
        if (!rowState) return
        if (isCountGroupMember(row)) return
        if (usesReadingDifference(row)) {
          nextState[row.unit] = { ...rowState, percentage: '' }
        } else {
          nextState[row.unit] = {
            ...rowState,
            readingDifference: '',
            coefficient: '1',
            unitPrice: '',
          }
        }
      })
      return nextState
    })
  }, [rows])

  const percentageTotal = useMemo(
    () => rows.reduce((sum, row) => {
      return sum + (!usesReadingDifference(row) || isCountGroupMember(row) ? numberValue(getState(row.unit).percentage) : 0)
    }, 0),
    [rows, state],
  )

  /** "Yйлдвэрлэсэн бүтээгдэхүүний тоо" бүлгийн алба нэгжүүдийг эс тооцоод бусад бүх бүлгийн (Ажилтны тоо, Хөдөлмөрийн цаг гэх мэт) хуваарилагдсан зардлын нийлбэр. calculateRow-той хамааралгүйгээр тооцно, учир нь calculateRow нь доор тодорхойлогдох factoryAllocationAmount-аас хамаардаг */
  const otherGroupsAllocated = useMemo(() => {
    const productUnits = isProductManufactured ? new Set(productCountGroup?.departments ?? []) : new Set<string>()
    return rows.reduce((sum, row) => {
      if (productUnits.has(row.unit)) return sum
      const rowState = getState(row.unit)
      if (usesReadingDifference(row) && !isCountGroupMember(row)) {
        return sum + numberValue(rowState.readingDifference) * numberValue(rowState.coefficient) * numberValue(rowState.unitPrice)
      }
      return sum + totalCost * numberValue(rowState.percentage) / 100
    }, 0)
  }, [rows, productCountGroup, state, totalCost, isProductManufactured])

  /** Нийт зардлаас бусад бүлгийн хуваарилагдсан зардлыг хассан үлдэгдэл дүн — Yйлдвэрт хуваарилагдах дүн. Энэ дүнг Yйлдвэрлэсэн бүтээгдэхүүний тоо бүлгийн алба нэгжүүдэд шууд хуваарилна (гараар хувь оруулахгүй) */
  const factoryAllocationAmount = totalCost - otherGroupsAllocated

  /** Тухайн алба нэгжийн бүтээгдэхүүнүүдийн нийт машин цаг (Онол тоо>0 бүтээгдэхүүн бүрийн Машин цагийн нийлбэр) */
  function getUnitMachineHours(unitName: string): number {
    return getProductsForUnit(unitName)
      .filter((product) => Number(product.BatchTheoreticalQty) > 0 && product.ProductName.trim())
      .reduce((sum, product) => sum + Number(product.MachineHours || 0), 0)
  }

  function calculateRow(row: BaseInputRow): number {
    const rowState = getState(row.unit)
    if (isProductManufactured && row.indicators[PRODUCT_COUNT_INDICATOR]) {
      const productDepartments = productCountGroup?.departments ?? []
      if (productDepartments.length === 0) return 0
      const grandMachineHours = productDepartments.reduce((sum, unit) => sum + getUnitMachineHours(unit), 0)
      if (grandMachineHours <= 0) return factoryAllocationAmount / productDepartments.length
      return factoryAllocationAmount * (getUnitMachineHours(row.unit) / grandMachineHours)
    }
    if (usesReadingDifference(row) && !isCountGroupMember(row)) {
      return numberValue(rowState.readingDifference)
        * numberValue(rowState.coefficient)
        * numberValue(rowState.unitPrice)
    }
    return totalCost * numberValue(rowState.percentage) / 100
  }

  const totalCalculated = rows.reduce((sum, row) => sum + calculateRow(row), 0)
  const difference = totalCost - totalCalculated
  const isBalanced = rows.length > 0 && Math.abs(difference) < 0.005

  function buildProductAllocationRows(targetTotal: number, productsForUnit: typeof activeFactoryProducts): ImportPreviewRow[] {
    const validProducts = productsForUnit.filter((product) => Number(product.BatchTheoreticalQty) > 0 && product.ProductName.trim())
    if (validProducts.length === 0) return []

    const totalQuantity = validProducts.reduce((sum, item) => sum + Number(item.BatchTheoreticalQty || 0), 0)
    if (totalQuantity <= 0) return []

    // Нэг цуврал гэж үзээд Нийт машин цаг = Машин цаг × Цувралын тоо (1) байхаар тооцно
    const withMachineHours = validProducts.map((item, index) => {
      const seriesQty = 1
      const totalMachineHours = Number(item.MachineHours || 0) * seriesQty
      return {
        rowNumber: `1.${index + 1}`,
        innerCode: item.ErpCode || `P-${index + 1}`,
        productName: item.ProductName,
        unit: item.Unit || '-',
        quantity: Number(item.BatchTheoreticalQty || 0),
        seriesQty,
        totalMachineHours,
      }
    })

    const grandMachineHours = withMachineHours.reduce((sum, item) => sum + item.totalMachineHours, 0)

    const rowsWithAllocation = withMachineHours.map((item) => ({
      ...item,
      allocatedCost: grandMachineHours > 0
        ? targetTotal * (item.totalMachineHours / grandMachineHours)
        : targetTotal * (item.quantity / totalQuantity),
    }))

    const allocatedSum = rowsWithAllocation.reduce((sum, item) => sum + item.allocatedCost, 0)
    const diffAdjustment = targetTotal - allocatedSum
    if (rowsWithAllocation.length > 0) {
      rowsWithAllocation[rowsWithAllocation.length - 1].allocatedCost += diffAdjustment
    }

    return [{
      rowNumber: '1.00',
      innerCode: 'НИЙТ',
      productName: 'Нийт дүн',
      unit: '-',
      quantity: totalQuantity,
      seriesQty: withMachineHours.reduce((sum, item) => sum + item.seriesQty, 0),
      totalMachineHours: grandMachineHours,
      allocatedCost: targetTotal,
      isTotal: true,
    }, ...rowsWithAllocation]
  }

  useEffect(() => {
    onCanProceed?.(isBalanced)
  }, [isBalanced, onCanProceed])

  useEffect(() => {
    const lines: Array<{ unit: string; amount: number; productErpCode?: string; productName?: string }> = []
    rows.forEach((row) => {
      const isFactory = isProductManufactured && Boolean(row.indicators[PRODUCT_COUNT_INDICATOR])
      if (!isFactory) {
        lines.push({ unit: row.unit, amount: calculateRow(row) })
        return
      }
      const unitTotalCost = calculateRow(row)
      const savedSections = savedSectionsByUnit[row.unit] ?? []
      const productsForUnit = getProductsForUnit(row.unit)
      const liveRows = buildProductAllocationRows(unitTotalCost, productsForUnit)
      const sourceRows = savedSections.length > 0 && !needsRecalculation ? savedSections[0]?.rows ?? [] : liveRows
      const productLines = sourceRows.filter((item) => !item.isTotal)
      if (productLines.length === 0) {
        lines.push({ unit: row.unit, amount: unitTotalCost })
        return
      }
      productLines.forEach((item) => {
        lines.push({ unit: row.unit, amount: item.allocatedCost, productErpCode: item.innerCode, productName: item.productName })
      })
    })
    onRowCostsChange?.(lines)
  }, [rows, state, totalCost, onRowCostsChange, isProductManufactured, savedSectionsByUnit, needsRecalculation, productRows])

  /** ERP код тааруулах: Excel-ийн тоон формат ихэвчлэн тэргүүн 0-г хасдаг тул алдаагүй тааруулахын тулд тэргүүн 0 болон том/жижиг үсгийг үл тооцно */
  function normalizeImportCode(value: string): string {
    const trimmed = String(value ?? '').trim().replace(/\s+/g, '')
    return /^\d+$/.test(trimmed) ? trimmed.replace(/^0+(?=\d)/, '') : trimmed.toLowerCase()
  }

  function recalculateImportedSections(unitTotalCost: number, rowsForUnit: ImportPreviewRow[], productsForUnit: typeof activeFactoryProducts): ImportPreviewRow[] {
    // Одоогийн Бүтээгдэхүүний мэдээллийн лавлахтай ERP кодыг дахин тааруулж, урьд нь "Код олдсонгүй" болсон мөрийг сэргээнэ
    const productMap = new Map(productsForUnit.map((item) => [normalizeImportCode(item.ErpCode), item]))
    const rematchedRows = rowsForUnit.map((item) => {
      if (item.isTotal) return item
      const matched = productMap.get(normalizeImportCode(item.innerCode))
      if (!matched) return item
      const batchSize = Number(matched.BatchTheoreticalQty)
      const machineHours = Number(matched.MachineHours)
      if (!Number.isFinite(batchSize) || batchSize <= 0 || !Number.isFinite(machineHours)) return item
      const seriesQty = item.quantity / batchSize
      const totalMachineHours = machineHours * seriesQty
      return {
        ...item,
        productName: matched.ProductName || item.productName,
        seriesQty,
        totalMachineHours,
        warning: undefined,
      }
    })

    const validRows = rematchedRows.filter((item) => !item.isTotal && !item.warning)
    const grandMachineHours = validRows.reduce((sum, item) => sum + Number(item.totalMachineHours || 0), 0)
    if (grandMachineHours <= 0) {
      return rematchedRows.map((item) => item.isTotal ? { ...item, allocatedCost: unitTotalCost } : { ...item, allocatedCost: 0 })
    }

    const recalculatedRows = rematchedRows.map((item) => {
      if (item.isTotal) {
        return { ...item, allocatedCost: unitTotalCost }
      }
      if (item.warning) {
        return { ...item, allocatedCost: 0 }
      }
      const allocatedCost = unitTotalCost * (Number(item.totalMachineHours || 0) / grandMachineHours)
      return { ...item, allocatedCost }
    })

    const allocatedSum = recalculatedRows.filter((item) => !item.isTotal && !item.warning).reduce((sum, item) => sum + Number(item.allocatedCost || 0), 0)
    const adjustment = unitTotalCost - allocatedSum
    const targetIndex = recalculatedRows.findLastIndex((item) => !item.isTotal && !item.warning)
    if (targetIndex >= 0) {
      recalculatedRows[targetIndex].allocatedCost = Number(recalculatedRows[targetIndex].allocatedCost || 0) + adjustment
    }

    const totalRow = recalculatedRows.find((item) => item.isTotal)
    if (totalRow) {
      totalRow.allocatedCost = unitTotalCost
    }

    return recalculatedRows
  }

  async function parseImportedAllocationRows(file: File, unitTotalCost: number, productsForUnit: typeof activeFactoryProducts): Promise<ImportPreviewRow[]> {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: true })
    const sheetName = workbook.SheetNames.find((name) => name.toLowerCase() === 'бүтээгдэхүүн') ?? workbook.SheetNames[0]
    if (!sheetName) return []

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' })
    const productMap = new Map(productsForUnit.map((item) => [normalizeImportCode(item.ErpCode), item]))
    const parsedRows: ImportPreviewRow[] = []
    const errors: string[] = []

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      const allEmpty = Object.values(row).every((value) => String(value ?? '').trim() === '')
      if (allEmpty) continue

      const rowNumber = String(row['A'] ?? row['Д/д'] ?? '').trim()
      const innerCode = String(row['B'] ?? row['Дотоод код'] ?? '').trim()
      const productName = String(row['C'] ?? row['Бэлэн бүтээгдэхүүн'] ?? '').trim()
      const unit = String(row['D'] ?? row['Хэмжих нэгж'] ?? '').trim()
      const quantityRaw = String(row['E'] ?? row['Үйлдвэрлэсэн тоо'] ?? '').trim()

      if (index === 0) continue
      if (rowNumber === 'Нийт дүн' || productName.toLowerCase() === 'нийт дүн' || innerCode.toLowerCase() === 'нийт дүн') {
        continue
      }

      if (!innerCode || !productName || !unit || !quantityRaw) {
        errors.push(`Мөр ${index + 1}: шаардлагатай A-E багана хоосон байна.`)
        continue
      }

      const quantity = Number(quantityRaw.replace(/\s+/g, '').replace(',', '.'))
      if (!Number.isFinite(quantity) || quantity < 0) {
        errors.push(`Мөр ${index + 1}: Үйлдвэрлэсэн тоо буруу байна.`)
        continue
      }

      const matched = productMap.get(normalizeImportCode(innerCode))
      if (!matched) {
        parsedRows.push({
          rowNumber: rowNumber || `1.${parsedRows.length + 1}`,
          innerCode,
          productName: `${productName} (Код олдсонгүй)`,
          unit,
          quantity,
          allocatedCost: 0,
          warning: 'Код олдсонгүй',
        })
        continue
      }

      const batchSize = Number(matched.BatchTheoreticalQty)
      const machineHours = Number(matched.MachineHours)
      if (!Number.isFinite(batchSize) || batchSize <= 0 || !Number.isFinite(machineHours)) {
        errors.push(`Мөр ${index + 1}: ERP ${innerCode}-ийн 1 цувралын хэмжээ / машин цаг буруу байна.`)
        continue
      }

      const seriesQty = quantity / batchSize
      const totalMachineHours = machineHours * seriesQty
      parsedRows.push({
        rowNumber: rowNumber || `1.${parsedRows.length + 1}`,
        innerCode,
        productName,
        unit,
        quantity,
        seriesQty,
        totalMachineHours,
        allocatedCost: 0,
      })
    }

    if (errors.length > 0) {
      setImportError(errors.join(' '))
    } else {
      setImportError('')
    }

    if (parsedRows.length === 0) return []

    const totalQuantity = parsedRows.reduce((sum, item) => sum + item.quantity, 0)
    const grandMachineHours = parsedRows.reduce((sum, item) => sum + Number(item.totalMachineHours || 0), 0)
    const rowsWithAllocation = parsedRows.map((item) => ({
      ...item,
      allocatedCost: grandMachineHours > 0 ? unitTotalCost * (Number(item.totalMachineHours || 0) / grandMachineHours) : 0,
    }))

    const allocatedSum = rowsWithAllocation.reduce((sum, item) => sum + Number(item.allocatedCost || 0), 0)
    const diffAdjustment = unitTotalCost - allocatedSum
    if (rowsWithAllocation.length > 0) {
      rowsWithAllocation[rowsWithAllocation.length - 1].allocatedCost = Number(rowsWithAllocation[rowsWithAllocation.length - 1].allocatedCost || 0) + diffAdjustment
    }

    return [{
      rowNumber: '1.00',
      innerCode: 'НИЙТ',
      productName: 'Нийт дүн',
      unit: '-',
      quantity: totalQuantity,
      seriesQty: parsedRows.reduce((sum, item) => sum + Number(item.seriesQty || 0), 0),
      totalMachineHours: grandMachineHours,
      allocatedCost: unitTotalCost,
      isTotal: true,
    }, ...rowsWithAllocation]
  }

  async function handleImportPreview(unit: string, file: File | null) {
    const productsForUnit = getProductsForUnit(unit)
    if (!file || productsForUnit.length === 0) return
    const row = rows.find((entry) => entry.unit === unit)
    if (!row) return
    const unitTotalCost = calculateRow(row)
    const parsed = await parseImportedAllocationRows(file, unitTotalCost, productsForUnit)
    if (parsed.length === 0) return
    setSavedSectionsByUnit((current) => ({
      ...current,
      [unit]: [{
        id: `allocation-${Date.now()}-${unit}`,
        title: 'Бүтээгдэхүүний үйлдвэрлэсэн зардал',
        rows: parsed,
        isExpanded: true,
      }],
    }))
    setNeedsRecalculation(false)
  }

  /** pseudo-мөрийн Заалтын зөрүү × Коэффициент × Нэгж үнэ-гээр бүлгийн нийт зардлыг тооцно */
  function computeMeterCost(key: string): number {
    const meterState = getState(key)
    return numberValue(meterState.readingDifference) * numberValue(meterState.coefficient) * numberValue(meterState.unitPrice)
  }

  /** Тухайн бүлэгт "Тоолуурын бодит хэрэглээ"-г хамт чеклэсэн алба нэгж байвал тоолуурын заалтаар, үгүй бол гараар оруулсан хувиар тооцсон "Нийт зардалд эзлэх хувь"-ыг буцаана */
  function getEmployeeEffectivePercent(): string {
    const employeeRows = rows.filter((row) => row.indicators[EMPLOYEE_COUNT_INDICATOR])
    if (employeeRows.some((row) => usesReadingDifference(row))) {
      const meterCost = computeMeterCost(EMPLOYEE_METER_KEY)
      return totalCost > 0 ? String((meterCost / totalCost) * 100) : '0'
    }
    return employeeGroupPercent
  }

  function getLaborEffectivePercent(): string {
    const laborRows = rows.filter((row) => row.indicators[LABOR_HOURS_INDICATOR])
    if (laborRows.some((row) => usesReadingDifference(row))) {
      const meterCost = computeMeterCost(LABOR_METER_KEY)
      return totalCost > 0 ? String((meterCost / totalCost) * 100) : '0'
    }
    return laborHoursGroupPercent
  }

  /** Бүлгийн "Нийт зардалд эзлэх хувь" × алба нэгжийн ажилтны тоо/нийт ажилтны тоо-гоор мөр бүрийн хувийг тооцож, шууд localStorage-д хадгална (Хадгалах товч дарахгүйгээр ч алдагдахгүй) */
  function applyEmployeeAllocation(counts: Record<string, number>, groupPercentValue: string) {
    const employeeRows = rows.filter((row) => row.indicators[EMPLOYEE_COUNT_INDICATOR])
    const totalCount = employeeRows.reduce((sum, row) => sum + (counts[row.unit] ?? 0), 0)
    const groupPercent = groupPercentValue === '' ? 0 : numberValue(groupPercentValue)

    setState((current) => {
      const next = { ...current }
      employeeRows.forEach((row) => {
        const share = totalCount > 0 ? ((counts[row.unit] ?? 0) / totalCount) * groupPercent : 0
        next[row.unit] = { ...(next[row.unit] ?? createCostRow()), percentage: String(share) }
      })
      window.localStorage.setItem(scopedStorageKey, JSON.stringify({
        state: next,
        rowsSignature: currentRowsSignature,
        savedAt: new Date().toISOString(),
      }))
      return next
    })
  }

  /** "Ажилтны тоо" бүлгийн алба нэгжийн ажилтны тоог дэлгэц дээрээс шууд бөглөж, эзлэх хувийг автоматаар дахин тооцно */
  function updateEmployeeCount(unit: string, rawValue: string) {
    if (rawValue !== '' && !/^\d*\.?\d*$/.test(rawValue)) return
    const count = rawValue === '' ? 0 : Number(rawValue)
    const nextCounts = { ...employeeCounts, [unit]: count }
    setEmployeeCounts(nextCounts)
    window.localStorage.setItem(employeeCountsStorageKey, JSON.stringify(nextCounts))
    applyEmployeeAllocation(nextCounts, getEmployeeEffectivePercent())
    setNeedsRecalculation(false)
  }

  /** "Ажилтны тоо" бүлгийн нийт зардалд эзлэх хувийг өөрчилж, ажилтны тоогоор дахин хуваарилна */
  function updateEmployeeGroupPercent(rawValue: string) {
    if (rawValue !== '' && !/^\d*\.?\d*$/.test(rawValue)) return
    setEmployeeGroupPercent(rawValue)
    window.localStorage.setItem(employeeGroupPercentStorageKey, rawValue)
    applyEmployeeAllocation(employeeCounts, rawValue)
    setNeedsRecalculation(false)
  }

  /** "Ажилтны тоо" бүлгийн pseudo-мөрийн Заалтын зөрүү/Коэффициент/Нэгж үнэг өөрчилж, тоолуураар тооцсон дүнг ажилтны тоогоор дахин хуваарилна */
  function updateEmployeeMeterField(field: 'readingDifference' | 'coefficient' | 'unitPrice', rawValue: string) {
    if (rawValue !== '' && !/^\d*\.?\d*$/.test(rawValue)) return
    const current = getState(EMPLOYEE_METER_KEY)
    const nextMeterState = { ...current, [field]: rawValue }
    updateState(EMPLOYEE_METER_KEY, { [field]: rawValue })
    const meterCost = numberValue(nextMeterState.readingDifference) * numberValue(nextMeterState.coefficient) * numberValue(nextMeterState.unitPrice)
    const effectivePercent = totalCost > 0 ? String((meterCost / totalCost) * 100) : '0'
    applyEmployeeAllocation(employeeCounts, effectivePercent)
    setNeedsRecalculation(false)
  }

  /** Бүлгийн "Нийт зардалд эзлэх хувь" × алба нэгжийн хөдөлмөрийн цаг/нийт цагаар мөр бүрийн хувийг тооцож, шууд localStorage-д хадгална — "Ажилтны тоо"-той адил зарчим */
  function applyLaborHoursAllocation(hours: Record<string, number>, groupPercentValue: string) {
    const laborHoursRows = rows.filter((row) => row.indicators[LABOR_HOURS_INDICATOR])
    const totalHours = laborHoursRows.reduce((sum, row) => sum + (hours[row.unit] ?? 0), 0)
    const groupPercent = groupPercentValue === '' ? 0 : numberValue(groupPercentValue)

    setState((current) => {
      const next = { ...current }
      laborHoursRows.forEach((row) => {
        const share = totalHours > 0 ? ((hours[row.unit] ?? 0) / totalHours) * groupPercent : 0
        next[row.unit] = { ...(next[row.unit] ?? createCostRow()), percentage: String(share) }
      })
      window.localStorage.setItem(scopedStorageKey, JSON.stringify({
        state: next,
        rowsSignature: currentRowsSignature,
        savedAt: new Date().toISOString(),
      }))
      return next
    })
  }

  /** "Хөдөлмөрийн цаг" бүлгийн алба нэгжийн цагийг дэлгэц дээрээс шууд бөглөж, эзлэх хувийг автоматаар дахин тооцно */
  function updateLaborHours(unit: string, rawValue: string) {
    if (rawValue !== '' && !/^\d*\.?\d*$/.test(rawValue)) return
    const hours = rawValue === '' ? 0 : Number(rawValue)
    const nextHours = { ...laborHours, [unit]: hours }
    setLaborHours(nextHours)
    window.localStorage.setItem(laborHoursStorageKey, JSON.stringify(nextHours))
    applyLaborHoursAllocation(nextHours, getLaborEffectivePercent())
    setNeedsRecalculation(false)
  }

  /** "Хөдөлмөрийн цаг" бүлгийн нийт зардалд эзлэх хувийг өөрчилж, цагаар дахин хуваарилна */
  function updateLaborHoursGroupPercent(rawValue: string) {
    if (rawValue !== '' && !/^\d*\.?\d*$/.test(rawValue)) return
    setLaborHoursGroupPercent(rawValue)
    window.localStorage.setItem(laborHoursGroupPercentStorageKey, rawValue)
    applyLaborHoursAllocation(laborHours, rawValue)
    setNeedsRecalculation(false)
  }

  /** "Хөдөлмөрийн цаг" бүлгийн pseudo-мөрийн Заалтын зөрүү/Коэффициент/Нэгж үнэг өөрчилж, тоолуураар тооцсон дүнг цагаар дахин хуваарилна */
  function updateLaborMeterField(field: 'readingDifference' | 'coefficient' | 'unitPrice', rawValue: string) {
    if (rawValue !== '' && !/^\d*\.?\d*$/.test(rawValue)) return
    const current = getState(LABOR_METER_KEY)
    const nextMeterState = { ...current, [field]: rawValue }
    updateState(LABOR_METER_KEY, { [field]: rawValue })
    const meterCost = numberValue(nextMeterState.readingDifference) * numberValue(nextMeterState.coefficient) * numberValue(nextMeterState.unitPrice)
    const effectivePercent = totalCost > 0 ? String((meterCost / totalCost) * 100) : '0'
    applyLaborHoursAllocation(laborHours, effectivePercent)
    setNeedsRecalculation(false)
  }

  function toggleSection(unitId: string, sectionId: string) {
    setSavedSectionsByUnit((current) => ({
      ...current,
      [unitId]: (current[unitId] ?? []).map((section) => section.id === sectionId
        ? { ...section, isExpanded: !section.isExpanded }
        : section),
    }))
  }

  /** Excel импортгүй, шууд тооцоолсон "1.00 ..." хэсгийн хураах/дэлгэх төлөв */
  function toggleLiveSection(unitId: string) {
    setExpandedLiveSections((current) => ({ ...current, [unitId]: !(current[unitId] ?? true) }))
  }

  /** "Ажилтны тоо" / "Хөдөлмөрийн цаг" бүлгийг Excel маягийн хүснэгтээр — Алба нэгж баганаар доошоо цувруулж, тоо болон зардлыг ар ар нь харуулна */
  function renderCountIndicatorTable(indicator: string, departments: string[]) {
    const isEmployeeGroup = indicator === EMPLOYEE_COUNT_INDICATOR
    const countLabel = isEmployeeGroup ? 'Ажилтны тоо' : 'Хөдөлмөрийн цаг'
    const counts = isEmployeeGroup ? employeeCounts : laborHours
    const updateCount = isEmployeeGroup ? updateEmployeeCount : updateLaborHours

    return (
      <div className="product-import-preview__table-wrap step2-count-table-wrap">
        <table className="product-import-preview__table step2-count-table">
          <thead>
            <tr>
              <th>Алба нэгж</th>
              <th>{countLabel}</th>
              <th>Эзлэх хувь</th>
              <th>Зардал</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((unit) => {
              const row = rows.find((entry) => entry.unit === unit)
              if (!row) return null
              const rowState = getState(unit)
              const unitTotalCost = calculateRow(row)

              return (
                <tr key={unit}>
                  <td>{unit}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step={isEmployeeGroup ? '1' : 'any'}
                      value={counts[unit] ?? ''}
                      placeholder="0"
                      onChange={(event) => updateCount(unit, event.target.value)}
                      aria-label={`${unit} ${countLabel.toLowerCase()}`}
                    />
                  </td>
                  <td>{numberValue(rowState.percentage).toFixed(2)}%</td>
                  <td>{formatAmount(unitTotalCost)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  function renderDepartmentCard(row: BaseInputRow) {
    const rowState = getState(row.unit)
    const readingEnabled = usesReadingDifference(row)
    const unitTotalCost = calculateRow(row)
    const showProductSection = isProductManufactured && Boolean(row.indicators[PRODUCT_COUNT_INDICATOR])
    const unitSections = showProductSection ? savedSectionsByUnit[row.unit] ?? [] : []
    const productsForUnit = showProductSection ? getProductsForUnit(row.unit) : []
    const liveProductRows = showProductSection ? buildProductAllocationRows(unitTotalCost, productsForUnit) : []
    const displaySections = unitSections.length > 0 && !needsRecalculation
      ? unitSections
      : (liveProductRows.length > 0 ? [{
          id: `live-allocation-${row.unit}`,
          title: 'Бүтээгдэхүүний үйлдвэрлэсэн зардал',
          rows: liveProductRows,
          isExpanded: expandedLiveSections[row.unit] ?? true,
        }] : [])

    return (
      <article className="step2-cost-card" key={row.unit}>
        <div className="step2-cost-card__header">
          <h3 className="step2-cost-card__title">{row.unit}</h3>
          {!row.indicators[EMPLOYEE_COUNT_INDICATOR] && !row.indicators[LABOR_HOURS_INDICATOR] && (
            <div className="step2-cost-card__header-actions">
              <input
                ref={(element) => {
                  fileInputRefs.current[row.unit] = element
                }}
                type="file"
                accept=".xlsx,.xls,.csv"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  void handleImportPreview(row.unit, file)
                  event.target.value = ''
                }}
              />
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => fileInputRefs.current[row.unit]?.click()}
                disabled={productsForUnit.length === 0}
              >
                Excel оруулах
              </button>
            </div>
          )}
        </div>

        <span className="step2-mode-badge">
          {readingEnabled
            ? 'Заалтын зөрүүгээр тооцоолж байна'
            : isProductManufactured && row.indicators[PRODUCT_COUNT_INDICATOR]
              ? 'Уйлдвэрт хуваарилагдах дүнгээр шууд тооцоолж байна'
              : 'Эзлэх хувиар тооцоолж байна'}
        </span>

        <div className={`step2-cost-card__mode ${readingEnabled ? 'step2-cost-card__mode--reading' : 'step2-cost-card__mode--percentage'}`}>
          {readingEnabled ? (
            <div className="step2-cost-card__inputs">
              <label>
                <span>Заалтын зөрүү</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={rowState.readingDifference}
                  placeholder="0"
                  onChange={(event) => updateNumber(row.unit, 'readingDifference', event.target.value)}
                />
              </label>
              <label>
                <span>Коэффициент</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={rowState.coefficient}
                  onChange={(event) => updateNumber(row.unit, 'coefficient', event.target.value)}
                />
              </label>
              <label>
                <span>Нэгж үнэ</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={rowState.unitPrice}
                  placeholder="0"
                  onChange={(event) => updateNumber(row.unit, 'unitPrice', event.target.value)}
                />
              </label>
            </div>
          ) : row.indicators[EMPLOYEE_COUNT_INDICATOR] ? (
            <label className="step2-percentage-field">
              <span>
                Ажилтны тоо
                <em className="step2-percentage-field__hint"> · Эзлэх хувь: {numberValue(rowState.percentage).toFixed(2)}%</em>
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={employeeCounts[row.unit] ?? ''}
                placeholder="0"
                onChange={(event) => updateEmployeeCount(row.unit, event.target.value)}
                aria-label={`${row.unit} ажилтны тоо`}
              />
            </label>
          ) : row.indicators[LABOR_HOURS_INDICATOR] ? (
            <label className="step2-percentage-field">
              <span>
                Хөдөлмөрийн цаг
                <em className="step2-percentage-field__hint"> · Эзлэх хувь: {numberValue(rowState.percentage).toFixed(2)}%</em>
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={laborHours[row.unit] ?? ''}
                placeholder="0"
                onChange={(event) => updateLaborHours(row.unit, event.target.value)}
                aria-label={`${row.unit} хөдөлмөрийн цаг`}
              />
            </label>
          ) : isProductManufactured && row.indicators[PRODUCT_COUNT_INDICATOR] ? null : (
            <label className="step2-percentage-field">
              <span>Нийт зардалд эзлэх хувь (%)</span>
              <input
                type="number"
                min="0"
                step="any"
                value={rowState.percentage}
                placeholder="0"
                onChange={(event) => updateNumber(row.unit, 'percentage', event.target.value)}
                aria-label={`${row.unit} нийт зардалд эзлэх хувь`}
              />
            </label>
          )}

          <label className="calculated-field step2-calculated-field">
            <span>Зардал</span>
            <input type="text" readOnly value={formatAmount(unitTotalCost)} />
          </label>
        </div>

        {displaySections.length > 0 && (
          <div className="saved-allocation-sections">
            {displaySections.map((section) => {
              const isLiveSection = section.id.startsWith('live-allocation-')
              const onToggle = () => (isLiveSection ? toggleLiveSection(row.unit) : toggleSection(row.unit, section.id))

              return (
              <div key={section.id} className="saved-allocation-section">
                <div
                  className="saved-allocation-section__header"
                  onClick={onToggle}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onToggle()
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="saved-allocation-section__chevron">{section.isExpanded ? '▾' : '▸'}</span>
                  <span>{section.rows[0]?.rowNumber ?? '1.00'} {section.title} -ийн нийт дүн</span>
                  <strong>{formatAmount(section.rows[0]?.allocatedCost ?? 0)}</strong>
                </div>

                {section.isExpanded && (
                  <div className="saved-allocation-section__body">
                    <div className="product-import-preview__table-wrap">
                      <table className="product-import-preview__table">
                        <thead>
                          <tr>
                            <th>Д/д</th>
                            <th>Дотоод код</th>
                            <th>Бэлэн бүтээгдэхүүн</th>
                            <th>Хэмжих нэгж</th>
                            <th>Үйлдвэрлэсэн тоо</th>
                            <th>Цувралын тоо</th>
                            <th>Нийт машин цаг</th>
                            <th>Хуваарилагдсан зардал</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.rows.map((rowItem) => (
                            <tr key={`${section.id}-${rowItem.rowNumber}-${rowItem.innerCode}`} className={rowItem.isTotal ? 'product-import-preview__total' : ''}>
                              <td>{rowItem.rowNumber}</td>
                              <td>{rowItem.innerCode}</td>
                              <td>{rowItem.warning ? `${rowItem.productName} (${rowItem.warning})` : rowItem.productName}</td>
                              <td>{rowItem.unit}</td>
                              <td>{formatQuantity(rowItem.quantity)}</td>
                              <td>{rowItem.seriesQty !== undefined ? formatQuantity(rowItem.seriesQty) : '-'}</td>
                              <td>{rowItem.totalMachineHours !== undefined ? formatQuantity(rowItem.totalMachineHours) : '-'}</td>
                              <td>{formatAmount(rowItem.allocatedCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}
      </article>
    )
  }

  return (
    <>
      <section className="card step2-cost-calculation">
        <div className="card__head card__head--row step2-cost-calculation__header">
          <div>
            <span className="step-label">2-р алхам</span>
            <h2 className="card__title">Зардал тооцох</h2>
            <p className="card__subtitle">1-р алхмын тоолуурын төлөвөөр зардлыг автоматаар тооцно.</p>
          </div>
          <div className="step2-cost-calculation__actions">
            <button type="button" className="btn btn--secondary" onClick={handleRefreshStep2}>
              Шинэчлэх
            </button>
            <button type="button" className="btn btn--primary" onClick={handleSaveStep2}>
              Хадгалах
            </button>
          </div>
        </div>

        {isStale && (
          <div className="allocation-warning" role="alert">
            Өмнөх алхмын өгөгдөл өөрчлөгдсөн байна. Шинэчлэх товчийг дарна уу.
          </div>
        )}
        {saveMessage && <div className="step2-save-message" role="status">{saveMessage}</div>}
        {needsRecalculation && (
          <div className="allocation-warning" role="alert">
            Дахин тооцоолох шаардлагатай: зардлын утга өөрчлөгдсөн байна.
          </div>
        )}

        {rows.length === 0 ? (
          <div className="allocation-warning" role="alert">
            1-р алхамд алба нэгж болон суурь үзүүлэлтээ сонгоно уу.
          </div>
        ) : selectedIndicators.length === 0 ? (
          <div className="allocation-warning" role="alert">
            1-р алхамд үзүүлэлт сонгоно уу.
          </div>
        ) : (
          <div className="step2-cost-calculation__list">
            {indicatorGroups
              .filter(({ indicator }) => indicator !== PRODUCT_COUNT_INDICATOR)
              .map(({ indicator, departments }) => {
                const isExpanded = expandedIndicators[indicator] ?? true
                // Бүтээгдэхүүний тоо чеклэсэн алба нэгжийг бусад бүлгээс хасна
                const filteredDepartments = departments.filter((unit) => {
                  const row = rows.find((entry) => entry.unit === unit)
                  if (!row) return false
                  if (row.indicators[PRODUCT_COUNT_INDICATOR]) return false
                  // Ажилтны тоо/Хөдөлмөрийн цагтай хамт чеклэсэн бол тухайн бүлгийн тоолуурын заалтаар аль хэдийн тооцогдсон тул энд давхардуулахгүй
                  if (
                    indicator === 'Тоолуурын бодит хэрэглээ'
                    && (row.indicators[EMPLOYEE_COUNT_INDICATOR] || row.indicators[LABOR_HOURS_INDICATOR])
                  ) {
                    return false
                  }
                  return true
                })

                if (filteredDepartments.length === 0) return null

                return (
                  <article className="step2-indicator-group" key={indicator}>
                    <div
                      className="step2-indicator-group__header"
                      onClick={() => toggleIndicatorGroup(indicator)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          toggleIndicatorGroup(indicator)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="saved-allocation-section__chevron">{isExpanded ? '▾' : '▸'}</span>
                      <div className="step2-indicator-group__label">
                        <strong>{indicator}</strong>
                        <span>{filteredDepartments.length} алба нэгж</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="step2-indicator-group__body">
                        {indicator === EMPLOYEE_COUNT_INDICATOR && (
                          filteredDepartments.some((unit) => {
                            const row = rows.find((entry) => entry.unit === unit)
                            return row ? usesReadingDifference(row) : false
                          }) ? (
                            <div className="step2-cost-card__inputs step2-employee-group-share">
                              <label>
                                <span>Заалтын зөрүү</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={getState(EMPLOYEE_METER_KEY).readingDifference}
                                  placeholder="0"
                                  onChange={(event) => updateEmployeeMeterField('readingDifference', event.target.value)}
                                  aria-label="Ажилтны тоо бүлгийн заалтын зөрүү"
                                />
                              </label>
                              <label>
                                <span>Коэффициент</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={getState(EMPLOYEE_METER_KEY).coefficient}
                                  onChange={(event) => updateEmployeeMeterField('coefficient', event.target.value)}
                                  aria-label="Ажилтны тоо бүлгийн коэффициент"
                                />
                              </label>
                              <label>
                                <span>Нэгж үнэ</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={getState(EMPLOYEE_METER_KEY).unitPrice}
                                  placeholder="0"
                                  onChange={(event) => updateEmployeeMeterField('unitPrice', event.target.value)}
                                  aria-label="Ажилтны тоо бүлгийн нэгж үнэ"
                                />
                              </label>
                              <label className="calculated-field">
                                <span>Зардал</span>
                                <input type="text" readOnly value={formatAmount(computeMeterCost(EMPLOYEE_METER_KEY))} />
                              </label>
                            </div>
                          ) : (
                          <div className="step2-employee-group-share">
                            <label>
                              <span>Нийт зардалд эзлэх хувь (%)</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={employeeGroupPercent}
                                placeholder="0"
                                onChange={(event) => updateEmployeeGroupPercent(event.target.value)}
                                aria-label="Ажилтны тоо бүлгийн нийт зардалд эзлэх хувь"
                              />
                            </label>
                            <label className="calculated-field">
                              <span>Хуваарилагдсан зардал</span>
                              <input
                                type="text"
                                readOnly
                                value={formatAmount(totalCost * (numberValue(employeeGroupPercent) / 100))}
                              />
                            </label>
                          </div>
                          )
                        )}
                        {indicator === LABOR_HOURS_INDICATOR && (
                          filteredDepartments.some((unit) => {
                            const row = rows.find((entry) => entry.unit === unit)
                            return row ? usesReadingDifference(row) : false
                          }) ? (
                            <div className="step2-cost-card__inputs step2-employee-group-share">
                              <label>
                                <span>Заалтын зөрүү</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={getState(LABOR_METER_KEY).readingDifference}
                                  placeholder="0"
                                  onChange={(event) => updateLaborMeterField('readingDifference', event.target.value)}
                                  aria-label="Хөдөлмөрийн цаг бүлгийн заалтын зөрүү"
                                />
                              </label>
                              <label>
                                <span>Коэффициент</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={getState(LABOR_METER_KEY).coefficient}
                                  onChange={(event) => updateLaborMeterField('coefficient', event.target.value)}
                                  aria-label="Хөдөлмөрийн цаг бүлгийн коэффициент"
                                />
                              </label>
                              <label>
                                <span>Нэгж үнэ</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={getState(LABOR_METER_KEY).unitPrice}
                                  placeholder="0"
                                  onChange={(event) => updateLaborMeterField('unitPrice', event.target.value)}
                                  aria-label="Хөдөлмөрийн цаг бүлгийн нэгж үнэ"
                                />
                              </label>
                              <label className="calculated-field">
                                <span>Зардал</span>
                                <input type="text" readOnly value={formatAmount(computeMeterCost(LABOR_METER_KEY))} />
                              </label>
                            </div>
                          ) : (
                          <div className="step2-employee-group-share">
                            <label>
                              <span>Нийт зардалд эзлэх хувь (%)</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={laborHoursGroupPercent}
                                placeholder="0"
                                onChange={(event) => updateLaborHoursGroupPercent(event.target.value)}
                                aria-label="Хөдөлмөрийн цаг бүлгийн нийт зардалд эзлэх хувь"
                              />
                            </label>
                            <label className="calculated-field">
                              <span>Хуваарилагдсан зардал</span>
                              <input
                                type="text"
                                readOnly
                                value={formatAmount(totalCost * (numberValue(laborHoursGroupPercent) / 100))}
                              />
                            </label>
                          </div>
                          )
                        )}
                        {indicator === EMPLOYEE_COUNT_INDICATOR || indicator === LABOR_HOURS_INDICATOR
                          ? renderCountIndicatorTable(indicator, filteredDepartments)
                          : filteredDepartments.map((unit) => {
                              const row = rows.find((entry) => entry.unit === unit)
                              return row ? renderDepartmentCard(row) : null
                            })}
                      </div>
                    )}
                  </article>
                )
              })}

            {/* "Үйлдвэрлэсэн бүтээгдэхүүний тоо" — IsProductCountSelected үед л Group-ын толгой хэсэг (Алба нэгж оруулах + бусад чеклэсэн) харагдана; алба нэгжийн карт үргэлжлүүлэн харагдана */}
            {productCountGroup && (
              <article className="step2-indicator-group" key={PRODUCT_COUNT_INDICATOR}>
                {isProductManufactured && (
                  <div
                    className="step2-indicator-group__header"
                    onClick={() => toggleIndicatorGroup(PRODUCT_COUNT_INDICATOR)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        toggleIndicatorGroup(PRODUCT_COUNT_INDICATOR)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="saved-allocation-section__chevron">
                      {(expandedIndicators[PRODUCT_COUNT_INDICATOR] ?? true) ? '▾' : '▸'}
                    </span>
                    <div className="step2-indicator-group__label">
                      <strong>{PRODUCT_COUNT_INDICATOR}</strong>
                      <span>{productCountGroup.departments.length} алба нэгж</span>
                    </div>
                  </div>
                )}

                {(!isProductManufactured || (expandedIndicators[PRODUCT_COUNT_INDICATOR] ?? true)) && (
                  <div className="step2-indicator-group__body">
                    <div className="step2-employee-group-share">
                      <label className="calculated-field">
                        <span>Yйлдвэрт хуваарилагдах дүн</span>
                        <input type="text" readOnly value={formatAmount(factoryAllocationAmount)} />
                      </label>
                    </div>
                    {productCountGroup.departments.map((unit) => {
                      const row = rows.find((entry) => entry.unit === unit)
                      return row ? renderDepartmentCard(row) : null
                    })}
                  </div>
                )}
              </article>
            )}
          </div>
        )}

        {percentageTotal > 100 && (
          <div className="allocation-warning" role="alert">
            Бүх алба нэгжийн эзлэх хувийн нийлбэр 100%-иас хэтэрлээ. Одоогийн нийлбэр: {percentageTotal.toLocaleString('mn-MN')}%.
          </div>
        )}

        <div className="step2-cost-calculation__total calculated-field">
          <span>Бүх алба нэгжийн зардлын нийт дүн</span>
          <strong>{formatAmount(totalCalculated)}</strong>
        </div>
      </section>

      <div className={`cost-comparison ${isBalanced ? 'cost-comparison--success' : 'cost-comparison--warning'}`}>
        <div className="cost-comparison__row">
          <span>Нийт дүн:</span>
          <strong>{formatAmount(totalCost)}</strong>
        </div>
        <div className="cost-comparison__row">
          <span>Хуваарилагдсан:</span>
          <strong>{rows.length > 0 ? formatAmount(totalCalculated) : '-'}</strong>
        </div>
        <div className="cost-comparison__row">
          <span>Зөрүү:</span>
          <strong>{formatAmount(Math.abs(difference))}</strong>
        </div>
        {!isBalanced && (
          <div className="cost-comparison__row">
            <span>{difference > 0 ? 'Дутуу:' : 'Илүү:'}</span>
            <strong>{formatAmount(Math.abs(difference))}</strong>
          </div>
        )}
        <button
          type="button"
          className="btn btn--primary"
          onClick={onNext}
          disabled={!isBalanced}
          title={isBalanced ? 'Үргэлжлүүлэх' : 'Эх дүн болон хуваарилагдсан дүн тэнцээгүй байна'}
        >
          Дараах
        </button>
      </div>

    </>
  )
}
