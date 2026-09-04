import type { CSSProperties } from 'react'
import type { KindSummary, UtilityKind } from '../../types'
import { UTILITY_MAP } from '../../constants/utilities'
import { formatMoney, formatNumber } from '../../utils/format'

interface CostSidebarProps {
  summaries: KindSummary[]
  totalAmount: number
  billCount: number
  activeKind: UtilityKind | null
  periodLabel: string
  onSelectKind: (kind: UtilityKind | null) => void
}

/**
 * Вебийн зүүн талын самбар — ашиглалтын зардлууд төрлөөрөө энд харагдана.
 * Карт дээр дарвал баруун талын хүснэгт тухайн төрлөөр шүүгдэнэ.
 */
export function CostSidebar({
  summaries,
  totalAmount,
  billCount,
  activeKind,
  periodLabel,
  onSelectKind,
}: CostSidebarProps) {
  const maxAmount = Math.max(...summaries.map((s) => s.totalAmount), 1)

  return (
    <aside className="sidebar">
      <div className="sidebar__head">
        <h2 className="sidebar__title">Ашиглалтын зардал</h2>
        <p className="sidebar__period">{periodLabel}</p>
      </div>

      <div className="sidebar__total">
        <span className="sidebar__total-label">Нийт дүн</span>
        <strong className="sidebar__total-value">{formatMoney(totalAmount)}</strong>
        <span className="sidebar__total-meta">{billCount} бичилт</span>
      </div>

      <ul className="cost-list">
        {summaries.map((summary) => {
          const meta = UTILITY_MAP[summary.kind]
          const share = totalAmount > 0 ? (summary.totalAmount / totalAmount) * 100 : 0
          const barWidth = (summary.totalAmount / maxAmount) * 100
          const isActive = activeKind === summary.kind

          return (
            <li key={summary.kind}>
              <button
                type="button"
                className={`cost-card${isActive ? ' cost-card--active' : ''}`}
                style={{ '--accent': meta.color } as CSSProperties}
                onClick={() => onSelectKind(isActive ? null : summary.kind)}
                aria-pressed={isActive}
              >
                <span className="cost-card__icon" aria-hidden="true">
                  {meta.icon}
                </span>
                <span className="cost-card__main">
                  <span className="cost-card__label">{meta.label}</span>
                  <span className="cost-card__amount">{formatMoney(summary.totalAmount)}</span>
                  <span className="cost-card__meta">
                    {summary.usage > 0
                      ? `${formatNumber(summary.usage)} ${meta.unit} · ${summary.count} бичилт`
                      : `${summary.count} бичилт`}
                  </span>
                  <span className="cost-card__bar">
                    <span className="cost-card__bar-fill" style={{ width: `${barWidth}%` }} />
                  </span>
                </span>
                <span className="cost-card__share">{share.toFixed(0)}%</span>
              </button>
            </li>
          )
        })}
      </ul>

      {activeKind && (
        <button type="button" className="btn btn--ghost btn--block" onClick={() => onSelectKind(null)}>
          Шүүлтийг арилгах
        </button>
      )}

      <div className="sidebar__note">
        <strong>Тооцооллын томьёо</strong>
        <p>Хэрэглээ = Сүүлийн заалт − Эхний заалт</p>
        <p>Үндсэн дүн = Хэрэглээ × Нэгж үнэ</p>
        <p>Нийт дүн = Үндсэн дүн + НӨАТ + Нэмэлт төлбөр</p>
      </div>
    </aside>
  )
}
