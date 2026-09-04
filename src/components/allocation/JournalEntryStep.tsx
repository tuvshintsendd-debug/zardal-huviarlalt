import { useEffect, useMemo, useState } from 'react'
import { loadAccountReconciliation } from '../../services/accountReconciliation'
import { createId } from '../../utils/id'
import { formatMoney, formatNumber, formatPeriod } from '../../utils/format'

export interface JournalEntryRow {
  unit: string
  amount: number
  /** Yйлдвэрийн (бүтээгдэхүүн үйлдвэрлэсэн) алба нэгжийн хувьд бүтээгдэхүүний ERP код — Шинжилгээний данс шууд үүгээр дүүрнэ */
  productErpCode?: string
  productName?: string
}

interface JournalEntryStepProps {
  period: string
  entries: JournalEntryRow[]
  totalCost: number
}

interface JournalLineOverrides {
  counterparty: string
  account: string
  description: string
  analysisAccount: string
  debit: string
  credit: string
}

/** Хэрэглэгч гараар нэмсэн журналын бичилтийн мөр — бүх талбар нь чөлөөтэй засварлагдана */
interface ManualJournalRow extends JournalLineOverrides {
  id: string
  unit: string
}

function createManualRow(): ManualJournalRow {
  return {
    id: createId(),
    unit: '',
    counterparty: 'ДЦСтанц-3',
    account: '',
    description: '',
    analysisAccount: '',
    debit: '',
    credit: '',
  }
}

function storageKeyFor(period: string): string {
  return `zardal.electricity.journal.${period}.v1`
}

function lineKey(entry: JournalEntryRow, index: number): string {
  return `${entry.unit}::${entry.productErpCode ?? ''}::${index}`
}

/** "2330.5" -> "2,330.50" — таслалтай харуулах дэлгэц үзүүлэнт */
function formatAmountInput(value: string): string {
  if (value === '') return ''
  const parsed = Number(value)
  return Number.isFinite(parsed) ? formatNumber(parsed) : value
}

/** Хэрэглэгчийн бичсэн таслалыг арилж, баталгаажсан тоон тэмдэгт аваад хадгалахад бэлэн болгоно */
function sanitizeAmountInput(raw: string, previous: string): string {
  const cleaned = raw.replace(/,/g, '')
  if (cleaned === '' || /^\d*\.?\d*$/.test(cleaned)) return cleaned
  return previous
}

function loadJournalState(period: string): { reference: string; date: string; overrides: Record<string, JournalLineOverrides>; manualRows: ManualJournalRow[] } {
  if (typeof window === 'undefined') return { reference: '', date: '', overrides: {}, manualRows: [] }
  try {
    const raw = window.localStorage.getItem(storageKeyFor(period))
    const parsed = raw ? JSON.parse(raw) : {}
    return {
      reference: typeof parsed.reference === 'string' ? parsed.reference : '',
      date: typeof parsed.date === 'string' ? parsed.date : '',
      overrides: parsed.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {},
      manualRows: Array.isArray(parsed.manualRows) ? parsed.manualRows : [],
    }
  } catch {
    return { reference: '', date: '', overrides: {}, manualRows: [] }
  }
}

/** 4-р алхам: ERP-д импортлох Журналын бичилтийн загвар (Reference / Огноо / Харилцагч / Данс / Гүйлгээний утга / Шинжилгээний данс / Дебет / Кредит / Алба нэгж) */
export function JournalEntryStep({ period, entries, totalCost }: JournalEntryStepProps) {
  const [reference, setReference] = useState('')
  const [date, setDate] = useState('')
  const [overrides, setOverrides] = useState<Record<string, JournalLineOverrides>>({})
  const [manualRows, setManualRows] = useState<ManualJournalRow[]>([])
  const [saveMessage, setSaveMessage] = useState('')

  const accountByUnit = useMemo(() => {
    const map = new Map<string, { analysisAccount: string; erpCode: string; erpName: string }>()
    loadAccountReconciliation().rows.forEach((row) => {
      map.set(row.orgUnitName, {
        analysisAccount: row.analysisAccount,
        erpCode: row.electricity.erpCode,
        erpName: row.electricity.erpName,
      })
    })
    return map
  }, [])

  useEffect(() => {
    const saved = loadJournalState(period)
    setReference(saved.reference)
    setDate(saved.date)
    setOverrides(saved.overrides)
    setManualRows(saved.manualRows)
  }, [period])

  function getDefaultLine(entry: JournalEntryRow): JournalLineOverrides {
    const mapped = accountByUnit.get(entry.unit)
    return {
      counterparty: 'ДЦСтанц-3',
      account: mapped ? `${mapped.erpCode} ${mapped.erpName}`.trim() : '',
      description: `${formatPeriod(period)} - ${entry.unit}${entry.productName ? ` - ${entry.productName}` : ''} цахилгааны зардал хуваарилалт`,
      // Yйлдвэрийн бүтээгдэхүүний мөр бол дансны харгалзаанаас авахгүйгээр шууд ERP кодыг ашиглана
      analysisAccount: entry.productErpCode ?? mapped?.analysisAccount ?? '',
      debit: entry.amount.toFixed(2),
      credit: '',
    }
  }

  function getLine(entry: JournalEntryRow, index: number): JournalLineOverrides {
    return overrides[lineKey(entry, index)] ?? getDefaultLine(entry)
  }

  function updateLine(entry: JournalEntryRow, index: number, field: keyof JournalLineOverrides, value: string) {
    const key = lineKey(entry, index)
    const current = getLine(entry, index)
    const nextValue = field === 'debit' || field === 'credit' ? sanitizeAmountInput(value, current[field]) : value
    setOverrides((prev) => ({
      ...prev,
      [key]: { ...current, [field]: nextValue },
    }))
    setSaveMessage('')
  }

  function handleSave() {
    window.localStorage.setItem(storageKeyFor(period), JSON.stringify({ reference, date, overrides, manualRows }))
    setSaveMessage('Журналын бичилт хадгалагдлаа')
  }

  /** Хэрэглэгч гараар нэмэлт журналын мөр нэмнэ */
  function addManualRow() {
    setManualRows((current) => [...current, createManualRow()])
    setSaveMessage('')
  }

  function updateManualRow(id: string, field: keyof ManualJournalRow, value: string) {
    setManualRows((current) => current.map((row) => {
      if (row.id !== id) return row
      const nextValue = field === 'debit' || field === 'credit' ? sanitizeAmountInput(value, row[field]) : value
      return { ...row, [field]: nextValue }
    }))
    setSaveMessage('')
  }

  function removeManualRow(id: string) {
    setManualRows((current) => current.filter((row) => row.id !== id))
    setSaveMessage('')
  }

  /** Хуваарилагдсан мөрүүдийг дэлгэцээ багануудаар nn xlsx болгоож татна */
  async function handleExport() {
    const XLSX = await import('xlsx')
    // "14051101 ДУ-НЗ-Цахилгааны зардал" гэх мэт утгаас зөвхөн урд талын 8 оронтой ERP кодыг нь ялгаж авна
    const extractAccountCode = (value: string) => value.match(/\d{6,}/)?.[0] ?? value.split(' ')[0] ?? ''
    const rows = [
      ...validEntries.map((entry, index) => {
        const line = getLine(entry, index)
        return {
          Reference: reference,
          Огноо: date,
          'Журналын бичилтүүд/Харилцагч': line.counterparty,
          'Журналын бичилтүүд/Данс': extractAccountCode(line.account),
          'Журналын бичилтүүд/Гүйлгээний утга': line.description,
          'Журналын бичилтүүд/Шинжилгээний данс': line.analysisAccount,
          'Журналын бичилтүүд/Дебет': Number(line.debit || 0),
          'Журналын бичилтүүд/Кредит': Number(line.credit || 0),
        }
      }),
      ...manualRows.map((row) => ({
        Reference: reference,
        Огноо: date,
        'Журналын бичилтүүд/Харилцагч': row.counterparty,
        'Журналын бичилтүүд/Данс': extractAccountCode(row.account),
        'Журналын бичилтүүд/Гүйлгээний утга': row.description,
        'Журналын бичилтүүд/Шинжилгээний данс': row.analysisAccount,
        'Журналын бичилтүүд/Дебет': Number(row.debit || 0),
        'Журналын бичилтүүд/Кредит': Number(row.credit || 0),
      })),
    ]

    const sheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Журналын бичилт')
    XLSX.writeFile(workbook, `zhurnalyn-bichilt-${period}.xlsx`)
  }

  const validEntries = entries.filter((entry) => Math.abs(entry.amount) > 0.004)

  return (
    <section className="card journal-entry-step">
      <div className="card__head card__head--row">
        <div>
          <span className="step-label">4-р алхам</span>
          <h2 className="card__title">Журналын бичилт үүсгэх</h2>
          <p className="card__subtitle">ERP рүү импортлох Журналын бичилтийн загвараар мөрүүдийг үүсгэнэ.</p>
        </div>
        <div className="allocation-page__total">
          <span>Нийт дүн</span>
          <strong>{formatMoney(totalCost)}</strong>
        </div>
      </div>

      <div className="journal-entry-step__header-fields">
        <label>
          <span>Reference</span>
          <input type="text" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Reference" />
        </label>
        <label>
          <span>Огноо</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      </div>

      {validEntries.length === 0 && manualRows.length === 0 ? (
        <div className="allocation-warning" role="alert">
          Хуваарилагдсан зардал олдсонгүй. Өмнөх алхамд буцаж зардлаа тооцоолно уу.
        </div>
      ) : (
        <div className="product-import-preview__table-wrap journal-entry-table-wrap">
          <table className="product-import-preview__table journal-entry-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Огноо</th>
                <th>Журналын бичилтүүд/Харилцагч</th>
                <th>Журналын бичилтүүд/Данс</th>
                <th>Журналын бичилтүүд/Гүйлгээний утга</th>
                <th>Журналын бичилтүүд/Шинжилгээний данс</th>
                <th>Журналын бичилтүүд/Дебет</th>
                <th>Журналын бичилтүүд/Кредит</th>
                <th>Алба нэгж</th>
                <th>Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {validEntries.map((entry, index) => {
                const line = getLine(entry, index)
                return (
                  <tr key={lineKey(entry, index)}>
                    <td>{reference || '-'}</td>
                    <td>{date || '-'}</td>
                    <td>
                      <input
                        type="text"
                        value={line.counterparty}
                        placeholder="Харилцагч"
                        onChange={(event) => updateLine(entry, index, 'counterparty', event.target.value)}
                        aria-label={`${entry.unit} харилцагч`}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={line.account}
                        placeholder="Данс"
                        onChange={(event) => updateLine(entry, index, 'account', event.target.value)}
                        aria-label={`${entry.unit} данс`}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={line.description}
                        onChange={(event) => updateLine(entry, index, 'description', event.target.value)}
                        aria-label={`${entry.unit} гүйлгээний утга`}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={line.analysisAccount}
                        placeholder="Шинжилгээний данс"
                        onChange={(event) => updateLine(entry, index, 'analysisAccount', event.target.value)}
                        aria-label={`${entry.unit} шинжилгээний данс`}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formatAmountInput(line.debit)}
                        onChange={(event) => updateLine(entry, index, 'debit', event.target.value)}
                        aria-label={`${entry.unit} дебет`}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formatAmountInput(line.credit)}
                        placeholder="0"
                        onChange={(event) => updateLine(entry, index, 'credit', event.target.value)}
                        aria-label={`${entry.unit} кредит`}
                      />
                    </td>
                    <td>{entry.unit}</td>
                    <td />
                  </tr>
                )
              })}
              {manualRows.map((row) => (
                <tr key={row.id}>
                  <td>{reference || '-'}</td>
                  <td>{date || '-'}</td>
                  <td>
                    <input
                      type="text"
                      value={row.counterparty}
                      placeholder="Харилцагч"
                      onChange={(event) => updateManualRow(row.id, 'counterparty', event.target.value)}
                      aria-label="гараар нэмсэн мөр харилцагч"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.account}
                      placeholder="Данс"
                      onChange={(event) => updateManualRow(row.id, 'account', event.target.value)}
                      aria-label="гараар нэмсэн мөр данс"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.description}
                      placeholder="Гүйлгээний утга"
                      onChange={(event) => updateManualRow(row.id, 'description', event.target.value)}
                      aria-label="гараар нэмсэн мөр гүйлгээний утга"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.analysisAccount}
                      placeholder="Шинжилгээний данс"
                      onChange={(event) => updateManualRow(row.id, 'analysisAccount', event.target.value)}
                      aria-label="гараар нэмсэн мөр шинжилгээний данс"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formatAmountInput(row.debit)}
                      placeholder="0"
                      onChange={(event) => updateManualRow(row.id, 'debit', event.target.value)}
                      aria-label="гараар нэмсэн мөр дебет"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formatAmountInput(row.credit)}
                      placeholder="0"
                      onChange={(event) => updateManualRow(row.id, 'credit', event.target.value)}
                      aria-label="гараар нэмсэн мөр кредит"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.unit}
                      placeholder="Алба нэгж"
                      onChange={(event) => updateManualRow(row.id, 'unit', event.target.value)}
                      aria-label="гараар нэмсэн мөр алба нэгж"
                    />
                  </td>
                  <td>
                    <button type="button" className="btn btn--ghost journal-entry-table__remove" onClick={() => removeManualRow(row.id)}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="product-import-preview__total">
                <td colSpan={6}>Нийт дүн</td>
                <td>{formatMoney(validEntries.reduce((sum, entry) => sum + entry.amount, 0) + manualRows.reduce((sum, row) => sum + Number(row.debit || 0), 0))}</td>
                <td>{formatMoney(validEntries.reduce((sum, entry, index) => sum + Number(getLine(entry, index).credit || 0), 0) + manualRows.reduce((sum, row) => sum + Number(row.credit || 0), 0))}</td>
                <td />
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="journal-entry-step__actions">
        <button type="button" className="btn btn--secondary" onClick={addManualRow}>
          Мөр нэмэх
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => void handleExport()}
          disabled={validEntries.length === 0 && manualRows.length === 0}
        >
          Excel татах
        </button>
        <button type="button" className="btn btn--primary" onClick={handleSave} disabled={validEntries.length === 0 && manualRows.length === 0}>
          Хадгалах
        </button>
        {saveMessage && <span className="step2-save-message" role="status">{saveMessage}</span>}
      </div>
    </section>
  )
}
