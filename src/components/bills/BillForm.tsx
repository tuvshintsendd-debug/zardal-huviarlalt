import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { CalcMethod, UtilityBill, UtilityKind, ValidationErrors } from '../../types'
import {
  DEFAULT_VAT_PERCENT,
  METHOD_LABELS,
  UTILITIES,
  UTILITY_MAP,
} from '../../constants/utilities'
import { calculateBill, hasErrors, validateBill } from '../../services/calculation'
import {
  billToDraft,
  draftToBill,
  emptyDraft,
  type BillDraft,
} from '../../services/billDraft'
import { formatMoney, formatNumber } from '../../utils/format'
import { createId } from '../../utils/id'
import { Field } from '../ui/Field'

interface MeterRow {
  startReading: string
  endReading: string
  kvts: string
  unitPrice: string
}

interface BillFormProps {
  /** Засварлаж буй бичилт. null бол шинээр нэмнэ. */
  editing: UtilityBill | null
  defaultKind: UtilityKind
  defaultPeriod: string
  onSave: (bills: UtilityBill[]) => void
  onCancelEdit: () => void
}

export function BillForm({
  editing,
  defaultKind,
  defaultPeriod,
  onSave,
  onCancelEdit,
}: BillFormProps) {
  const [draft, setDraft] = useState<BillDraft>(() =>
    editing ? billToDraft(editing) : emptyDraft(defaultKind, defaultPeriod),
  )
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [meterRows, setMeterRows] = useState<MeterRow[]>([])

  useEffect(() => {
    setErrors({})
    const nextDraft = editing ? billToDraft(editing) : emptyDraft(defaultKind, defaultPeriod)
    setDraft(nextDraft)
    setMeterRows([
      {
        startReading: nextDraft.startReading,
        endReading: nextDraft.endReading,
        kvts: nextDraft.kvts,
        unitPrice: nextDraft.unitPrice,
      },
    ])
  }, [editing, defaultKind, defaultPeriod])

  const meta = UTILITY_MAP[draft.kind]
  const rowBills = useMemo(
    () => meterRows.map((row) => draftToBill({ ...draft, ...row })),
    [draft, meterRows],
  )
  const previews = useMemo(
    () => (draft.method === 'meter' ? rowBills.map(calculateBill) : [calculateBill(draftToBill(draft))]),
    [draft, rowBills],
  )
  const preview = useMemo(
    () => previews.reduce((total, item) => ({
      usage: item.usage === null ? null : (total.usage ?? 0) + item.usage,
      baseAmount: total.baseAmount + item.baseAmount,
      vatAmount: total.vatAmount + item.vatAmount,
      extraAmount: total.extraAmount + item.extraAmount,
      surchargeAmount: total.surchargeAmount + item.surchargeAmount,
      totalAmount: total.totalAmount + item.totalAmount,
    }), { usage: 0, baseAmount: 0, vatAmount: 0, extraAmount: 0, surchargeAmount: 0, totalAmount: 0 }),
    [previews],
  )

  function update<K extends keyof BillDraft>(key: K, value: BillDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function updateMeterRow(index: number, key: keyof MeterRow, value: string) {
    setMeterRows((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const bills = draft.method === 'meter'
      ? rowBills.map((bill, index) => ({ ...bill, id: index === 0 ? draft.id : createId() }))
      : [draftToBill(draft)]
    const found = bills.reduce<ValidationErrors>((all, bill) => ({ ...all, ...validateBill(bill) }), {})
    setErrors(found)
    if (hasErrors(found)) return

    onSave(bills)
    if (!editing) {
      // Дараагийн бичилтэд бэлдэж форомыг цэвэрлэнэ
      setDraft(emptyDraft(draft.kind, draft.period))
      setMeterRows([{ startReading: '', endReading: '', kvts: '1', unitPrice: '' }])
    }
  }

  function handleReset() {
    if (editing) {
      onCancelEdit()
    } else {
      setDraft(emptyDraft(draft.kind, draft.period))
      setMeterRows([{ startReading: '', endReading: '', kvts: '1', unitPrice: '' }])
      setErrors({})
    }
  }

  return (
    <form className="card bill-form" onSubmit={handleSubmit}>
      <div className="card__head">
        <h2 className="card__title">
          {editing ? 'Бичилт засах' : 'Шинэ зардал бүртгэх'}
        </h2>
        <p className="card__subtitle">
          Мөр бүрийн зардлыг оруулаад “Мөр нэмэх” товчоор олон мөр үүсгэнэ
        </p>
      </div>

      <div className="segmented" role="group" aria-label="Зардлын төрөл">
        {UTILITIES.map((utility) => (
          <button
            key={utility.kind}
            type="button"
            className={`segmented__item${
              draft.kind === utility.kind ? ' segmented__item--active' : ''
            }`}
            onClick={() => update('kind', utility.kind)}
          >
            <span aria-hidden="true">{utility.icon}</span> {utility.label}
          </button>
        ))}
      </div>

      <div className="form-grid">
        <Field label="Тайлант сар" htmlFor="period" required error={errors.period}>
          <input
            id="period"
            type="month"
            value={draft.period}
            onChange={(event) => update('period', event.target.value)}
          />
        </Field>

        <Field
          label="Нэр / Тайлбар"
          htmlFor="title"
          error={errors.title}
          hint="Заавал биш"
        >
          <input
            id="title"
            type="text"
            value={draft.title}
            placeholder={`${meta.label} нэхэмжлэл`}
            onChange={(event) => update('title', event.target.value)}
          />
        </Field>
      </div>

      <Field label="Тооцох арга" hint="Заалтгүй бол нэхэмжлэлийн нийт дүнг шууд оруулна">
        <div className="radio-row">
          {(Object.keys(METHOD_LABELS) as CalcMethod[]).map((method) => (
            <label
              key={method}
              className={`radio-chip${draft.method === method ? ' radio-chip--active' : ''}`}
            >
              <input
                type="radio"
                name="method"
                value={method}
                checked={draft.method === method}
                onChange={() => update('method', method)}
              />
              {METHOD_LABELS[method]}
            </label>
          ))}
        </div>
      </Field>

      {draft.method === 'meter' ? (
        <div className="meter-rows">
          {meterRows.map((row, index) => (
            <div className="meter-row" key={index}>
              <span className="meter-row__number">{index + 1}</span>
              <Field label="Эхний заалт" htmlFor={`startReading-${index}`} required error={errors.startReading} hint={meta.unit}>
                <input id={`startReading-${index}`} type="number" step="any" min="0" value={row.startReading} placeholder="0" onChange={(event) => updateMeterRow(index, 'startReading', event.target.value)} />
              </Field>
              <Field label="Сүүлийн заалт" htmlFor={`endReading-${index}`} required error={errors.endReading} hint={meta.unit}>
                <input id={`endReading-${index}`} type="number" step="any" min="0" value={row.endReading} placeholder="0" onChange={(event) => updateMeterRow(index, 'endReading', event.target.value)} />
              </Field>
              <Field label="Квц" htmlFor={`kvts-${index}`} required error={errors.kvts} hint="Коэффициент">
                <input id={`kvts-${index}`} type="number" step="any" min="0" value={row.kvts} placeholder="1" onChange={(event) => updateMeterRow(index, 'kvts', event.target.value)} />
              </Field>
              <Field label="Нэгж үнэ" htmlFor={`unitPrice-${index}`} required error={errors.unitPrice} hint={meta.priceLabel}>
                <input id={`unitPrice-${index}`} type="number" step="any" min="0" value={row.unitPrice} placeholder="0" onChange={(event) => updateMeterRow(index, 'unitPrice', event.target.value)} />
              </Field>
              {meterRows.length > 1 && <button type="button" className="icon-btn icon-btn--danger meter-row__remove" onClick={() => setMeterRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}>Устгах</button>}
            </div>
          ))}
          {!editing && <button type="button" className="btn btn--secondary" onClick={() => setMeterRows((prev) => [...prev, { startReading: '', endReading: '', kvts: '1', unitPrice: '' }])}>+ Мөр нэмэх</button>}
        </div>
      ) : (
        <Field
          label="Нэхэмжлэлийн нийт дүн"
          htmlFor="directAmount"
          required
          error={errors.directAmount}
          hint="НӨАТ орохоос өмнөх дүн (₮)"
        >
          <input
            id="directAmount"
            type="number"
            step="any"
            min="0"
            value={draft.directAmount}
            placeholder="0"
            onChange={(event) => update('directAmount', event.target.value)}
          />
        </Field>
      )}

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={draft.hasSurcharge}
          onChange={(event) => {
            const checked = event.target.checked
            setDraft((prev) => ({
              ...prev,
              hasSurcharge: checked,
              vatPercent:
                checked && prev.vatPercent === '' ? String(DEFAULT_VAT_PERCENT) : prev.vatPercent,
            }))
          }}
        />
        <span>НӨАТ / нэмэлт төлбөр тооцох</span>
      </label>

      {draft.hasSurcharge && (
        <div className="form-grid">
          <Field
            label="НӨАТ (%)"
            htmlFor="vatPercent"
            error={errors.vatPercent}
            hint="Үндсэн дүнгээс тооцно"
          >
            <input
              id="vatPercent"
              type="number"
              step="any"
              min="0"
              max="100"
              value={draft.vatPercent}
              placeholder="10"
              onChange={(event) => update('vatPercent', event.target.value)}
            />
          </Field>

          <Field
            label="Нэмэлт төлбөр (₮)"
            htmlFor="extraCharge"
            error={errors.extraCharge}
            hint="Тогтмол дүнтэй нэмэлт төлбөр"
          >
            <input
              id="extraCharge"
              type="number"
              step="any"
              min="0"
              value={draft.extraCharge}
              placeholder="0"
              onChange={(event) => update('extraCharge', event.target.value)}
            />
          </Field>
        </div>
      )}

      <Field label="Тэмдэглэл" htmlFor="note">
        <textarea
          id="note"
          rows={2}
          value={draft.note}
          placeholder="Нэмэлт тайлбар (заавал биш)"
          onChange={(event) => update('note', event.target.value)}
        />
      </Field>

      <div className="preview">
        <div className="preview__row">
          <span>Хэрэглээ</span>
          <strong>
            {preview.usage === null
              ? '—'
              : `${formatNumber(preview.usage)} ${meta.unit}`}
          </strong>
        </div>
        <div className="preview__row">
          <span>Үндсэн дүн</span>
          <strong>{formatMoney(preview.baseAmount)}</strong>
        </div>
        {draft.hasSurcharge && (
          <>
            <div className="preview__row">
              <span>НӨАТ</span>
              <strong>{formatMoney(preview.vatAmount)}</strong>
            </div>
            <div className="preview__row">
              <span>Нэмэлт төлбөр</span>
              <strong>{formatMoney(preview.extraAmount)}</strong>
            </div>
          </>
        )}
        <div className="preview__row preview__row--total">
          <span>Нийт дүн</span>
          <strong>{formatMoney(preview.totalAmount)}</strong>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn--primary">
          {editing ? 'Өөрчлөлт хадгалах' : 'Хадгалах'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={handleReset}>
          {editing ? 'Болих' : 'Талбар цэвэрлэх'}
        </button>
      </div>
    </form>
  )
}
