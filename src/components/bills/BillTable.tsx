import type { BillWithCalc } from '../../types'
import { METHOD_LABELS, UTILITY_MAP } from '../../constants/utilities'
import { formatMoney, formatNumber, formatPeriod } from '../../utils/format'

interface BillTableProps {
  bills: BillWithCalc[]
  editingId: string | null
  onEdit: (id: string) => void
  onRemove: (id: string) => void
  onAllocate: (period: string) => void
}

export function BillTable({ bills, editingId, onEdit, onRemove, onAllocate }: BillTableProps) {
  const total = bills.reduce((sum, bill) => sum + bill.calc.totalAmount, 0)
  const monthlyTotals = Array.from(
    bills.reduce((groups, bill) => {
      const current = groups.get(bill.period) ?? { count: 0, total: 0 }
      groups.set(bill.period, {
        count: current.count + 1,
        total: current.total + bill.calc.totalAmount,
      })
      return groups
    }, new Map<string, { count: number; total: number }>()),
  ).sort(([first], [second]) => second.localeCompare(first))

  return (
    <section className="card">
      <div className="card__head card__head--row">
        <div>
          <h2 className="card__title">Бүртгэсэн зардал</h2>
          <p className="card__subtitle">{bills.length} мөр · олон мөрийн нийлбэр</p>
        </div>
        <div className="card__total">
          <span>Дүн</span>
          <strong>{formatMoney(total)}</strong>
        </div>
      </div>

      {bills.length === 0 ? (
        <p className="empty">
          Одоогоор бичилт алга. Дээрх формоор эсвэл “Excel оруулах” товчоор өгөгдөл нэмнэ үү.
        </p>
      ) : (
        <>
          <div className="monthly-summary">
            <h3 className="monthly-summary__title">Сар бүрийн нэгтгэл</h3>
            <div className="table-wrap">
              <table className="table table--summary">
                <thead>
                  <tr>
                    <th>Тайлант сар</th>
                    <th className="num">Мөрийн тоо</th>
                    <th className="num">Нийт дүн</th>
                    <th aria-label="Хуваарилалт" />
                  </tr>
                </thead>
                <tbody>
                  {monthlyTotals.map(([period, summary]) => (
                    <tr key={period}>
                      <td>{formatPeriod(period)}</td>
                      <td className="num">{summary.count}</td>
                      <td className="num num--strong">{formatMoney(summary.total)}</td>
                      <td className="row-actions">
                        <button type="button" className="icon-btn icon-btn--allocate" onClick={() => onAllocate(period)}>
                          Зардал хуваарилах
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
            <thead>
              <tr>
                <th>Төрөл</th>
                <th>Сар</th>
                <th>Нэр / Тайлбар</th>
                <th>Арга</th>
                <th className="num">Эхний</th>
                <th className="num">Сүүлийн</th>
                <th className="num">Квц</th>
                <th className="num">Хэрэглээ</th>
                <th className="num">Нэгж үнэ</th>
                <th className="num">Үндсэн дүн</th>
                <th className="num">НӨАТ/нэмэлт</th>
                <th className="num">Нийт дүн</th>
                <th aria-label="Үйлдэл" />
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => {
                const meta = UTILITY_MAP[bill.kind]
                const isMeter = bill.method === 'meter'
                return (
                  <tr
                    key={bill.id}
                    className={editingId === bill.id ? 'table__row--editing' : undefined}
                  >
                    <td>
                      <span className="tag" style={{ borderColor: meta.color, color: meta.color }}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td className="nowrap">{formatPeriod(bill.period)}</td>
                    <td>
                      <span className="cell-title">{bill.title}</span>
                      {bill.note && <span className="cell-note">{bill.note}</span>}
                    </td>
                    <td className="nowrap">{METHOD_LABELS[bill.method]}</td>
                    <td className="num">{isMeter ? formatNumber(bill.startReading) : '—'}</td>
                    <td className="num">{isMeter ? formatNumber(bill.endReading) : '—'}</td>
                    <td className="num">{isMeter ? formatNumber(bill.kvts) : '—'}</td>
                    <td className="num">
                      {bill.calc.usage === null
                        ? '—'
                        : `${formatNumber(bill.calc.usage)} ${meta.unit}`}
                    </td>
                    <td className="num">{isMeter ? formatNumber(bill.unitPrice) : '—'}</td>
                    <td className="num">{formatMoney(bill.calc.baseAmount)}</td>
                    <td className="num">
                      {bill.calc.surchargeAmount > 0
                        ? formatMoney(bill.calc.surchargeAmount)
                        : '—'}
                    </td>
                    <td className="num num--strong">{formatMoney(bill.calc.totalAmount)}</td>
                    <td className="row-actions">
                      <button type="button" className="icon-btn" onClick={() => onEdit(bill.id)}>
                        Засах
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        onClick={() => onRemove(bill.id)}
                      >
                        Устгах
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={11}>Олон мөрийн нийлбэр</td>
                <td className="num num--strong">{formatMoney(total)}</td>
                <td />
              </tr>
            </tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
