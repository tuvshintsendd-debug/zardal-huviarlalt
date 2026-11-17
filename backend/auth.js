import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { getAuthVersion, isConfigured } from './db.js'

const COOKIE_NAME = 'azh_session'
const SESSION_DAYS = 1
const scrypt = promisify(scryptCallback)
const companies = [
  { id: 'monos-pharm', name: 'Монос фарм ХХК' },
  { id: 'monos-group', name: 'Монос групп ХХК' },
  { id: 'monos-ulaanbaatar', name: 'Монос Улаанбаатар ХХК' },
]

// SESSION_SECRET өгөөгүй бол процесс дахин эхлэхэд бүх session хүчингүй
// болно — аюулгүй боловч тав тухгүй тул panel-д тохируулахыг зөвлөнө.
const secret = process.env.SESSION_SECRET || randomBytes(32).toString('hex')

function sign(value) {
  return createHmac('sha256', secret).update(value).digest('hex')
}

function safeEqual(a, b) {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  if (bufferA.length !== bufferB.length) return false
  return timingSafeEqual(bufferA, bufferB)
}

export function companyById(id) {
  return companies.find((company) => company.id === id) ?? null
}

export function listCompanies() {
  return companies
}

export async function hashPassword(value) {
  const salt = randomBytes(16).toString('hex')
  const derived = await scrypt(value, salt, 64)
  return `${salt}:${Buffer.from(derived).toString('hex')}`
}

export async function verifyPassword(value, stored) {
  if (typeof value !== 'string' || value.length > 1024 || typeof stored !== 'string') return false
  const [salt, expectedHex] = stored.split(':')
  if (!salt || !expectedHex) return false
  const derived = Buffer.from(await scrypt(value, salt, 64))
  const expected = Buffer.from(expectedHex, 'hex')
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

export function createToken(user) {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  const payload = Buffer.from(JSON.stringify({
    userId: user.id ?? user.userId,
    companyId: user.companyId,
    email: user.email,
    mustChangePassword: user.mustChangePassword,
    authVersion: user.authVersion ?? 0,
    expiresAt,
  })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function sessionFromToken(token) {
  if (typeof token !== 'string') return false
  const [payload, signature] = token.split('.')
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return session.expiresAt > Date.now() && companyById(session.companyId) ? session : null
  } catch {
    return null
  }
}

export function isValidToken(token) {
  return Boolean(sessionFromToken(token))
}

function parseCookies(header) {
  const jar = {}
  if (!header) return jar
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    jar[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim())
  }
  return jar
}

export function readSession(req) {
  return parseCookies(req.headers.cookie)[COOKIE_NAME] ?? ''
}

/**
 * HTTPS дор Secure тавина. Локал dev нь http://localhost дээр ажилладаг ба
 * тэнд Secure cookie-г browser хүлээж авахгүй тул зөвхөн proxy-оос https
 * гэж ирсэн үед нэмнэ.
 */
function cookieFlags(req) {
  return `HttpOnly; Path=/; SameSite=Lax${req.protocol === 'https' ? '; Secure' : ''}`
}

export function setSessionCookie(req, res, token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; ${cookieFlags(req)}; Max-Age=${maxAge}`)
}

export function clearSessionCookie(req, res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; ${cookieFlags(req)}; Max-Age=0`)
}

/** Хамгаалалттай endpoint-үүдийн өмнө тавих шалгуур */
export async function requireAuth(req, res, next) {
  const session = sessionFromToken(readSession(req))
  if (!session || !isConfigured) {
    res.status(401).json({ error: 'Нэвтрэх шаардлагатай.' })
    return
  }
  try {
    const authVersion = await getAuthVersion(session.userId, session.companyId)
    if (authVersion === null || authVersion !== session.authVersion) {
      res.status(401).json({ error: 'Нэвтрэх шаардлагатай.' })
      return
    }
    req.user = session
    next()
  } catch (error) {
    next(error)
  }
}
