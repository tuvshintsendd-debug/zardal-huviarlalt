import type {
  AccountReconciliationColumn,
  AccountReconciliationRow,
  ErpAccountRef,
} from '../types'
import { createId } from '../utils/id'

const STORAGE_KEY = 'azh.accountReconciliation.v2'

export interface AccountReconciliationState {
  rows: AccountReconciliationRow[]
  extraColumns: AccountReconciliationColumn[]
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

function erp(erpCode: string, erpName: string): ErpAccountRef {
  return { erpCode, erpName }
}

/** Хавсралтаар өгсөн "Дансны харгалзаа" эксэл файлын анхны өгөгдөл */
const DEFAULT_ROWS: AccountReconciliationRow[] = [
  {
    id: 'htuu-uildver',
    orgUnitName: 'ХТЭҮйлдвэр',
    analysisAccount: '[00201] Түр данс Шахмал',
    electricity: erp('14051101', 'ДУ-НЗ-Цахилгааны зардал'),
    heat: erp('14051102', 'ДУ-НЗ-Дулааны зардал'),
    water: erp('14051103', 'ДУ-НЗ-Цэвэр бохир усны зардал'),
    extra: {},
  },
  {
    id: 'galen-uildver',
    orgUnitName: 'Гален үйлдвэр',
    analysisAccount: '[00101] Түр данс Гален',
    electricity: erp('14051101', 'ДУ-НЗ-Цахилгааны зардал'),
    heat: erp('14051102', 'ДУ-НЗ-Дулааны зардал'),
    water: erp('14051103', 'ДУ-НЗ-Цэвэр бохир усны зардал'),
    extra: {},
  },
  {
    id: 'shingen-uildver',
    orgUnitName: 'Шингэн үйлдвэр',
    analysisAccount: '[00902] Түр данс Шингэн',
    electricity: erp('14051101', 'ДУ-НЗ-Цахилгааны зардал'),
    heat: erp('14051102', 'ДУ-НЗ-Дулааны зардал'),
    water: erp('14051103', 'ДУ-НЗ-Цэвэр бохир усны зардал'),
    extra: {},
  },
  {
    id: 'sankhuu-burtgel',
    orgUnitName: 'Санхүү бүртгэл',
    analysisAccount: '[101] Санхүү алба',
    electricity: erp('70001101', 'Цахилгааны зардал'),
    heat: erp('70001102', 'Дулааны зардал'),
    water: erp('70001103', 'Цэвэр бохир усны зардал'),
    extra: {},
  },
  {
    id: 'injener-tekhnikiin-alba',
    orgUnitName: 'Инженер техникийн алба',
    analysisAccount: '[104] Инженер, техникийн алба',
    electricity: erp('14051101', 'ДУ-НЗ-Цахилгааны зардал'),
    heat: erp('14051102', 'ДУ-НЗ-Дулааны зардал'),
    water: erp('14051103', 'ДУ-НЗ-Цэвэр бохир усны зардал'),
    extra: {},
  },
  {
    id: 'chanariin-batalgaajiltiin-alba',
    orgUnitName: 'Чанарын баталгаажилтын алба',
    analysisAccount: '[102] Чанарын баталгаажилтын алба',
    electricity: erp('14051101', 'ДУ-НЗ-Цахилгааны зардал'),
    heat: erp('14051102', 'ДУ-НЗ-Дулааны зардал'),
    water: erp('14051103', 'ДУ-НЗ-Цэвэр бохир усны зардал'),
    extra: {},
  },
  {
    id: 'borluulalt-tugeelt',
    orgUnitName: 'Борлуулалт-Түгээлт',
    analysisAccount: '[303] МБГ Түгээлт',
    electricity: erp('71041101', 'Цахилгааны зардал'),
    heat: erp('71041102', 'Дулааны зардал'),
    water: erp('71041103', 'Цэвэр бохир усны зардал'),
    extra: {},
  },
]

/** Шинэ хоосон мөр (ViewModel-ийн AddRow-той адил) */
export function createAccountReconciliationRow(): AccountReconciliationRow {
  return {
    id: createId(),
    orgUnitName: '',
    analysisAccount: '',
    electricity: erp('', ''),
    heat: erp('', ''),
    water: erp('', ''),
    extra: {},
  }
}

/** LocalStorage-оос "Дансны харгалзаа" мэдээллийг ачаалах (LoadData). Хоосон бол хавсралтын анхны утгыг буцаана. */
export function loadAccountReconciliation(): AccountReconciliationState {
  const defaultState: AccountReconciliationState = { rows: DEFAULT_ROWS, extraColumns: [] }
  if (!isBrowser()) return defaultState
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState
    const parsed = JSON.parse(raw) as AccountReconciliationState
    if (
      !Array.isArray(parsed.rows) ||
      !Array.isArray(parsed.extraColumns) ||
      parsed.rows.some((row) => !row.electricity || !row.heat || !row.water)
    ) {
      return defaultState
    }
    return parsed
  } catch (error) {
    console.error('Дансны харгалзаа унших үед алдаа гарлаа:', error)
    return defaultState
  }
}

/** "Дансны харгалзаа" мэдээллийг хадгалах (Save Command) */
export function saveAccountReconciliation(state: AccountReconciliationState): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.error('Дансны харгалзаа хадгалах үед алдаа гарлаа:', error)
  }
}

/** Мөр бүрийн заавал талбарыг шалгах. Алдаатай бол шалтгааныг буцаана. */
export function validateAccountReconciliation(rows: AccountReconciliationRow[]): string | null {
  const missingIndex = rows.findIndex((row) => row.orgUnitName.trim() === '')
  if (missingIndex !== -1) {
    return `${missingIndex + 1}-р мөрийн "Алба нэгжийн нэр" талбарыг бөглөнө үү`
  }
  return null
}

