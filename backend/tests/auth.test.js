import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createToken,
  hashPassword,
  sessionFromToken,
  verifyPassword,
} from '../auth.js'

test('passwords are stored as salted scrypt hashes', async () => {
  const password = 'correct horse battery staple'
  const stored = await hashPassword(password)

  assert.notEqual(stored, password)
  assert.match(stored, /^[a-f0-9]{32}:[a-f0-9]{128}$/)
  assert.equal(await verifyPassword(password, stored), true)
  assert.equal(await verifyPassword('wrong password', stored), false)
})

test('session tokens are signed and contain the selected company', () => {
  const token = createToken({
    id: 'user-id',
    companyId: 'monos-pharm',
    email: 'user@example.mn',
    mustChangePassword: false,
  })

  assert.deepEqual(sessionFromToken(token), {
    userId: 'user-id',
    companyId: 'monos-pharm',
    email: 'user@example.mn',
    mustChangePassword: false,
    authVersion: 0,
    expiresAt: sessionFromToken(token).expiresAt,
  })
  assert.equal(sessionFromToken(`${token.slice(0, -1)}x`), null)
})