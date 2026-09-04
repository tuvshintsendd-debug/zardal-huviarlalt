import { useRef } from 'react'
import { formatPeriod } from '../../utils/format'

interface AppHeaderProps {
  periods: string[]
  selectedPeriod: string
  onPeriodChange: (period: string) => void
  onImportFile: (file: File) => void
  onExport: () => void
  onDownloadTemplate: () => void
  onClearAll: () => void
  onOpenAccountMapping: () => void
  canExport: boolean
}

export function AppHeader({
  periods,
  selectedPeriod,
  onPeriodChange,
  onImportFile,
  onExport,
  onDownloadTemplate,
  onClearAll,
  onOpenAccountMapping,
  canExport,
}: AppHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__logo" aria-hidden="true">
          ⚙
        </span>
        <div>
          <h1 className="topbar__title">Ашиглалтын зардал хуваарилах</h1>
          <p className="topbar__subtitle">1-р үе шат · Нэхэмжлэлийн зардал тооцох</p>
        </div>
      </div>

      <div className="topbar__actions">
        <label className="period-select">
          <span className="period-select__label">Тайлант үе</span>
          <select
            value={selectedPeriod}
            onChange={(event) => onPeriodChange(event.target.value)}
          >
            <option value="all">Бүх үе</option>
            {periods.map((period) => (
              <option key={period} value={period}>
                {formatPeriod(period)}
              </option>
            ))}
          </select>
        </label>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onImportFile(file)
            event.target.value = ''
          }}
        />

        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => fileInputRef.current?.click()}
        >
          Excel оруулах
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onDownloadTemplate}
        >
          Загвар татах
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={onExport}
          disabled={!canExport}
        >
          Excel татах
        </button>
        <button
          type="button"
          className="btn btn--danger-ghost"
          onClick={onClearAll}
          disabled={!canExport}
        >
          Цэвэрлэх
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={onOpenAccountMapping}
        >
          Дансны харгалзаа
        </button>
      </div>
    </header>
  )
}
