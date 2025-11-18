import { IncomingMessage, ServerResponse } from 'http'
import crypto from 'crypto'
import knex from '../models/knexfile'
import { LOGIN_REDIRECT_PATHS, ROLE_DEFAULT_ROUTES, SESSION_COOKIE, SESSION_TABLE, SESSION_TTL_MS } from '../config'
import { buildSessionCookie, parseCookies, sendJson } from '../lib/http'

export type UserRole = 'customer' | 'farmer' | 'admin'

export interface BaseSessionData {
  role: UserRole
  [key: string]: unknown
}

export interface SessionRecord {
  token: string
  data: BaseSessionData
  expiresAt: Date
}

export async function ensureSessionTable(): Promise<void> {
  const exists = await knex.schema.hasTable(SESSION_TABLE)
  if (!exists) {
    await knex.schema.createTable(SESSION_TABLE, (table) => {
      table.string('token', 64).primary()
      table.string('user_type', 20).notNullable()
      table.string('user_identifier', 191).notNullable()
      table.text('session_data').notNullable()
      table.timestamp('created_at').defaultTo(knex.fn.now())
      table.timestamp('expires_at').notNullable()
    })
  }
}

export async function cleanupExpiredSessions(): Promise<void> {
  const now = new Date()
  try {
    await knex(SESSION_TABLE).where('expires_at', '<', now).delete()
  } catch (error) {
    console.error('Failed to clean sessions', error)
  }
}

export async function createSessionRecord(userType: UserRole, identifier: string, sessionData: BaseSessionData): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await knex(SESSION_TABLE).insert({
    token,
    user_type: userType,
    user_identifier: identifier,
    session_data: JSON.stringify(sessionData),
    expires_at: expiresAt
  })
  return { token, expiresAt }
}

export async function fetchSession(token?: string): Promise<SessionRecord | null> {
  if (!token) return null
  const record = await knex(SESSION_TABLE).where('token', token).first()
  if (!record) return null
  const expires = new Date(record.expires_at)
  if (expires < new Date()) {
    await knex(SESSION_TABLE).where('token', token).delete()
    return null
  }
  return {
    token: record.token,
    data: JSON.parse(record.session_data),
    expiresAt: expires
  }
}

export async function deleteSession(token?: string): Promise<void> {
  if (!token) return
  await knex(SESSION_TABLE).where('token', token).delete()
}

export async function getSessionFromRequest(request: IncomingMessage): Promise<SessionRecord | null> {
  const cookies = parseCookies(request.headers.cookie)
  return fetchSession(cookies[SESSION_COOKIE])
}

export async function requireSession(request: IncomingMessage, response: ServerResponse, role?: UserRole): Promise<SessionRecord | null> {
  const session = await getSessionFromRequest(request)
  if (!session) {
    sendJson(response, 401, { error: 'Authentication required.' })
    return null
  }
  if (role && session.data.role !== role) {
    sendJson(response, 403, { error: 'Forbidden.' })
    return null
  }
  return session
}

export async function redirectLoggedInUsers(request: IncomingMessage, response: ServerResponse, pathname: string): Promise<boolean> {
  if (!LOGIN_REDIRECT_PATHS.has(pathname)) {
    return false
  }
  const session = await getSessionFromRequest(request)
  if (!session) {
    return false
  }
  const destination = session.data.role ? ROLE_DEFAULT_ROUTES[String(session.data.role)] : null
  if (!destination) {
    return false
  }
  response.writeHead(302, {
    Location: destination,
    'Cache-Control': 'no-store'
  })
  response.end()
  return true
}

export function buildAuthCookieHeader(token: string, maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000)): string {
  return buildSessionCookie(token, maxAgeSeconds)
}
