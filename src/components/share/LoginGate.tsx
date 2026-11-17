import { useState, type FormEvent } from 'react'
import {
  login,
  register,
  requestPasswordReset,
  resetPassword,
  type CompanyOption,
} from '../../services/workspaceSync'

interface LoginGateProps {
  /** Нэвтэрсний дараа дуудагдана — дуудагч тал өгөгдлөө дахин ачаална. */
  onSuccess: () => void
  onCancel?: () => void
  message?: string
  companies?: CompanyOption[]
  authEnabled?: boolean
  emailEnabled?: boolean
  reason?: string | null
  resetToken?: string | null
}

type Mode = 'login' | 'register' | 'forgot' | 'reset-password'

export function LoginGate({
  onSuccess,
  onCancel,
  message,
  companies = [],
  authEnabled = true,
  emailEnabled = true,
  reason,
  resetToken,
}: LoginGateProps) {
  const [mode, setMode] = useState<Mode>(resetToken ? 'reset-password' : 'login')
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)
    setNotice(null)

    try {
      if (mode === 'register') {
        const result = await register(companyId, email)
        setNotice(result.message)
        setMode('login')
      } else if (mode === 'forgot') {
        const result = await requestPasswordReset(companyId, email)
        setNotice(result.message)
      } else if (mode === 'reset-password') {
        if (password !== confirmPassword) throw new Error('Нууц үгийн баталгаажуулалт таарахгүй байна.')
        await resetPassword(resetToken ?? '', password)
        setNotice('Нууц үг шинэчлэгдлээ. Одоо нэвтэрнэ үү.')
        setMode('login')
        setPassword('')
        window.history.replaceState(null, '', '/')
      } else {
        await login(companyId, email, password)
        onSuccess()
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Үйлдэл амжилтгүй.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const title = mode === 'register'
    ? 'Бүртгэл үүсгэх'
    : mode === 'forgot'
      ? 'Нууц үг сэргээх'
      : mode === 'reset-password'
          ? 'Нууц үг шинэчлэх'
          : 'Нэвтрэх'
  const needsPassword = mode === 'login' || mode === 'reset-password'
  const needsConfirmation = mode === 'reset-password'
  const canSubmit = mode === 'register' || mode === 'forgot'
    ? Boolean(companyId && email.trim())
    : mode === 'login'
      ? Boolean(companyId && email.trim() && password)
      : Boolean(password && password.length >= 12 && confirmPassword)

  return (
    <div className="login-gate">
      <form className="card login-gate__card" onSubmit={handleSubmit}>
        <h1 className="card__title">Ашиглалтын зардал хуваарилах</h1>
        <p className="card__subtitle">
          {message ?? title}
        </p>

        {mode !== 'reset-password' && (
          <label className="login-gate__field">
            <span>Компани</span>
            <select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
        )}

        {mode !== 'reset-password' && (
          <label className="login-gate__field">
            <span>Имэйл</span>
            <input
              type="email"
              value={email}
              autoComplete="email"
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
        )}

        {needsPassword && <label className="login-gate__field">
          <span>{mode === 'login' ? 'Нууц үг' : 'Шинэ нууц үг'}</span>
          <input
            type="password"
            value={password}
            autoFocus={mode === 'login'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={mode === 'login' ? undefined : 12}
            required
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>}

        {needsConfirmation && <label className="login-gate__field">
          <span>Нууц үг давтах</span>
          <input
            type="password"
            value={confirmPassword}
            autoComplete="new-password"
            minLength={12}
            required
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </label>}

        {!authEnabled && <div className="allocation-warning" role="status">{reason ?? 'Нэвтрэлтийн сервер тохируулагдаагүй байна.'}</div>}

        {error && (
          <div className="allocation-warning" role="alert">
            {error}
          </div>
        )}
        {notice && <div className="login-gate__notice" role="status">{notice}</div>}

        <div className="login-gate__actions">
          {onCancel && (
            <button type="button" className="btn btn--secondary" onClick={onCancel}>
              Болих
            </button>
          )}
          <button type="submit" className="btn btn--primary" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? 'Түр хүлээнэ үү…' : title}
          </button>
        </div>
        {mode === 'login' && authEnabled && emailEnabled && <div className="login-gate__links">
          <button type="button" className="btn btn--secondary" onClick={() => { setMode('register'); setError(null); setNotice(null) }}>Бүртгэл үүсгэх</button>
          <button type="button" className="btn btn--secondary" onClick={() => { setMode('forgot'); setError(null); setNotice(null) }}>Нууц үгээ мартсан уу?</button>
        </div>}
        {(mode === 'register' || mode === 'forgot') && <button type="button" className="login-gate__back" onClick={() => { setMode('login'); setError(null); setNotice(null) }}>Нэвтрэх хэсэг рүү буцах</button>}
      </form>
    </div>
  )
}
