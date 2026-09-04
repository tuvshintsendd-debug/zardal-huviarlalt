import { useCallback, useEffect, useRef, useState } from 'react'
import type { UtilityBill } from '../types'
import { loadBills, saveBills } from '../services/storage'

/**
 * Бичилтүүдийг LocalStorage-той синк байлгах hook.
 * Аливаа өөрчлөлт автоматаар хадгалагдана.
 */
export function useBills() {
  const [bills, setBills] = useState<UtilityBill[]>(() => loadBills())
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Анхны ачаалалт дээр дахин бичих шаардлагагүй
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    saveBills(bills)
  }, [bills])

  const addBill = useCallback((bill: UtilityBill) => {
    setBills((prev) => [...prev, bill])
  }, [])

  const updateBill = useCallback((bill: UtilityBill) => {
    setBills((prev) =>
      prev.map((item) =>
        item.id === bill.id ? { ...bill, updatedAt: new Date().toISOString() } : item,
      ),
    )
  }, [])

  const removeBill = useCallback((id: string) => {
    setBills((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const addMany = useCallback((incoming: UtilityBill[]) => {
    setBills((prev) => [...prev, ...incoming])
  }, [])

  const replaceAll = useCallback((incoming: UtilityBill[]) => {
    setBills(incoming)
  }, [])

  return { bills, addBill, updateBill, removeBill, addMany, replaceAll }
}
