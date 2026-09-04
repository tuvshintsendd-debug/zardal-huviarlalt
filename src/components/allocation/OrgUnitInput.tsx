import { useMemo, useState } from 'react'
import type { AccountReconciliationRow } from '../../types'
import { loadAccountReconciliation } from '../../services/accountReconciliation'

interface OrgUnitInputProps {
  units: string[]
  onChange: (units: string[]) => void
}

export function OrgUnitInput({ units, onChange }: OrgUnitInputProps) {
  const [draft, setDraft] = useState('')
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [pickerRows, setPickerRows] = useState<AccountReconciliationRow[]>([])
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())

  const normalizedUnits = useMemo(
    () => units.filter((unit) => unit && unit.trim() !== ''),
    [units],
  )

  /** Нэг буюу олон нэрийг давхардуулахгүйгээр жагсаалтад нэг дор нэмнэ */
  function addUnitNames(names: string[]) {
    const next = [...normalizedUnits]
    names.forEach((name) => {
      const normalized = name.trim().replace(/\s+/g, ' ')
      if (!normalized) return
      if (next.some((unit) => unit.toLowerCase() === normalized.toLowerCase())) return
      next.push(normalized)
    })
    onChange(next)
  }

  function addUnit() {
    addUnitNames([draft])
    setDraft('')
  }

  function removeUnit(unit: string) {
    onChange(normalizedUnits.filter((item) => item !== unit))
  }

  /** "Дансны харгалзаанаас сонгох" Dialog нээх — DataGrid-ийн мөрүүдийг ListBox-д bind хийнэ */
  function openPicker() {
    setPickerRows(loadAccountReconciliation().rows)
    setSelectedRowIds(new Set())
    setIsPickerOpen(true)
  }

  function closePicker() {
    setIsPickerOpen(false)
    setSelectedRowIds(new Set())
  }

  function toggleRow(id: string) {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** "Бүгдийг сонгох" — бүх мөрийн IsSelected-ийг нэг дор шилжүүлнэ */
  function toggleSelectAll() {
    setSelectedRowIds((prev) =>
      prev.size === pickerRows.length ? new Set() : new Set(pickerRows.map((row) => row.id)),
    )
  }

  /** OK товч — сонгосон бүх мөрийн нэрийг ViewModel рүү буцааж, алба нэгжийн жагсаалтад нэмнэ */
  function confirmPicker() {
    const selectedNames = pickerRows
      .filter((row) => selectedRowIds.has(row.id))
      .map((row) => row.orgUnitName)
    addUnitNames(selectedNames)
    closePicker()
  }

  const isAllSelected = pickerRows.length > 0 && selectedRowIds.size === pickerRows.length

  return (
    <section className="card org-unit-input">
      <div className="card__head card__head--row">
        <div>
          <span className="step-label">Алхам 1</span>
          <h2 className="card__title">Алба нэгж оруулах</h2>
          <p className="card__subtitle">Байгууллагын алба нэгжийн нэрийг жагсаалтаар оруулна.</p>
        </div>
      </div>

      <div className="allocation-add">
        <input
          type="text"
          value={draft}
          placeholder="Алба нэгжийн нэр"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') addUnit()
          }}
        />
        <button type="button" className="btn btn--secondary" onClick={addUnit} disabled={!draft.trim()}>
          Нэмэх
        </button>
        <button type="button" className="btn btn--secondary" onClick={openPicker}>
          Дансны харгалзаанаас сонгох
        </button>
      </div>

      {normalizedUnits.length === 0 ? (
        <div className="allocation-warning" role="alert">
          Алба нэгжийн жагсаалт хоосон байна.
        </div>
      ) : (
        <ul className="org-unit-list">
          {normalizedUnits.map((unit) => (
            <li key={unit} className="org-unit-item">
              <span>{unit}</span>
              <button type="button" className="icon-btn icon-btn--danger" onClick={() => removeUnit(unit)} aria-label={`${unit} устгах`}>
                x
              </button>
            </li>
          ))}
        </ul>
      )}

      {isPickerOpen && (
        <div
          className="product-entry-modal account-picker-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Дансны харгалзаанаас алба нэгж сонгох"
          onClick={closePicker}
        >
          <div
            className="product-entry-modal__panel account-picker-modal__panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="product-entry-modal__header">
              <h2 className="card__title">Алба нэгж сонгох</h2>
            </div>

            {pickerRows.length === 0 ? (
              <p className="empty">Дансны харгалзааны өгөгдөл алга.</p>
            ) : (
              <>
                <label className="account-picker-item account-picker-item--all">
                  <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} />
                  <span className="account-picker-item__name">Бүгдийг сонгох</span>
                </label>
                <ul className="account-picker-list">
                  {pickerRows.map((row) => (
                    <li key={row.id}>
                      <label className="account-picker-item">
                        <input
                          type="checkbox"
                          checked={selectedRowIds.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                        />
                        <span className="account-picker-item__text">
                          <span className="account-picker-item__name">
                            {row.orgUnitName || '(нэргүй)'}
                          </span>
                          <span className="account-picker-item__account">{row.analysisAccount}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="product-entry-modal__actions product-entry-modal__actions--footer">
              <button type="button" className="btn btn--secondary" onClick={closePicker}>
                Цуцлах
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={confirmPicker}
                disabled={selectedRowIds.size === 0}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}


