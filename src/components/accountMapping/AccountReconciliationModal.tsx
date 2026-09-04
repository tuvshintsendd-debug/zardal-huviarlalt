import { useMemo, useState } from 'react'
import type { AccountReconciliationColumn, AccountReconciliationRow, ErpAccountRef } from '../../types'
import {
  createAccountReconciliationRow,
  loadAccountReconciliation,
  saveAccountReconciliation,
  validateAccountReconciliation,
} from '../../services/accountReconciliation'
import { createId } from '../../utils/id'

interface AccountReconciliationModalProps {
  onClose: () => void
}

type UtilityField = 'electricity' | 'heat' | 'water'

/** "Дансны харгалзаа" — засварлах боломжтой DataGrid цонх (MVVM: view = энэ компонент) */
export function AccountReconciliationModal({ onClose }: AccountReconciliationModalProps) {
  const initial = useMemo(() => loadAccountReconciliation(), [])
  const [rows, setRows] = useState<AccountReconciliationRow[]>(initial.rows)
  const [extraColumns, setExtraColumns] = useState<AccountReconciliationColumn[]>(
    initial.extraColumns,
  )
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function updateRow(id: string, patch: Partial<AccountReconciliationRow>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function updateErpField(id: string, field: UtilityField, patch: Partial<ErpAccountRef>) {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: { ...row[field], ...patch } } : row)),
    )
  }

  function updateExtraCell(id: string, columnId: string, value: string) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, extra: { ...row.extra, [columnId]: value } } : row,
      ),
    )
  }

  /** AddRowCommand */
  function handleAddRow() {
    setRows((prev) => [...prev, createAccountReconciliationRow()])
  }

  function handleRemoveRow(id: string) {
    setRows((prev) => prev.filter((row) => row.id !== id))
  }

  /** AddColumnCommand — NewColumn Dialog */
  function handleAddColumn() {
    const header = window.prompt('Шинэ баганын нэрийг оруулна уу:')
    if (!header || !header.trim()) return
    const column: AccountReconciliationColumn = { id: createId(), header: header.trim() }
    setExtraColumns((prev) => [...prev, column])
  }

  /** SaveCommand */
  function handleSave() {
    const validationError = validateAccountReconciliation(rows)
    if (validationError) {
      setError(validationError)
      setSuccess(null)
      return
    }
    setError(null)
    saveAccountReconciliation({ rows, extraColumns })
    setSuccess('Амжилттай хадгалагдлаа')
  }

  const columnCount = 8 + extraColumns.length + 1

  return (
    <div
      className="product-entry-modal account-reconciliation-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Дансны харгалзаа"
      onClick={onClose}
    >
      <div
        className="product-entry-modal__panel account-reconciliation-modal__panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="product-entry-modal__header">
          <h2 className="card__title">Дансны харгалзаа</h2>
        </div>

        <div className="account-reconciliation-toolbar">
          <button type="button" className="btn btn--secondary" onClick={handleAddRow}>
            + Мөр нэмэх
          </button>
          <button type="button" className="btn btn--secondary" onClick={handleAddColumn}>
            + Багана нэмэх
          </button>
        </div>

        <div className="account-reconciliation-table-wrap">
          <table className="table account-reconciliation-table">
            <thead>
              <tr>
                <th rowSpan={2}>№</th>
                <th rowSpan={2}>Алба нэгжийн нэр</th>
                <th rowSpan={2}>Шинжилгээний данс</th>
                <th colSpan={2} className="account-reconciliation-table__group account-reconciliation-table__group--electricity">
                  Цахилгаан
                </th>
                <th colSpan={2} className="account-reconciliation-table__group account-reconciliation-table__group--heat">
                  Дулаан
                </th>
                <th colSpan={2} className="account-reconciliation-table__group account-reconciliation-table__group--water">
                  Ус
                </th>
                {extraColumns.map((column) => (
                  <th key={column.id} rowSpan={2}>
                    {column.header}
                  </th>
                ))}
                <th rowSpan={2} aria-label="Устгах" />
              </tr>
              <tr>
                <th className="account-reconciliation-table__group account-reconciliation-table__group--electricity">ERP код</th>
                <th className="account-reconciliation-table__group account-reconciliation-table__group--electricity">ERP нэр</th>
                <th className="account-reconciliation-table__group account-reconciliation-table__group--heat">ERP код</th>
                <th className="account-reconciliation-table__group account-reconciliation-table__group--heat">ERP нэр</th>
                <th className="account-reconciliation-table__group account-reconciliation-table__group--water">ERP код</th>
                <th className="account-reconciliation-table__group account-reconciliation-table__group--water">ERP нэр</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="empty">
                    Мөр алга. “+ Мөр нэмэх” товчоор эхэлнэ үү.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="num">{index + 1}</td>
                    <td>
                      <input
                        type="text"
                        value={row.orgUnitName}
                        onChange={(event) => updateRow(row.id, { orgUnitName: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.analysisAccount}
                        onChange={(event) =>
                          updateRow(row.id, { analysisAccount: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.electricity.erpCode}
                        onChange={(event) =>
                          updateErpField(row.id, 'electricity', { erpCode: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.electricity.erpName}
                        onChange={(event) =>
                          updateErpField(row.id, 'electricity', { erpName: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.heat.erpCode}
                        onChange={(event) =>
                          updateErpField(row.id, 'heat', { erpCode: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.heat.erpName}
                        onChange={(event) =>
                          updateErpField(row.id, 'heat', { erpName: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.water.erpCode}
                        onChange={(event) =>
                          updateErpField(row.id, 'water', { erpCode: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.water.erpName}
                        onChange={(event) =>
                          updateErpField(row.id, 'water', { erpName: event.target.value })
                        }
                      />
                    </td>
                    {extraColumns.map((column) => (
                      <td key={column.id}>
                        <input
                          type="text"
                          value={row.extra[column.id] ?? ''}
                          onChange={(event) => updateExtraCell(row.id, column.id, event.target.value)}
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        className="btn btn--danger-ghost account-reconciliation-table__remove"
                        onClick={() => handleRemoveRow(row.id)}
                        aria-label="Мөр устгах"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {error && <p className="account-reconciliation-message account-reconciliation-message--error">{error}</p>}
        {success && (
          <p className="account-reconciliation-message account-reconciliation-message--success">{success}</p>
        )}

        <div className="product-entry-modal__actions product-entry-modal__actions--footer">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Цуцлах
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSave}>
            Хадгалах
          </button>
        </div>
      </div>
    </div>
  )
}

