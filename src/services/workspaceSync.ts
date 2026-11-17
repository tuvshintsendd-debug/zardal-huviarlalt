/**
 * Хуваалцах давхарга.
 *
 * Апп бүх төлвөө LocalStorage-д бичдэг тул 48 газрыг өөрчлөхийн оронд бүх
 * `zardal.*` / `azh.*` түлхүүрийг нэг JSON болгож серверт хадгална —
 * tools/localstorage-export.js-ийн ашигладагтай яг ижил формат. Ингэснээр
 * сар/үйлдвэрээр динамикаар үүсдэг түлхүүрүүд ч автоматаар хамрагдана.
 */

const SYNCED_PREFIXES = ['zardal.', 'azh.']

/** Хуваалцсан өгөгдөл ачаалахын өмнөх локал өгөгдлийн нөөц. Өөрөө sync хийгдэхгүй. */
export const LOCAL_BACKUP_KEY = 'zardal-backup:last-local'
const AUTH_MIGRATION_KEY = 'azh.auth-migration.v1'

const SAVE_DEBOUNCE_MS = 1200

export type SyncStatus =
  | { kind: 'local' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: string }
  | { kind: 'error'; message: string }
  | { kind: 'conflict' }

export interface WorkspaceConfig {
  sharingEnabled: boolean
  authEnabled: boolean
  emailEnabled: boolean
  authenticated: boolean
  reason: string | null
  user: AuthUser | null
  companies: CompanyOption[]
}

export interface AuthUser {
  email: string
  companyId: string
  companyName?: string
  mustChangePassword: boolean
}

export interface CompanyOption {
  id: string
  name: string
}

function isSyncedKey(key: string): boolean {
  return SYNCED_PREFIXES.some((prefix) => key.startsWith(prefix))
}

/** URL-аас хуваалцсан өгөгдлийн id — /w/<id> */
export function workspaceIdFromPath(pathname: string = window.location.pathname): string | null {
  const match = pathname.match(/^\/w\/([a-z0-9]+)\/?$/i)
  return match ? match[1] : null
}

export function snapshotLocal(): Record<string, string> {
  const data: Record<string, string> = {}
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key && isSyncedKey(key)) data[key] = window.localStorage.getItem(key) ?? ''
  }
  return data
}

export function hasLocalData(): boolean {
  return Object.keys(snapshotLocal()).length > 0
}

function clearSyncedKeys(): void {
  const keys: string[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key && isSyncedKey(key)) keys.push(key)
  }
  keys.forEach((key) => window.localStorage.removeItem(key))
}

/**
 * Серверийн өгөгдлийг LocalStorage руу буулгана. Өмнө нь локал өгөгдөл
 * байсан бол дарж бичихийн өмнө нөөцөлнө — өөр хүний линк нээхэд өөрийн
 * ажил чимээгүй устахаас сэргийлнэ.
 */
function hydrate(data: Record<string, string>): { backedUp: boolean } {
  const existing = snapshotLocal()
  const hadLocal = Object.keys(existing).length > 0
  const isSame = JSON.stringify(existing) === JSON.stringify(data)

  if (hadLocal && !isSame) {
    window.localStorage.setItem(
      LOCAL_BACKUP_KEY,
      JSON.stringify({ backedUpAt: new Date().toISOString(), data: existing }),
    )
  }

  clearSyncedKeys()
  Object.entries(data).forEach(([key, value]) => {
    window.localStorage.setItem(key, value)
  })

  return { backedUp: hadLocal && !isSame }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error ?? `Хүсэлт амжилтгүй (${response.status})`) as Error & {
      status?: number
    }
    error.status = response.status
    throw error
  }
  return payload as T
}

export function fetchConfig(): Promise<WorkspaceConfig> {
  return api<WorkspaceConfig>('/api/config')
}

export function login(companyId: string, email: string, password: string): Promise<{ ok: true }> {
  return api<{ ok: true }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ companyId, email, password }),
  })
}

export function register(companyId: string, email: string): Promise<{ ok: true; message: string }> {
  return api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ companyId, email }),
  })
}

export function requestPasswordReset(companyId: string, email: string): Promise<{ ok: true; message: string }> {
  return api('/api/auth/forgot', {
    method: 'POST',
    body: JSON.stringify({ companyId, email }),
  })
}

export function resetPassword(token: string, password: string): Promise<{ ok: true }> {
  return api('/api/auth/reset', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })
}

export function setFirstPassword(password: string): Promise<{ ok: true }> {
  return api('/api/auth/first-password', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export function logout(): Promise<{ ok: true }> {
  return api<{ ok: true }>('/api/auth/logout', { method: 'POST' })
}

/** Load tenant data before rendering, then persist subsequent localStorage writes. */
export async function loadCompanyData(): Promise<void> {
  const result = await api<{ data: Record<string, string> }>('/api/company-data')
  hydrate(result.data)
  watchCompanyData()
}

let companySaveTimer: ReturnType<typeof setTimeout> | null = null
let companyDataWatching = false
let originalCompanySetItem: Storage['setItem'] | null = null
let originalCompanyRemoveItem: Storage['removeItem'] | null = null

export function clearCompanyDataCache(): void {
  if (companySaveTimer) clearTimeout(companySaveTimer)
  companySaveTimer = null
  if (originalCompanySetItem && originalCompanyRemoveItem) {
    window.localStorage.setItem = originalCompanySetItem
    window.localStorage.removeItem = originalCompanyRemoveItem
  }
  originalCompanySetItem = null
  originalCompanyRemoveItem = null
  companyDataWatching = false
  if (!window.localStorage.getItem(AUTH_MIGRATION_KEY)) {
    const previousData = snapshotLocal()
    if (Object.keys(previousData).length > 0 && !window.localStorage.getItem(LOCAL_BACKUP_KEY)) {
      window.localStorage.setItem(
        LOCAL_BACKUP_KEY,
        JSON.stringify({ backedUpAt: new Date().toISOString(), data: previousData }),
      )
    }
    window.localStorage.setItem(AUTH_MIGRATION_KEY, 'complete')
  }
  clearSyncedKeys()
}

function watchCompanyData(): void {
  if (companyDataWatching) return
  companyDataWatching = true
  const storage = window.localStorage
  const originalSetItem = storage.setItem.bind(storage)
  const originalRemoveItem = storage.removeItem.bind(storage)
  originalCompanySetItem = originalSetItem
  originalCompanyRemoveItem = originalRemoveItem
  const save = () => {
    if (companySaveTimer) clearTimeout(companySaveTimer)
    companySaveTimer = setTimeout(() => {
      companySaveTimer = null
      void api('/api/company-data', {
        method: 'PUT',
        body: JSON.stringify({ data: snapshotLocal() }),
      }).catch((error) => console.error('Компанийн өгөгдөл серверт хадгалж чадсангүй:', error))
    }, SAVE_DEBOUNCE_MS)
  }
  storage.setItem = (key: string, value: string) => {
    originalSetItem(key, value)
    if (isSyncedKey(key)) save()
  }
  storage.removeItem = (key: string) => {
    originalRemoveItem(key)
    if (isSyncedKey(key)) save()
  }
  window.addEventListener('pagehide', () => {
    if (!companySaveTimer) return
    clearTimeout(companySaveTimer)
    companySaveTimer = null
    void fetch('/api/company-data', {
      method: 'PUT',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: snapshotLocal() }),
    })
  })
}

class WorkspaceSync {
  id: string | null = null
  private baseUpdatedAt: string | null = null
  private status: SyncStatus = { kind: 'local' }
  private listeners = new Set<(status: SyncStatus) => void>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private isWatching = false

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener)
    listener(this.status)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getStatus(): SyncStatus {
    return this.status
  }

  private setStatus(status: SyncStatus): void {
    this.status = status
    this.listeners.forEach((listener) => listener(status))
  }

  /** Серверээс татаж LocalStorage-д буулгана. React render-ээс ӨМНӨ дуудагдана. */
  async load(id: string): Promise<{ backedUp: boolean }> {
    const workspace = await api<{ data: Record<string, string>; updatedAt: string }>(
      `/api/workspaces/${encodeURIComponent(id)}`,
    )
    const result = hydrate(workspace.data)
    this.id = id
    this.baseUpdatedAt = workspace.updatedAt
    this.setStatus({ kind: 'saved', at: workspace.updatedAt })
    this.watch()
    return result
  }

  /** Одоогийн локал өгөгдлөөс шинэ хуваалцах линк үүсгэнэ. */
  async create(): Promise<string> {
    const created = await api<{ id: string; updatedAt: string }>('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify({ data: snapshotLocal() }),
    })
    this.id = created.id
    this.baseUpdatedAt = created.updatedAt
    this.setStatus({ kind: 'saved', at: created.updatedAt })
    this.watch()
    return created.id
  }

  /** LocalStorage-ийн бичилт бүрийг чагнаж, түр хүлээгээд серверт илгээнэ. */
  private watch(): void {
    if (this.isWatching) return
    this.isWatching = true

    const storage = window.localStorage
    const originalSetItem = storage.setItem.bind(storage)
    const originalRemoveItem = storage.removeItem.bind(storage)

    storage.setItem = (key: string, value: string) => {
      originalSetItem(key, value)
      if (isSyncedKey(key)) this.scheduleSave()
    }
    storage.removeItem = (key: string) => {
      originalRemoveItem(key)
      if (isSyncedKey(key)) this.scheduleSave()
    }

    // Таб хаах / нуух үед хүлээж байгаа өөрчлөлтийг алдахгүйн тулд шууд илгээнэ.
    window.addEventListener('pagehide', () => {
      void this.flush()
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.flush()
    })
  }

  private scheduleSave(): void {
    if (!this.id || this.status.kind === 'conflict') return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.save(), SAVE_DEBOUNCE_MS)
  }

  private async flush(): Promise<void> {
    if (!this.timer) return
    clearTimeout(this.timer)
    this.timer = null
    await this.save(true)
  }

  private async save(keepalive = false): Promise<void> {
    if (!this.id || this.status.kind === 'conflict') return

    this.timer = null
    this.setStatus({ kind: 'saving' })

    try {
      const saved = await api<{ updatedAt: string }>(
        `/api/workspaces/${encodeURIComponent(this.id)}`,
        {
          method: 'PUT',
          keepalive,
          body: JSON.stringify({ data: snapshotLocal(), baseUpdatedAt: this.baseUpdatedAt }),
        },
      )
      this.baseUpdatedAt = saved.updatedAt
      this.setStatus({ kind: 'saved', at: saved.updatedAt })
    } catch (error) {
      const status = (error as { status?: number }).status
      if (status === 409) {
        // Дарж бичихээс татгалзсан — хэрэглэгч дахин ачаалах хүртэл зогсоно.
        this.setStatus({ kind: 'conflict' })
        return
      }
      this.setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Хадгалж чадсангүй.',
      })
    }
  }
}

export const workspaceSync = new WorkspaceSync()
