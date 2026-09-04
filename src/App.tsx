import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { UtilityBill, UtilityKind } from './types'
import { useBills } from './hooks/useBills'
import {
  summarizeByKind,
  totalAmountOf,
  withCalculations,
} from './services/calculation'
import {
  downloadTemplate,
  exportBillsToExcel,
  importBillsFromExcel,
} from './services/excel'
import { currentPeriod, formatPeriod } from './utils/format'
import { AppHeader } from './components/layout/AppHeader'
import { CostSidebar } from './components/layout/CostSidebar'
import { BillForm } from './components/bills/BillForm'
import { BillTable } from './components/bills/BillTable'
import { Toast, type ToastMessage } from './components/ui/Toast'
import { AllocationPage } from './components/allocation/AllocationPage'
import { AccountReconciliationModal } from './components/accountMapping/AccountReconciliationModal'
import { loadAllocationBases } from './services/allocation'

export default function App() {
  const { bills, updateBill, removeBill, addMany, replaceAll } = useBills()
  const allocationBases = loadAllocationBases()
  const [selectedPeriod, setSelectedPeriod] = useState('all')
  const [allocationPeriod, setAllocationPeriod] = useState<string | null>(null)
  const [allocationSessionPeriod, setAllocationSessionPeriod] = useState<string | null>(null)
  const [activeKind, setActiveKind] = useState<UtilityKind | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [isAccountReconciliationOpen, setIsAccountReconciliationOpen] = useState(false)
  const toastId = useRef(0)

  const notify = useCallback(
    (kind: ToastMessage['kind'], text: string, details?: string[]) => {
      toastId.current += 1
      setToast({ id: toastId.current, kind, text, details })
    },
    [],
  )

  /** Тайлант үеийн жагсаалт — шинэ сар эхэнд */
  const periods = useMemo(
    () => Array.from(new Set(bills.map((bill) => bill.period))).sort().reverse(),
    [bills],
  )

  /** Зөвхөн сараар шүүсэн — зүүн талын самбар үүн дээр тулгуурлана */
  const periodBills = useMemo(
    () =>
      selectedPeriod === 'all'
        ? bills
        : bills.filter((bill) => bill.period === selectedPeriod),
    [bills, selectedPeriod],
  )

  /** Сар + төрлөөр шүүсэн — хүснэгтэд харагдана */
  const visibleBills = useMemo(
    () =>
      activeKind ? periodBills.filter((bill) => bill.kind === activeKind) : periodBills,
    [periodBills, activeKind],
  )

  const summaries = useMemo(() => summarizeByKind(periodBills), [periodBills])
  const periodTotal = useMemo(() => totalAmountOf(periodBills), [periodBills])
  const tableRows = useMemo(
    () =>
      withCalculations(visibleBills).sort((a, b) =>
        a.period === b.period
          ? a.createdAt.localeCompare(b.createdAt)
          : b.period.localeCompare(a.period),
      ),
    [visibleBills],
  )

  const editing = useMemo(
    () => bills.find((bill) => bill.id === editingId) ?? null,
    [bills, editingId],
  )

  const allocationBills = useMemo(
    () => withCalculations(bills.filter((bill) =>
      bill.kind === 'electricity' && bill.period === (allocationPeriod ?? allocationSessionPeriod),
    )),
    [bills, allocationPeriod, allocationSessionPeriod],
  )

  useEffect(() => {
    function handleHistoryBack() {
      setAllocationPeriod(null)
    }

    window.addEventListener('popstate', handleHistoryBack)
    return () => window.removeEventListener('popstate', handleHistoryBack)
  }, [])

  const openAllocation = useCallback((period: string) => {
    setAllocationSessionPeriod(period)
    setAllocationPeriod(period)
    window.history.pushState({ allocationPeriod: period }, '', window.location.href)
  }, [])

  const closeAllocation = useCallback(() => {
    if (window.history.state?.allocationPeriod) {
      window.history.back()
      return
    }
    setAllocationPeriod(null)
  }, [])

  const handleSave = useCallback(
    (savedBills: UtilityBill[]) => {
      if (editingId) {
        updateBill(savedBills[0])
        setEditingId(null)
        notify('success', 'Бичилт шинэчлэгдлээ')
      } else {
        addMany(savedBills)
        notify('success', `${savedBills.length} мөр хадгалагдлаа`)
      }
    },
    [addMany, editingId, notify, updateBill],
  )

  const handleRemove = useCallback(
    (id: string) => {
      const target = bills.find((bill) => bill.id === id)
      if (!target) return
      if (!window.confirm(`"${target.title}" бичилтийг устгах уу?`)) return
      removeBill(id)
      if (editingId === id) setEditingId(null)
      notify('info', 'Бичилт устлаа')
    },
    [bills, editingId, notify, removeBill],
  )

  const handleImport = useCallback(
    async (file: File) => {
      try {
        const result = await importBillsFromExcel(file)
        if (result.bills.length > 0) {
          addMany(result.bills)
          notify(
            result.errors.length > 0 ? 'info' : 'success',
            `${result.bills.length} мөр импортлогдлоо${
              result.skipped > 0 ? ` · ${result.skipped} мөр алгаслаа` : ''
            }`,
            result.errors,
          )
        } else {
          notify('error', 'Импорт амжилтгүй', result.errors)
        }
      } catch (error) {
        console.error(error)
        notify('error', 'Файлыг унших боломжгүй байна. xlsx файл эсэхийг шалгана уу.')
      }
    },
    [addMany, notify],
  )

  const handleExport = useCallback(async () => {
    if (visibleBills.length === 0) {
      notify('error', 'Татах өгөгдөл алга')
      return
    }
    const suffix = selectedPeriod === 'all' ? 'bugd' : selectedPeriod
    await exportBillsToExcel(visibleBills, `ashiglaltiin-zardal-${suffix}.xlsx`)
    notify('success', 'Excel файл татагдлаа')
  }, [notify, selectedPeriod, visibleBills])

  const handleTemplate = useCallback(async () => {
    await downloadTemplate()
    notify('success', 'Загвар файл татагдлаа')
  }, [notify])

  const handleClearAll = useCallback(() => {
    if (!window.confirm('Бүртгэсэн бүх зардлыг устгах уу? Энэ үйлдлийг буцаах боломжгүй.')) {
      return
    }
    replaceAll([])
    setEditingId(null)
    notify('info', 'Бүх өгөгдөл цэвэрлэгдлээ')
  }, [notify, replaceAll])

  return (
    <div className="app">
      <AppHeader
        periods={periods}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        onImportFile={handleImport}
        onExport={handleExport}
        onDownloadTemplate={handleTemplate}
        onClearAll={handleClearAll}
        onOpenAccountMapping={() => setIsAccountReconciliationOpen(true)}
        canExport={bills.length > 0}
      />

      {isAccountReconciliationOpen && (
        <AccountReconciliationModal onClose={() => setIsAccountReconciliationOpen(false)} />
      )}

      {allocationSessionPeriod && (
        <div className={allocationPeriod ? '' : 'allocation-page--hidden'}>
          <AllocationPage
            period={allocationSessionPeriod}
            bills={allocationBills}
            bases={allocationBases}
            onBack={closeAllocation}
          />
        </div>
      )}
      {!allocationPeriod && <div className="app__body">
        <CostSidebar
          summaries={summaries}
          totalAmount={periodTotal}
          billCount={periodBills.length}
          activeKind={activeKind}
          periodLabel={
            selectedPeriod === 'all' ? 'Бүх тайлант үе' : formatPeriod(selectedPeriod)
          }
          onSelectKind={setActiveKind}
        />

        <main className="app__main">
          <BillForm
            editing={editing}
            defaultKind={activeKind ?? 'electricity'}
            defaultPeriod={selectedPeriod === 'all' ? currentPeriod() : selectedPeriod}
            onSave={handleSave}
            onCancelEdit={() => setEditingId(null)}
          />

          <BillTable
            bills={tableRows}
            editingId={editingId}
            onEdit={setEditingId}
            onRemove={handleRemove}
            onAllocate={openAllocation}
          />
        </main>
      </div>
      }

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
