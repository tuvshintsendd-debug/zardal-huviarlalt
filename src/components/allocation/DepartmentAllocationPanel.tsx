import { useMemo } from 'react'
import type { AllocationBasis } from '../../services/allocation'
import {
  allocateDepartments,
  createEmptyDepartment,
  type Department,
} from '../../services/departmentAllocation'
import { formatMoney, formatNumber } from '../../utils/format'

interface DepartmentAllocationPanelProps {
  totalCost: number
  bases: AllocationBasis[]
  departments: Department[]
  onDepartmentsChange: (departments: Department[]) => void
}

export function DepartmentAllocationPanel({ totalCost, bases, departments, onDepartmentsChange }: DepartmentAllocationPanelProps) {
  const activeBases = useMemo(() => bases.filter((basis) => basis.active), [bases])
  const allocations = useMemo(
    () => allocateDepartments(totalCost, departments, bases),
    [totalCost, departments, bases],
  )
  const allocatedTotal = allocations.reduce((sum, department) => sum + department.amount, 0)

  function updateDepartment(id: string, changes: Partial<Department>) {
    onDepartmentsChange(departments.map((department) => (
      department.id === id ? { ...department, ...changes } : department
    )))
  }

  function updateValue(id: string, basisId: string, value: string) {
    const numericValue = Number(value) || 0
    onDepartmentsChange(departments.map((department) => (
      department.id === id
        ? { ...department, values: { ...department.values, [basisId]: numericValue } }
        : department
    )))
  }

  function addDepartment() {
    onDepartmentsChange([...departments, createEmptyDepartment(bases)])
  }

  return (
    <section className="card department-allocation">
      <div className="card__head card__head--row">
        <div>
          <h2 className="card__title">Цех/алба руу хуваарилах</h2>
          <p className="card__subtitle">Цех бүрийн суурийн утгыг оруулж, ногдох зардлыг тооцно</p>
        </div>
        <div className="card__total">
          <span>Хуваарилсан / Нийт</span>
          <strong>{formatMoney(allocatedTotal)} / {formatMoney(totalCost)}</strong>
        </div>
      </div>

      {activeBases.length === 0 ? (
        <div className="allocation-warning" role="alert">
          Эхлээд хуваарилалтын суурь тохиргооноос дор хаяж нэг суурийг идэвхжүүлнэ үү.
        </div>
      ) : (
        <>
          <div className="department-table-wrap">
            <table className="table department-table">
              <thead>
                <tr>
                  <th>Цех/албаны нэр</th>
                  {activeBases.map((basis) => <th className="num" key={basis.id}>{basis.name}</th>)}
                  <th className="num">Эзлэх хувь</th>
                  <th className="num">Ногдох дүн</th>
                  <th aria-label="Үйлдэл" />
                </tr>
              </thead>
              <tbody>
                {allocations.map((department) => (
                  <tr key={department.id}>
                    <td>
                      <input
                        className="department-input department-input--name"
                        type="text"
                        value={department.name}
                        placeholder="Жишээ: Б цех"
                        onChange={(event) => updateDepartment(department.id, { name: event.target.value })}
                      />
                    </td>
                    {activeBases.map((basis) => (
                      <td key={basis.id}>
                        <input
                          className="department-input"
                          type="number"
                          min="0"
                          step="any"
                          value={department.values[basis.id] ?? 0}
                          onChange={(event) => updateValue(department.id, basis.id, event.target.value)}
                        />
                      </td>
                    ))}
                    <td className="num">{formatNumber(department.share)}%</td>
                    <td className="num num--strong">{formatMoney(department.amount)}</td>
                    <td>
                      {departments.length > 1 && (
                        <button type="button" className="icon-btn icon-btn--danger" onClick={() => onDepartmentsChange(departments.filter((item) => item.id !== department.id))}>
                          Устгах
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={activeBases.length + 1}>Нийт</td>
                  <td className="num num--strong">{formatNumber(allocations.reduce((sum, department) => sum + department.share, 0))}%</td>
                  <td className="num num--strong">{formatMoney(allocatedTotal)}</td>
                  <td />
                </tr>
              </tfoot>
              </table>
            </div>
            <button type="button" className="btn btn--secondary" onClick={addDepartment}>+ Цех/алба нэмэх</button>

          </>
        )}
    </section>
  )
}
