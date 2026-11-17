import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { LoginGate } from './components/share/LoginGate'
import {
  fetchConfig,
  loadCompanyData,
  logout,
  clearCompanyDataCache,
  type WorkspaceConfig,
} from './services/workspaceSync'
import './styles/global.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root элемент олдсонгүй')

const root = createRoot(container)

const LOCAL_ONLY: WorkspaceConfig = {
  sharingEnabled: false,
  authEnabled: false,
  emailEnabled: false,
  authenticated: false,
  reason: 'Сервертэй холбогдож чадсангүй.',
  user: null,
  companies: [],
}

function renderApp(config: WorkspaceConfig) {
  root.render(
    <StrictMode>
      <App user={config.user} onLogout={handleLogout} />
    </StrictMode>,
  )
}

async function handleLogout(): Promise<void> {
  await logout().catch(() => undefined)
  window.location.assign('/')
}

function renderError(message: string) {
  root.render(
    <StrictMode>
      <div className="login-gate">
        <div className="card login-gate__card">
          <h1 className="card__title">Нээж чадсангүй</h1>
          <p className="card__subtitle">{message}</p>
          <div className="login-gate__actions">
            <a className="btn btn--primary" href="/">
              Нүүр хуудас руу
            </a>
          </div>
        </div>
      </div>
    </StrictMode>,
  )
}

/**
 * Компонентууд useState-ийн эхний утгаа LocalStorage-оос уншдаг тул
 * хуваалцсан өгөгдлийг render хийхээс ӨМНӨ буулгаж дуусгах ёстой.
 */
async function bootstrap(): Promise<void> {
  clearCompanyDataCache()
  const config = await fetchConfig().catch(() => LOCAL_ONLY)
  const resetToken = new URLSearchParams(window.location.search).get('token')

  if (window.location.pathname === '/reset-password' && resetToken) {
    root.render(
      <StrictMode>
        <LoginGate authEnabled={config.authEnabled} companies={config.companies} reason={config.reason} resetToken={resetToken} onSuccess={() => void bootstrap()} />
      </StrictMode>,
    )
    return
  }

  if (!config.authEnabled || !config.authenticated || !config.user) {
    root.render(
      <StrictMode>
        <LoginGate
          authEnabled={config.authEnabled}
          emailEnabled={config.emailEnabled}
          companies={config.companies}
          reason={config.reason}
          onSuccess={() => void bootstrap()}
        />
      </StrictMode>,
    )
    return
  }

  try {
    await loadCompanyData()
    renderApp(config)
  } catch (error) {
    renderError(error instanceof Error ? error.message : 'Хуваалцсан өгөгдлийг татаж чадсангүй.')
  }
}

void bootstrap()
