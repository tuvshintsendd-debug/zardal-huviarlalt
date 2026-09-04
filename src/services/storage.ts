import type { UtilityBill } from '../types'
import { normalizeBill } from './calculation'

const STORAGE_KEY = 'azh.bills.v1'

interface StoragePayload {
  version: 1
  savedAt: string
  bills: UtilityBill[]
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

/** LocalStorage-оос бүх бичилтийг унших. Алдаатай бол хоосон массив. */
export function loadBills(): UtilityBill[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoragePayload | UtilityBill[]
    const list = Array.isArray(parsed) ? parsed : parsed.bills
    if (!Array.isArray(list)) return []
    return list.map((item) => normalizeBill(item))
  } catch (error) {
    console.error('Хадгалсан өгөгдлийг унших үед алдаа гарлаа:', error)
    return []
  }
}

/** Бүх бичилтийг LocalStorage-д бичих */
export function saveBills(bills: UtilityBill[]): void {
  if (!isBrowser()) return
  try {
    const payload: StoragePayload = {
      version: 1,
      savedAt: new Date().toISOString(),
      bills,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (error) {
    console.error('Өгөгдөл хадгалах үед алдаа гарлаа:', error)
  }
}

/** Бүх өгөгдлийг устгах */
export function clearBills(): void {
  if (!isBrowser()) return
  window.localStorage.removeItem(STORAGE_KEY)
}
