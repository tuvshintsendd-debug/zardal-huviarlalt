import { randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import pg from 'pg'

const { Pool } = pg
const here = dirname(fileURLToPath(import.meta.url))

// Тохиргоогүй үед апп унахгүй — зүгээр л хуваалцах горим унтарч, өмнөх шигээ
// зөвхөн browser-ийн LocalStorage дээр ажиллана.
const connectionString = process.env.DATABASE_URL ?? ''

/** Дотоод сүлжээний Postgres ихэвчлэн SSL-гүй; sslmode=require бичсэн үед л асаана. */
function sslConfig(url) {
  if (!url.includes('sslmode=require') && !url.includes('sslmode=verify')) return false
  return { rejectUnauthorized: false }
}

export const pool = connectionString
  ? new Pool({ connectionString, ssl: sslConfig(connectionString), max: 5 })
  : null

const sqlitePath = process.env.AUTH_SQLITE_PATH || resolve(here, '..', '.local', 'azh.sqlite')
if (!pool) mkdirSync(dirname(sqlitePath), { recursive: true })
const sqlite = pool ? null : new DatabaseSync(sqlitePath)

export const isConfigured = Boolean(pool || sqlite)

function querySqlite(sql, params = []) {
  const normalized = sql
    .replace(/\bnow\(\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/\$(\d+)/g, '?$1')
  const statement = sqlite.prepare(normalized)
  if (/^\s*(select|with)\b/i.test(normalized) || /\breturning\b/i.test(normalized)) {
    const rows = statement.all(...params)
    return { rows, rowCount: rows.length }
  }
  const result = statement.run(...params)
  return { rows: [], rowCount: Number(result.changes) }
}

async function query(sql, params = []) {
  return pool ? pool.query(sql, params) : querySqlite(sql, params)
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export async function initSchema() {
  if (sqlite) {
    sqlite.exec(`
      create table if not exists app_users (
        id text primary key,
        company_id text not null,
        email text not null,
        password_hash text not null,
        must_change_password integer not null default 1,
        auth_version integer not null default 0,
        reset_token_hash text,
        reset_expires_at text,
        created_at text not null default current_timestamp,
        unique (company_id, email)
      );
      create table if not exists company_data (
        company_id text primary key,
        data text not null default '{}',
        updated_at text not null default current_timestamp
      );
      create table if not exists workspaces (
        id text primary key,
        company_id text,
        data text not null,
        updated_at text not null default current_timestamp
      );
    `)
    return
  }
  await pool.query(`
    create table if not exists app_users (
      id text primary key,
      company_id text not null,
      email text not null,
      password_hash text not null,
      must_change_password boolean not null default true,
      auth_version integer not null default 0,
      reset_token_hash text,
      reset_expires_at timestamptz,
      created_at timestamptz not null default now(),
      unique (company_id, email)
    );
    create table if not exists company_data (
      company_id text primary key,
      data jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );
    create table if not exists workspaces (
      id text primary key,
      company_id text,
      data jsonb not null,
      updated_at timestamptz not null default now()
    );
    alter table workspaces add column if not exists company_id text;
    alter table app_users add column if not exists auth_version integer not null default 0;
  `)
}

export async function findUser(companyId, email) {
  const result = await query(
    'select id, company_id, email, password_hash, must_change_password, auth_version from app_users where company_id = $1 and email = $2',
    [companyId, email],
  )
  return result.rows[0] ?? null
}

export async function createUser({ id, companyId, email, passwordHash }) {
  await query(
    'insert into app_users (id, company_id, email, password_hash) values ($1, $2, $3, $4)',
    [id, companyId, email, passwordHash],
  )
}

export async function enableInitialUserLogin(id) {
  await query(
    'update app_users set must_change_password = false, auth_version = auth_version + 1 where id = $1 and must_change_password = true',
    [id],
  )
}

export async function deleteUser(id) {
  await query('delete from app_users where id = $1', [id])
}

export async function setPassword(id, passwordHash) {
  const result = await query(
    'update app_users set password_hash = $2, must_change_password = false, auth_version = auth_version + 1, reset_token_hash = null, reset_expires_at = null where id = $1 returning auth_version',
    [id, passwordHash],
  )
  return Number(result.rows[0].auth_version)
}

export async function revokeUserSessions(id) {
  await query('update app_users set auth_version = auth_version + 1 where id = $1', [id])
}

export async function setResetToken(id, tokenHash, expiresAt) {
  await query(
    'update app_users set reset_token_hash = $2, reset_expires_at = $3 where id = $1',
    [id, tokenHash, expiresAt],
  )
}

export async function findUserByResetToken(tokenHash) {
  const result = await query(
    'select id, company_id, email from app_users where reset_token_hash = $1 and reset_expires_at > now()',
    [tokenHash],
  )
  return result.rows[0] ?? null
}

export async function getCompanyData(companyId) {
  const result = await query('select data, updated_at from company_data where company_id = $1', [companyId])
  if (!result.rowCount) return { data: {}, updatedAt: null }
  const data = typeof result.rows[0].data === 'string'
    ? JSON.parse(result.rows[0].data)
    : result.rows[0].data
  return { data, updatedAt: toIso(result.rows[0].updated_at) }
}

export async function putCompanyData(companyId, data) {
  const result = await query(
    `insert into company_data (company_id, data, updated_at) values ($1, $2, now())
     on conflict (company_id) do update set data = excluded.data, updated_at = now()
     returning updated_at`,
    [companyId, JSON.stringify(data)],
  )
  return { updatedAt: toIso(result.rows[0].updated_at) }
}

export async function getAuthVersion(userId, companyId) {
  const result = await query(
    'select auth_version from app_users where id = $1 and company_id = $2',
    [userId, companyId],
  )
  return result.rowCount ? Number(result.rows[0].auth_version) : null
}

/** Линкэнд харагдах богино id — андуурахааргүй тэмдэгтүүд (0/O, 1/l байхгүй) */
function newWorkspaceId() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = randomBytes(10)
  let id = ''
  for (const byte of bytes) id += alphabet[byte % alphabet.length]
  return id
}

export async function createWorkspace(data) {
  const id = newWorkspaceId()
  const result = await query(
    'insert into workspaces (id, data) values ($1, $2) returning updated_at',
    [id, JSON.stringify(data)],
  )
  return { id, updatedAt: result.rows[0].updated_at.toISOString() }
}

export async function getWorkspace(id) {
  const result = await query('select data, updated_at from workspaces where id = $1', [id])
  if (result.rowCount === 0) return null
  return {
    data: typeof result.rows[0].data === 'string' ? JSON.parse(result.rows[0].data) : result.rows[0].data,
    updatedAt: toIso(result.rows[0].updated_at),
  }
}

/**
 * Хадгалах. baseUpdatedAt өгсөн бол зөвхөн сервер дээрх хувилбар түүнтэй
 * таарч байвал бичнэ — өөр хүн зэрэг засаж байсан бол дарж бичихгүй.
 */
export async function putWorkspace(id, data, baseUpdatedAt) {
  const params = [id, JSON.stringify(data)]
  let sql = 'update workspaces set data = $2, updated_at = now() where id = $1'

  if (baseUpdatedAt) {
    params.push(baseUpdatedAt)
    sql += ' and updated_at = $3'
  }

  const result = await query(`${sql} returning updated_at`, params)
  if (result.rowCount === 0) return null
  return { updatedAt: toIso(result.rows[0].updated_at) }
}
