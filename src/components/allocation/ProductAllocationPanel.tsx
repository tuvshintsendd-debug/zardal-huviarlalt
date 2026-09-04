import { useEffect, useMemo, useRef, useState } from 'react'
import type { AllocationBasis } from '../../services/allocation'
import type { Department } from '../../services/departmentAllocation'
import { allocateProducts, createEmptyProduct, importProductsFromExcel, loadProducts, saveProducts, type Product } from '../../services/productAllocation'
import type { BillWithCalc } from '../../types'
import { formatMoney, formatNumber } from '../../utils/format'

interface ProductAllocationPanelProps {
  bills: BillWithCalc[]
  bases: AllocationBasis[]
  departments: Department[]
}

export function ProductAllocationPanel({ bills, bases, departments }: ProductAllocationPanelProps) {
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = loadProducts()
    return saved.length > 0 ? saved : [createEmptyProduct(bases, departments[0]?.id ?? '')]
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeBases = useMemo(() => bases.filter((basis) => basis.active), [bases])
  const selectedBasisNames = activeBases.map((basis) => basis.name).join(' · ')
  const results = useMemo(() => allocateProducts(bills, departments, products, bases), [bills, departments, products, bases])

  useEffect(() => saveProducts(products), [products])

  function updateProduct(id: string, changes: Partial<Product>) {
    setProducts((current) => current.map((product) => product.id === id ? { ...product, ...changes } : product))
  }

  function updateValue(id: string, basisId: string, value: string) {
    updateProduct(id, { values: { ...products.find((product) => product.id === id)?.values, [basisId]: Number(value) || 0 } })
  }

  async function handleImport(file: File) {
    const imported = await importProductsFromExcel(file, departments, bases)
    if (imported.length > 0) setProducts((current) => [...current.filter((product) => product.name || product.code), ...imported])
  }

  return (
    <section className="card product-allocation">
      <div className="card__head card__head--row">
        <div>
          <span className="step-label">4-р алхам</span>
          <h2 className="card__title">Цахилгааны зардлыг бүтээгдэхүүнд дахин хуваарилах</h2>
          <p className="card__subtitle">Цех бүрийн бүтээгдэхүүний суурийн утгыг оруулна уу</p>
          {activeBases.length > 0 && <p className="product-basis-summary">Сонгосон суурь: {selectedBasisNames}</p>}
        </div>
      </div>

      {departments.length === 0 ? (
        <div className="allocation-warning" role="alert">Эхлээд 3-р алхамд цех/алба нэмнэ үү.</div>
      ) : activeBases.length === 0 ? (
        <div className="allocation-warning" role="alert">Эхлээд идэвхтэй хуваарилалтын суурь тохируулна уу.</div>
      ) : (
        <>
          <div className="department-table-wrap">
            <table className="table department-table product-input-table">
              <thead>
                <tr>
                  <th>Цех/алба</th><th>Бүтээгдэхүүний нэр</th><th>Код</th>
                  {activeBases.map((basis) => <th className="num" key={basis.id}>{basis.name}</th>)}
                  <th aria-label="Үйлдэл" />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td><select className="department-input department-input--name" value={product.departmentId} onChange={(event) => updateProduct(product.id, { departmentId: event.target.value })}>{departments.map((department) => <option key={department.id} value={department.id}>{department.name || 'Нэргүй цех/алба'}</option>)}</select></td>
                    <td><input className="department-input department-input--name" value={product.name} placeholder="Бүтээгдэхүүн" onChange={(event) => updateProduct(product.id, { name: event.target.value })} /></td>
                    <td><input className="department-input" value={product.code} placeholder="Код" onChange={(event) => updateProduct(product.id, { code: event.target.value })} /></td>
                    {activeBases.map((basis) => <td key={basis.id}><input className="department-input" type="number" min="0" value={basis.name === 'Бүтээгдэхүүний үйлдвэрлэсэн тоо' ? product.quantity : (product.values[basis.id] ?? 0)} onChange={(event) => basis.name === 'Бүтээгдэхүүний үйлдвэрлэсэн тоо' ? updateProduct(product.id, { quantity: Number(event.target.value) || 0 }) : updateValue(product.id, basis.id, event.target.value)} /></td>)}
                    <td>{products.length > 1 && <button type="button" className="icon-btn icon-btn--danger" onClick={() => setProducts((current) => current.filter((item) => item.id !== product.id))}>Устгах</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn--secondary" onClick={() => setProducts((current) => [...current, createEmptyProduct(bases, departments[0]?.id ?? '')])}>+ Бүтээгдэхүүн нэмэх</button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImport(file); event.target.value = '' }} />
          <button type="button" className="btn btn--secondary" onClick={() => fileInputRef.current?.click()}>Excel-ээс оруулах</button>

          <div className="department-table-wrap product-results">
            <table className="table department-table">
              <thead><tr><th>Бүтээгдэхүүний нэр</th><th>Код</th><th>Харьяалах цех/алба</th><th className="num">Үйлдвэрлэсэн тоо</th><th className="num">Ногдсон цахилгааны зардал</th><th className="num">Нийт ногдсон цахилгааны зардал</th><th className="num">Нэгж бүтээгдэхүүнд ногдох цахилгааны зардал</th></tr></thead>
              <tbody>{results.map((product) => <tr key={product.id}><td>{product.name || 'Нэргүй бүтээгдэхүүн'}</td><td>{product.code || '-'}</td><td>{departments.find((department) => department.id === product.departmentId)?.name || 'Нэргүй цех/алба'}</td><td className="num">{formatNumber(product.quantity)}</td><td className="num">{formatMoney(product.electricity)}</td><td className="num num--strong">{formatMoney(product.electricity)}</td><td className="num">{formatMoney(product.quantity > 0 ? product.electricity / product.quantity : 0)}</td></tr>)}</tbody>
              <tfoot><tr><td colSpan={5}>Нийт</td><td className="num num--strong">{formatMoney(results.reduce((sum, product) => sum + product.electricity, 0))}</td><td /></tr></tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
