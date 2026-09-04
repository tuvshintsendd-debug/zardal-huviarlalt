import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProductInfoModel } from '../../types'
import {
  createEmptyProductInfoRow,
  importProductInfoFromExcel,
  loadProductInfoRows,
  PRODUCT_INFO_FIELD_LABELS,
  saveProductInfoRows,
} from '../../services/productInfo'

export interface BaseInputRow {
  unit: string
  indicators: Record<string, boolean>
}

interface SavedBaseInputState {
  columns: string[]
  rows: BaseInputRow[]
}

const STORAGE_KEY = 'zardal.electricity.baseInput.v1'

interface Step1BaseInputProps {
  orgUnits: string[]
  selectedMetrics: string[]
  onChange?: (rows: BaseInputRow[]) => void
  onProductRowsChange?: (rows: ProductInfoModel[]) => void
}

function createEmptyRow(unit: string, indicators: string[]): BaseInputRow {
  return {
    unit,
    indicators: Object.fromEntries(indicators.map((indicator) => [indicator, false])),
  }
}

function loadBaseInputState(): SavedBaseInputState | null {
  if (typeof window === 'undefined') return null

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) return null

    const parsed = JSON.parse(saved) as SavedBaseInputState
    if (!Array.isArray(parsed.columns) || !Array.isArray(parsed.rows)) return null

    return {
      columns: parsed.columns
        .filter((column): column is string => typeof column === 'string' && column.trim() !== '')
        .filter((column) => column !== 'Бүтээгдэхүүний үйлдвэрлэсэн тоо'),
      rows: parsed.rows
        .filter((row): row is BaseInputRow => typeof row?.unit === 'string' && row.unit.trim() !== '' && typeof row.indicators === 'object' && row.indicators !== null)
        .map((row) => ({
          unit: row.unit,
          indicators: Object.fromEntries(
            Object.entries(row.indicators)
              .filter(([indicator]) => indicator !== 'Бүтээгдэхүүний үйлдвэрлэсэн тоо')
              .map(([indicator, isSelected]) => [indicator, Boolean(isSelected)]),
          ),
        })),
    }
  } catch {
    return null
  }
}

export function Step1BaseInput({ orgUnits, selectedMetrics, onChange, onProductRowsChange }: Step1BaseInputProps) {
  const savedBaseInputState = useRef(loadBaseInputState())
  const [columns, setColumns] = useState<string[]>(() =>
    (savedBaseInputState.current?.columns ?? selectedMetrics.filter((item) => item && item.trim() !== ''))
      .filter((item) => item !== 'Бүтээгдэхүүний үйлдвэрлэсэн тоо'),
  )
  const [rows, setRows] = useState<BaseInputRow[]>(() => savedBaseInputState.current?.rows ?? [])
  const [productRows, setProductRows] = useState<ProductInfoModel[]>(() => loadProductInfoRows())
  const [productImportErrors, setProductImportErrors] = useState<string[]>([])
  const [duplicateProductCodes, setDuplicateProductCodes] = useState<string[]>([])
  const [isProductInfoExpanded, setIsProductInfoExpanded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const availableUnits = useMemo(
    () => orgUnits.filter((unit) => unit && unit.trim() !== ''),
    [orgUnits],
  )

  useEffect(() => {
    saveProductInfoRows(productRows)
  }, [productRows])

  useEffect(() => {
    if (savedBaseInputState.current) return

    setColumns((current) => {
      const preserved = current.filter((item) => !selectedMetrics.includes(item))
      return selectedMetrics
        .filter((item) => item && item.trim() !== '' && item !== 'Бүтээгдэхүүний үйлдвэрлэсэн тоо')
        .concat(preserved)
        .filter((item, index, self) => self.indexOf(item) === index)
    })
  }, [selectedMetrics])

  useEffect(() => {
    setRows((current) => current.filter((row) => availableUnits.includes(row.unit)))
  }, [availableUnits])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ columns, rows }))
  }, [columns, rows])

  useEffect(() => {
    onChange?.(rows)
  }, [onChange, rows])

  useEffect(() => {
    onProductRowsChange?.(productRows)
  }, [onProductRowsChange, productRows])

  function commit(nextRows: BaseInputRow[]) {
    setRows(nextRows)
  }

  function addRow() {
    if (availableUnits.length === 0) return

    const usedUnits = new Set(rows.map((row) => row.unit))
    const nextUnit = availableUnits.find((unit) => !usedUnits.has(unit))
    if (!nextUnit) return

    commit([...rows, createEmptyRow(nextUnit, columns)])
  }

  function removeRow(index: number) {
    commit(rows.filter((_, rowIndex) => rowIndex !== index))
  }

  function updateRowUnit(rowIndex: number, value: string) {
    const nextRows = rows.map((row, index) =>
      index === rowIndex ? { ...row, unit: value } : row,
    )
    commit(nextRows)
  }

  function toggleIndicator(rowIndex: number, indicator: string) {
    const nextRows = rows.map((row, index) => {
      if (index !== rowIndex) return row

      return {
        ...row,
        indicators: {
          ...row.indicators,
          [indicator]: !row.indicators[indicator],
        },
      }
    })
    commit(nextRows)
  }

  function addColumn() {
    const nextName = window.prompt('Шинэ үзүүлэлтийн нэр:', 'Шинэ үзүүлэлт')
    if (!nextName) return

    const trimmed = nextName.trim()
    if (!trimmed) return
    if (columns.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return

    const nextColumns = [...columns, trimmed]
    setColumns(nextColumns)

    const nextRows = rows.map((row) => ({
      ...row,
      indicators: {
        ...row.indicators,
        [trimmed]: false,
      },
    }))
    commit(nextRows)
  }

  function removeColumn(indicator: string) {
    if (!indicator) return

    const nextColumns = columns.filter((item) => item !== indicator)
    setColumns(nextColumns)

    const nextRows = rows.map((row) => {
      const nextIndicators = { ...row.indicators }
      delete nextIndicators[indicator]
      return { ...row, indicators: nextIndicators }
    })
    commit(nextRows)
  }

  function updateProductField(id: string, field: keyof ProductInfoModel, value: string | number) {
    setProductRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row
        return { ...row, [field]: value }
      }),
    )
  }

  function addProductRow() {
    setProductRows((current) => [...current, createEmptyProductInfoRow()])
  }

  function removeProductRow(id: string) {
    setProductRows((current) => current.filter((row) => row.id !== id))
  }

  async function handleImportProductInfo(file: File | null) {
    if (!file) return

    try {
      const result = await importProductInfoFromExcel(file)
      setProductImportErrors(result.errors)
      setDuplicateProductCodes(result.duplicateCodes)

      if (result.rows.length > 0) {
        const rowList = result.rows.map((row) => ({ ...row, id: row.id || createEmptyProductInfoRow().id }))
        setProductRows(rowList)
      }
    } catch (error) {
      setProductImportErrors([
        error instanceof Error ? error.message : 'Excel импорт хийх боломжгүй байна.',
      ])
      setDuplicateProductCodes([])
    }
  }

  function handleSaveProductInfo() {
    const duplicates = new Set(productRows.filter((row) => row.ErpCode.trim()).map((row) => row.ErpCode.trim()))
    const duplicateCodes = [...duplicates].filter((code) => productRows.filter((row) => row.ErpCode.trim() === code).length > 1)

    if (duplicateCodes.length > 0 && !window.confirm('Давхардсан ERP код байна. Үргэлжлүүлж хадгалах уу?')) {
      return
    }

    saveProductInfoRows(productRows)
    setProductImportErrors([])
    setDuplicateProductCodes([])
    window.alert('Бүтээгдэхүүний мэдээлэл хадгалагдлаа.')
  }

  return (
    <section className="card step1-base-input">
      <div className="card__head card__head--row">
        <div>
          <span className="step-label">1-р алхам</span>
          <h2 className="card__title">1.1 Зардал хуваарилах суурь</h2>
          <p className="card__subtitle">Алба нэгжийг сонгон, үзүүлэлтүүдийг чеклээрэй.</p>
        </div>
      </div>

      {availableUnits.length === 0 ? (
        <div className="allocation-warning" role="alert">
          Эхлээд алба нэгжээ оруулна уу.
        </div>
      ) : (
        <>
          <div className="step1-base-input__table-wrap">
            <table className="table step1-base-input__table">
              <thead>
                <tr>
                  <th>Алба нэгж</th>
                  {columns.map((indicator) => (
                    <th key={indicator} className="step1-base-input__indicator-head">
                      <div className="step1-base-input__indicator-title">
                        <span>{indicator}</span>
                        <button
                          type="button"
                          className="step1-base-input__remove-col"
                          onClick={() => removeColumn(indicator)}
                          aria-label={`${indicator} устгах`}
                        >
                          ×
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="step1-base-input__add-col-cell">
                    <button type="button" className="btn btn--secondary step1-base-input__add-col-btn" onClick={addColumn}>
                      Багана нэмэх
                    </button>
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={`${row.unit}-${rowIndex}`}>
                    <td>
                      <select
                        className="department-input"
                        value={row.unit}
                        onChange={(event) => updateRowUnit(rowIndex, event.target.value)}
                        aria-label="Алба нэгж сонгох"
                      >
                        <option value="">Алба нэгж сонгох</option>
                        {availableUnits
                          .filter(
                            (unit) =>
                              unit === row.unit ||
                              !rows.some((rowItem, index) => index !== rowIndex && rowItem.unit === unit),
                          )
                          .map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                      </select>
                    </td>

                    {columns.map((indicator) => (
                      <td key={`${row.unit}-${indicator}`} className="step1-base-input__checkbox-cell">
                        <input
                          type="checkbox"
                          checked={Boolean(row.indicators[indicator])}
                          onChange={() => toggleIndicator(rowIndex, indicator)}
                          aria-label={`${row.unit} ${indicator}`}
                        />
                      </td>
                    ))}

                    <td className="step1-base-input__action-cell">
                      <button type="button" className="icon-btn icon-btn--danger" onClick={() => removeRow(rowIndex)}>
                        x
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="step1-base-input__footer">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={addRow}
              disabled={rows.length >= availableUnits.length}
            >
              Мөр нэмэх
            </button>
          </div>

          <div className="product-info-section">
            <div className="product-info-section__header">
              <div className="product-info-section__title-wrap">
                <h3 className="product-info-section__title">1.2 Бүтээгдэхүүний мэдээлэл</h3>
                <span className="product-info-section__count">{productRows.length} мөр</span>
              </div>

              <div className="product-info-section__actions">
                <button
                  type="button"
                  className="btn btn--ghost product-info-section__toggle"
                  onClick={() => setIsProductInfoExpanded((value) => !value)}
                >
                  {isProductInfoExpanded ? 'Хураах' : 'Дэлгэх'}
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    void handleImportProductInfo(file)
                    event.target.value = ''
                  }}
                />
                <button type="button" className="btn btn--secondary" onClick={() => fileInputRef.current?.click()}>
                  Excel-ээс импортлох
                </button>
              </div>
            </div>

            {isProductInfoExpanded && (
              <>
                <div className="product-info-table-wrap">
                  <table className="product-info-table">
                    <thead>
                      <tr>
                        {Object.entries(PRODUCT_INFO_FIELD_LABELS).map(([field, label]) => {
                          if (field === 'id') return null
                          return <th key={field}>{label}</th>
                        })}
                        <th className="product-info-table__action">Үйлдэл</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="product-info-table__empty">Мөр байхгүй</td>
                        </tr>
                      ) : (
                        productRows.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <input
                                type="text"
                                value={row.ErpCode}
                                onChange={(event) => updateProductField(row.id, 'ErpCode', event.target.value)}
                                placeholder="ERP-001"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={row.ProductName}
                                onChange={(event) => updateProductField(row.id, 'ProductName', event.target.value)}
                                placeholder="Бүтээгдэхүүний нэр"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={row.Unit}
                                onChange={(event) => updateProductField(row.id, 'Unit', event.target.value)}
                                placeholder="ш/кг/л/м"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="any"
                                value={row.MachineHours}
                                onChange={(event) => updateProductField(row.id, 'MachineHours', Number(event.target.value || 0))}
                                placeholder="0"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="any"
                                value={row.BatchTheoreticalQty}
                                onChange={(event) => updateProductField(row.id, 'BatchTheoreticalQty', Number(event.target.value || 0))}
                                placeholder="0"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={row.FactoryName}
                                onChange={(event) => updateProductField(row.id, 'FactoryName', event.target.value)}
                                placeholder="Үйлдвэрийн нэр"
                              />
                            </td>
                            <td>
                              <button type="button" className="icon-btn icon-btn--danger" onClick={() => removeProductRow(row.id)}>
                                Устгах
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="product-info-section__footer">
                  <button type="button" className="btn btn--secondary" onClick={addProductRow}>Мөр нэмэх</button>
                  <button type="button" className="btn btn--primary" onClick={handleSaveProductInfo}>Хадгалах</button>
                </div>
              </>
            )}

            {productImportErrors.length > 0 && (
              <div className="product-info-section__errors" role="alert">
                {productImportErrors.map((error) => (
                  <div key={error}>{error}</div>
                ))}
              </div>
            )}

            {duplicateProductCodes.length > 0 && (
              <div className="product-info-section__warning" role="alert">
                Давхардсан ERP код: {duplicateProductCodes.join(', ')}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
