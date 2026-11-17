import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginGate } from './LoginGate'

const authMocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  setFirstPassword: vi.fn(),
}))

vi.mock('../../services/workspaceSync', () => authMocks)

const companies = [
  { id: 'monos-pharm', name: 'Монос фарм ХХК' },
  { id: 'monos-group', name: 'Монос групп ХХК' },
  { id: 'monos-ulaanbaatar', name: 'Монос Улаанбаатар ХХК' },
]

describe('LoginGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logs in with the selected company, email and password', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    authMocks.login.mockResolvedValue({ ok: true })
    render(<LoginGate companies={companies} onSuccess={onSuccess} />)

    await user.selectOptions(screen.getByLabelText('Компани'), 'monos-group')
    await user.type(screen.getByLabelText('Имэйл'), 'staff@example.mn')
    await user.type(screen.getByLabelText('Нууц үг'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Нэвтрэх' }))

    await waitFor(() => expect(authMocks.login).toHaveBeenCalledWith(
      'monos-group', 'staff@example.mn', 'correct-password',
    ))
    expect(onSuccess).toHaveBeenCalledOnce()
  })

  it('keeps login clickable when the server is not configured', async () => {
    const user = userEvent.setup()
    authMocks.login.mockRejectedValue(new Error('Нэвтрэлтийн сервер бүрэн тохируулагдаагүй байна.'))
    render(
      <LoginGate
        authEnabled={false}
        reason="DATABASE_URL тохируулаагүй байна."
        companies={companies}
        onSuccess={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText('Имэйл'), 'staff@example.mn')
    await user.type(screen.getByLabelText('Нууц үг'), 'correct-password')
    const submit = screen.getByRole('button', { name: 'Нэвтрэх' })
    expect((submit as HTMLButtonElement).disabled).toBe(false)
    await user.click(submit)

    await waitFor(() => expect(authMocks.login).toHaveBeenCalledOnce())
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Нэвтрэлтийн сервер бүрэн тохируулагдаагүй байна.',
    )
  })

  it('sends registration and shows the temporary-password notice', async () => {
    const user = userEvent.setup()
    authMocks.register.mockResolvedValue({ ok: true, message: 'Түр нууц үгийг имэйлээр илгээлээ.' })
    render(<LoginGate companies={companies} onSuccess={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Бүртгэл үүсгэх' }))
    await user.selectOptions(screen.getByLabelText('Компани'), 'monos-ulaanbaatar')
    await user.type(screen.getByLabelText('Имэйл'), 'new@example.mn')
    fireEvent.submit(screen.getByRole('button', { name: 'Бүртгэл үүсгэх' }).closest('form')!)

    await waitFor(() => expect(authMocks.register).toHaveBeenCalledWith(
      'monos-ulaanbaatar', 'new@example.mn',
    ))
    expect((await screen.findByRole('status')).textContent).toContain('Түр нууц үгийг имэйлээр илгээлээ.')
  })

  it('requests a password-reset link for the selected company and email', async () => {
    const user = userEvent.setup()
    authMocks.requestPasswordReset.mockResolvedValue({ ok: true, message: 'Хэрэв бүртгэл таарсан бол холбоос илгээгдлээ.' })
    render(<LoginGate companies={companies} onSuccess={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Нууц үгээ мартсан уу?' }))
    await user.type(screen.getByLabelText('Имэйл'), 'staff@example.mn')
    await user.click(screen.getByRole('button', { name: 'Нууц үг сэргээх' }))

    await waitFor(() => expect(authMocks.requestPasswordReset).toHaveBeenCalledWith(
      'monos-pharm', 'staff@example.mn',
    ))
    expect((await screen.findByRole('status')).textContent).toContain('Хэрэв бүртгэл таарсан бол холбоос илгээгдлээ.')
  })
})