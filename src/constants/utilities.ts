import type { CalcMethod, UtilityKind } from '../types'

export interface UtilityMeta {
  kind: UtilityKind
  /** Монгол нэр */
  label: string
  /** Хэмжих нэгж (тоолуурын заалт) */
  unit: string
  /** Нэгж үнийн тайлбар */
  priceLabel: string
  icon: string
  /** CSS хувьсагчид ашиглах өнгө */
  color: string
}

export const UTILITIES: UtilityMeta[] = [
  {
    kind: 'electricity',
    label: 'Цахилгаан',
    unit: 'кВт·ц',
    priceLabel: '₮ / кВт·ц',
    icon: '⚡',
    color: '#f59e0b',
  },
  {
    kind: 'heat',
    label: 'Дулаан',
    unit: 'Гкал',
    priceLabel: '₮ / Гкал',
    icon: '🔥',
    color: '#ef4444',
  },
  {
    kind: 'water',
    label: 'Ус',
    unit: 'м³',
    priceLabel: '₮ / м³',
    icon: '💧',
    color: '#0ea5e9',
  },
]

export const UTILITY_MAP: Record<UtilityKind, UtilityMeta> = UTILITIES.reduce(
  (acc, meta) => {
    acc[meta.kind] = meta
    return acc
  },
  {} as Record<UtilityKind, UtilityMeta>,
)

export const UTILITY_KINDS: UtilityKind[] = UTILITIES.map((u) => u.kind)

export const METHOD_LABELS: Record<CalcMethod, string> = {
  meter: 'Заалтаар тооцох',
  direct: 'Нийт дүнгээр оруулах',
}

/** Excel-ээс импортлохдоо монгол нэрийг төрөл рүү буулгах хүснэгт */
export const KIND_BY_LABEL: Record<string, UtilityKind> = {
  цахилгаан: 'electricity',
  electricity: 'electricity',
  дулаан: 'heat',
  heat: 'heat',
  ус: 'water',
  water: 'water',
}

export const METHOD_BY_LABEL: Record<string, CalcMethod> = {
  'заалтаар тооцох': 'meter',
  заалтаар: 'meter',
  meter: 'meter',
  'нийт дүнгээр оруулах': 'direct',
  'шууд дүнгээр': 'direct',
  'нийт дүнгээр': 'direct',
  direct: 'direct',
}

export const MONTH_NAMES = [
  '1-р сар',
  '2-р сар',
  '3-р сар',
  '4-р сар',
  '5-р сар',
  '6-р сар',
  '7-р сар',
  '8-р сар',
  '9-р сар',
  '10-р сар',
  '11-р сар',
  '12-р сар',
]

/** Монголд НӨАТ-ын үндсэн хувь */
export const DEFAULT_VAT_PERCENT = 10
