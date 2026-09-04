(() => {
  const data = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key.startsWith('zardal.') || key.startsWith('azh.')) data[key] = localStorage.getItem(key)
  }
  const keys = Object.keys(data)
  if (keys.length === 0) {
    console.warn('Хадгалсан өгөгдөл олдсонгүй.')
    return
  }
  console.log(`${keys.length} түлхүүр:`, keys)
  const json = JSON.stringify({ exportedAt: new Date().toISOString(), origin: location.origin, data }, null, 2)
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  link.download = `zardal-backup-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  console.log('Татагдлаа.')
})()
