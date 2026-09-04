/**
 * Ашиглалтын зардлын үндсэн төрлүүд.
 * 1-р үе шат: зөвхөн нэхэмжлэлийн зардлыг тооцох (хуваарилалт хараахан ороогүй).
 */

/** Ашиглалтын зардлын төрөл */
export type UtilityKind = 'electricity' | 'heat' | 'water'

/** Зардлыг тооцох арга */
export type CalcMethod =
  /** Тоолуурын эхний/сүүлийн заалт × нэгж үнэ */
  | 'meter'
  /** Нэхэмжлэлийн нийт дүнг шууд оруулах */
  | 'direct'

/** Нэг сарын нэг нэхэмжлэл (нэг зардлын бичилт) */
export interface UtilityBill {
  id: string
  kind: UtilityKind
  /** Тайлант үе — 'YYYY-MM' формат */
  period: string
  /** Сарын нэр / чөлөөт тайлбар (жишээ нь: "8-р сар, Гален цех") */
  title: string
  method: CalcMethod

  /** method === 'meter' үед хэрэглэгдэнэ */
  startReading: number
  endReading: number
  /** Заалтын зөрүүг хэрэглээнд хөрвүүлэх коэффициент */
  kvts: number
  unitPrice: number

  /** method === 'direct' үед хэрэглэгдэнэ */
  directAmount: number

  /** НӨАТ / нэмэлт төлбөр оруулах эсэх (сонголтоор) */
  hasSurcharge: boolean
  /** НӨАТ-ын хувь, жишээ нь 10 */
  vatPercent: number
  /** Тогтмол дүнтэй нэмэлт төлбөр (₮) */
  extraCharge: number

  note: string
  createdAt: string
  updatedAt: string
}

/** Нэг бичилтийн тооцооллын үр дүн */
export interface BillCalculation {
  /** Тоолуурын хэрэглээ. Шууд дүнгээр тооцсон үед null */
  usage: number | null
  /** НӨАТ/нэмэлт төлбөр орохоос өмнөх дүн */
  baseAmount: number
  /** НӨАТ-ын дүн */
  vatAmount: number
  /** Нэмэлт төлбөрийн дүн */
  extraAmount: number
  /** НӨАТ + нэмэлт төлбөр */
  surchargeAmount: number
  /** Нийт төлбөл зохих дүн */
  totalAmount: number
}

/** Бичилт + тооцоолол хамтдаа (хүснэгт, экспортод ашиглана) */
export interface BillWithCalc extends UtilityBill {
  calc: BillCalculation
}

/** Төрөл тус бүрийн нийлбэр (зүүн талын самбарт) */
export interface KindSummary {
  kind: UtilityKind
  count: number
  usage: number
  totalAmount: number
}

/** Форм дээрх талбар бүрийн алдааны мессеж */
export type ValidationErrors = Partial<Record<keyof UtilityBill, string>>

/** Excel импортын үр дүн */
export interface ImportResult {
  bills: UtilityBill[]
  /** Мөр бүрийн алдаа: "3-р мөр: Төрөл танигдсангүй" гэх мэт */
  errors: string[]
  skipped: number
}

/** 1.2 Бүтээгдэхүүний мэдээлэл: импорт/удирдлагын нэг мөр */
export interface ProductInfoModel {
  id: string
  ErpCode: string
  ProductName: string
  Unit: string
  MachineHours: number
  BatchTheoreticalQty: number
  FactoryName: string
}

/** "Дансны харгалзаа" цонхны динамикаар нэмэгдэх нэмэлт багана */
export interface AccountReconciliationColumn {
  id: string
  header: string
}

/** Ашиглалтын зардлын нэг төрлийн ERP данс (код + нэр) */
export interface ErpAccountRef {
  erpCode: string
  erpName: string
}

/** "Дансны харгалзаа" DataGrid-ийн нэг мөр — хавсралтын эксэлтэй ижил баганууд */
export interface AccountReconciliationRow {
  id: string
  orgUnitName: string
  analysisAccount: string
  electricity: ErpAccountRef
  heat: ErpAccountRef
  water: ErpAccountRef
  /** Динамикаар нэмэгдсэн баганын утгууд, түлхүүр нь AccountReconciliationColumn.id */
  extra: Record<string, string>
}
