(() => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    let parsed
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      console.error('JSON уншиж чадсангүй.')
      return
    }
    const data = parsed?.data ?? parsed
    const keys = Object.keys(data ?? {}).filter((k) => k.startsWith('zardal.') || k.startsWith('azh.'))
    if (keys.length === 0) {
      console.error('Зөөх түлхүүр олдсонгүй.')
      return
    }
    const existing = keys.filter((k) => localStorage.getItem(k) !== null)
    if (existing.length > 0 && !confirm(`${existing.length} түлхүүр энэ хаяг дээр аль хэдийн байна. Дарж бичих үү?\n\n${existing.join('\n')}`)) {
      console.log('Цуцлагдлаа. Юу ч өөрчлөгдөөгүй.')
      return
    }
    keys.forEach((k) => localStorage.setItem(k, data[k]))
    console.log(`${keys.length} түлхүүр зөөгдлөө. Дахин ачаалж байна...`)
    location.reload()
  }
  input.click()
})()
