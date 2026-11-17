import 'dotenv/config'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import {
  clearSessionCookie,
  companyById,
  createToken,
  hashPassword,
  listCompanies,
  readSession,
  requireAuth,
  setSessionCookie,
  sessionFromToken,
  verifyPassword,
} from './auth.js'
import {
  createUser,
  deleteUser,
  enableInitialUserLogin,
  findUser,
  findUserByResetToken,
  getAuthVersion,
  getCompanyData,
  initSchema,
  isConfigured,
  putCompanyData,
  revokeUserSessions,
  setPassword,
  setResetToken,
} from './db.js'

const here = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(here, '..', 'dist')
const port = Number(process.env.PORT ?? 3000)

const emailApiKey = process.env.RESEND_API_KEY ?? ''
const emailFrom = process.env.AUTH_EMAIL_FROM ?? ''
const publicAppUrl = (process.env.AUTH_PUBLIC_URL ?? '').replace(/\/$/, '')
const isAllowedPublicUrl = publicAppUrl.startsWith('https://') ||
  (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost(?::\d+)?$/.test(publicAppUrl))
const emailConfigured = Boolean(emailApiKey && emailFrom && isAllowedPublicUrl && process.env.SESSION_SECRET)
const configuredProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? (process.env.NODE_ENV === 'production' ? '1' : '0'))
let authEnabled = false
let emailEnabled = false

const app = express()
app.use(express.json({ limit: '10mb' }))

app.set('trust proxy', Number.isInteger(configuredProxyHops) && configuredProxyHops > 0
  ? configuredProxyHops
  : false)

const authAttempts = new Map()
function limitAuthAttempts(req, res, next) {
  const now = Date.now()
  const attempt = authAttempts.get(req.ip)
  if (!attempt || attempt.resetAt <= now) {
    authAttempts.set(req.ip, { count: 1, resetAt: now + 15 * 60 * 1000 })
    next()
    return
  }
  attempt.count += 1
  if (attempt.count > 12) {
    res.status(429).json({ error: 'Хэт олон оролдлого хийсэн тул 15 минутын дараа дахин оролдоно уу.' })
    return
  }
  next()
}

app.get('/api/config', async (req, res, next) => {
  try {
    let session = sessionFromToken(readSession(req))
    if (session) {
      const authVersion = await getAuthVersion(session.userId, session.companyId)
      if (authVersion === null || authVersion !== session.authVersion) {
        clearSessionCookie(req, res)
        session = null
      }
    }
    res.json({
      sharingEnabled: false,
      authEnabled,
      emailEnabled,
      authenticated: authEnabled && Boolean(session),
      user: session ? {
        email: session.email,
        companyId: session.companyId,
        companyName: companyById(session.companyId).name,
        mustChangePassword: session.mustChangePassword,
      } : null,
      companies: listCompanies(),
      reason: authEnabled
        ? null
        : !isConfigured
          ? 'Өгөгдлийн сан тохируулагдаагүй байна.'
          : 'SESSION_SECRET тохируулаагүй байна.',
    })
  } catch (error) {
    next(error)
  }
})

function requireAuthSetup(req, res, next) {
  if (!authEnabled) {
    res.status(503).json({ error: 'Нэвтрэлтийн сервер бүрэн тохируулагдаагүй байна.' })
    return
  }
  next()
}

function requireEmailSetup(req, res, next) {
  if (!authEnabled || !emailEnabled) {
    res.status(503).json({ error: 'Имэйл илгээх үйлчилгээ тохируулагдаагүй байна.' })
    return
  }
  next()
}

async function sendEmail(to, subject, html) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${emailApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: emailFrom, to: [to], subject, html }),
  })
  if (!response.ok) throw new Error('Имэйл илгээж чадсангүй.')
}

app.post('/api/auth/register', requireEmailSetup, limitAuthAttempts, async (req, res, next) => {
  try {
    const company = companyById(req.body?.companyId)
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    if (!company || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Компани болон зөв имэйл хаяг оруулна уу.' })
      return
    }
    if (await findUser(company.id, email)) {
      res.status(409).json({ error: 'Энэ компанид уг имэйл бүртгэлтэй байна.' })
      return
    }

    const user = { id: randomUUID(), companyId: company.id, email, mustChangePassword: true }
    const temporaryPassword = randomBytes(9).toString('base64url')
    await createUser({ ...user, passwordHash: await hashPassword(temporaryPassword) })
    try {
      await sendEmail(email, 'Монос системийн түр нууц үг',
        `<p>${company.name} системд бүртгүүлэх түр нууц үг:</p><p><strong>${temporaryPassword}</strong></p><p>Нэвтэрсний дараа шинэ нууц үг тохируулна уу.</p>`)
    } catch (error) {
      await deleteUser(user.id)
      throw error
    }
    res.status(201).json({ ok: true, message: 'Түр нууц үгийг имэйлээр илгээлээ.' })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/login', requireAuthSetup, limitAuthAttempts, async (req, res, next) => {
  try {
    const company = companyById(req.body?.companyId)
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const user = company ? await findUser(company.id, email) : null
    if (!user || !(await verifyPassword(req.body?.password, user.password_hash))) {
      res.status(401).json({ error: 'Имэйл эсвэл нууц үг буруу байна.' })
      return
    }
    const sessionUser = {
      id: user.id,
      companyId: user.company_id,
      email: user.email,
      mustChangePassword: user.must_change_password,
      authVersion: Number(user.auth_version),
    }
    setSessionCookie(req, res, createToken(sessionUser))
    res.json({ ok: true, user: sessionUser })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/forgot', requireEmailSetup, limitAuthAttempts, async (req, res, next) => {
  try {
    const company = companyById(req.body?.companyId)
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const user = company ? await findUser(company.id, email) : null
    if (user) {
      const token = randomBytes(32).toString('base64url')
      await setResetToken(user.id, createHash('sha256').update(token).digest('hex'), new Date(Date.now() + 30 * 60 * 1000))
      const link = `${publicAppUrl}/reset-password?token=${encodeURIComponent(token)}`
      await sendEmail(email, 'Нууц үг шинэчлэх холбоос',
        `<p>Нууц үг шинэчлэхийн тулд дараах холбоосыг 30 минутын дотор нээнэ үү:</p><p><a href="${link}">Нууц үг шинэчлэх</a></p>`)
    }
    res.json({ ok: true, message: 'Хэрэв бүртгэл таарсан бол шинэчлэх холбоос имэйлээр илгээгдлээ.' })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/reset', requireEmailSetup, limitAuthAttempts, async (req, res, next) => {
  try {
    const token = req.body?.token
    const password = req.body?.password
    if (typeof token !== 'string' || typeof password !== 'string' || password.length < 12 || password.length > 1024) {
      res.status(400).json({ error: 'Холбоос хүчингүй эсвэл нууц үг 12-оос доош тэмдэгт байна.' })
      return
    }
    const user = await findUserByResetToken(createHash('sha256').update(token).digest('hex'))
    if (!user) {
      res.status(400).json({ error: 'Холбоос хүчингүй эсвэл хугацаа дууссан байна.' })
      return
    }
    await setPassword(user.id, await hashPassword(password))
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/logout', requireAuthSetup, requireAuth, async (req, res, next) => {
  try {
    await revokeUserSessions(req.user.userId)
    clearSessionCookie(req, res)
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

app.get('/api/company-data', requireAuthSetup, requireAuth, async (req, res, next) => {
  try {
    res.json(await getCompanyData(req.user.companyId))
  } catch (error) {
    next(error)
  }
})

app.put('/api/company-data', requireAuthSetup, requireAuth, async (req, res, next) => {
  try {
    const data = req.body?.data
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      res.status(400).json({ error: 'data объект байх ёстой.' })
      return
    }
    res.json(await putCompanyData(req.user.companyId, data))
  } catch (error) {
    next(error)
  }
})

if (existsSync(distDir)) {
  app.use(express.static(distDir))
  // SPA fallback — /w/<id> зэрэг клиент талын зам бүр index.html-ээр нээгдэнэ.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(join(distDir, 'index.html'))
  })
}

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ error: 'Серверийн алдаа гарлаа.' })
})

async function start() {
  if (isConfigured) {
    try {
      await initSchema()
      const initialUsers = JSON.parse(process.env.AUTH_INITIAL_USERS ?? '[]')
      for (const initialUser of initialUsers) {
        const company = companyById(initialUser.companyId)
        const email = String(initialUser.email ?? '').trim().toLowerCase()
        if (!company || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !initialUser.passwordHash) continue
        let account = await findUser(company.id, email)
        if (!account) {
          await createUser({
            id: randomUUID(),
            companyId: company.id,
            email,
            passwordHash: initialUser.passwordHash,
          })
          account = await findUser(company.id, email)
        }
        if (account) await enableInitialUserLogin(account.id)
      }
      authEnabled = Boolean(process.env.SESSION_SECRET)
      emailEnabled = authEnabled && emailConfigured
    } catch (error) {
      // Схем үүсгэж чадаагүй ч сайтыг унагахгүй — статик апп ажиллаж байг.
      console.error('Postgres схем үүсгэж чадсангүй:', error)
      authEnabled = false
    }
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Апп ${port} порт дээр ажиллаж байна.`)
    if (!authEnabled) {
      console.warn('Нэвтрэлт идэвхгүй: SESSION_SECRET тохируулна уу.')
    } else if (!emailEnabled) {
      console.warn('Имэйлээр бүртгэл/нууц үг сэргээх унтраалттай: RESEND_API_KEY, AUTH_EMAIL_FROM, AUTH_PUBLIC_URL тохируулна уу.')
    }
  })
}

void start()
