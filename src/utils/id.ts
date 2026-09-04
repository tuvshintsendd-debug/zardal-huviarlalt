/** Давхардахгүй ID үүсгэх (crypto.randomUUID байхгүй орчинд fallback-тай) */
export function createId(): string {
  const globalCrypto = globalThis.crypto as Crypto | undefined
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
