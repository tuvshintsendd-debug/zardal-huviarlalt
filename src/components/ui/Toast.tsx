import { useEffect } from 'react'

export interface ToastMessage {
  id: number
  kind: 'success' | 'error' | 'info'
  text: string
  details?: string[]
}

interface ToastProps {
  toast: ToastMessage | null
  onDismiss: () => void
}

const ICONS: Record<ToastMessage['kind'], string> = {
  success: '✓',
  error: '!',
  info: 'i',
}

/** Дэлгэцийн баруун доод буланд гарах мэдэгдэл */
export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(onDismiss, toast.details?.length ? 12000 : 4000)
    return () => window.clearTimeout(timeout)
  }, [toast, onDismiss])

  if (!toast) return null

  return (
    <div className={`toast toast--${toast.kind}`} role="status">
      <span className="toast__icon">{ICONS[toast.kind]}</span>
      <div className="toast__body">
        <p className="toast__text">{toast.text}</p>
        {toast.details && toast.details.length > 0 && (
          <ul className="toast__details">
            {toast.details.slice(0, 6).map((detail, index) => (
              <li key={index}>{detail}</li>
            ))}
            {toast.details.length > 6 && <li>… бусад {toast.details.length - 6} алдаа</li>}
          </ul>
        )}
      </div>
      <button type="button" className="toast__close" onClick={onDismiss} aria-label="Хаах">
        ×
      </button>
    </div>
  )
}
