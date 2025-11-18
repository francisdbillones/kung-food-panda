import { IncomingMessage, ServerResponse } from 'http'
import knex from '../models/knexfile'
import { ADMIN_ID, SESSION_COOKIE } from '../config'
import { readBody, sendJson, parseCookies } from '../lib/http'
import { buildAuthCookieHeader, createSessionRecord, deleteSession, getSessionFromRequest } from '../services/sessionService'

export async function handleCustomerLogin(request: IncomingMessage, response: ServerResponse) {
  const body = await readBody<{ customerId?: number }>(request)
  const { customerId } = body

  if (!customerId) {
    sendJson(response, 400, { error: 'Customer ID is required.' })
    return
  }

  const client = await knex('Client').where('client_id', customerId).first()
  if (!client) {
    sendJson(response, 401, { error: 'Unknown customer ID.' })
    return
  }

  const payload = {
    role: 'customer' as const,
    customerId: client.client_id,
    firstName: client.first_name,
    lastName: client.last_name,
    loyaltyPoints: client.loyalty_points
  }

  const { token } = await createSessionRecord('customer', String(client.client_id), payload)
  sendJson(response, 200, { line: `Welcome back, ${client.first_name}!`, profile: payload }, {
    'Set-Cookie': buildAuthCookieHeader(token)
  })
}

export async function handleFarmerLogin(request: IncomingMessage, response: ServerResponse) {
  const body = await readBody<{ farmId?: number }>(request)
  const { farmId } = body

  if (!farmId) {
    sendJson(response, 400, { error: 'Farm ID is required.' })
    return
  }

  const farm = await knex('Farm').where('farm_id', farmId).first()
  if (!farm) {
    sendJson(response, 401, { error: 'Unknown farm ID.' })
    return
  }

  const payload = {
    role: 'farmer' as const,
    farmId: farm.farm_id,
    locationId: farm.location_id
  }

  const { token } = await createSessionRecord('farmer', String(farm.farm_id), payload)
  sendJson(response, 200, { line: 'Farmer authenticated.', profile: payload }, {
    'Set-Cookie': buildAuthCookieHeader(token)
  })
}

export async function handleAdminLogin(request: IncomingMessage, response: ServerResponse) {
  const body = await readBody<{ adminId?: string }>(request)
  const { adminId } = body

  if (!adminId) {
    sendJson(response, 400, { error: 'Admin ID is required.' })
    return
  }

  if (adminId !== ADMIN_ID) {
    sendJson(response, 401, { error: 'Invalid admin ID.' })
    return
  }

  const payload = {
    role: 'admin' as const,
    adminId
  }

  const { token } = await createSessionRecord('admin', adminId, payload)
  sendJson(response, 200, { line: 'Admin access granted.', profile: payload }, {
    'Set-Cookie': buildAuthCookieHeader(token)
  })
}

export async function handleSessionRead(request: IncomingMessage, response: ServerResponse) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    sendJson(response, 401, { error: 'No active session.' })
    return
  }

  sendJson(response, 200, { line: 'Session active.', profile: session.data })
}

export async function handleLogout(request: IncomingMessage, response: ServerResponse) {
  const cookies = parseCookies(request.headers.cookie)
  const token = cookies[SESSION_COOKIE]
  if (token) {
    await deleteSession(token)
  }
  sendJson(response, 200, { line: 'Logged out.' }, {
    'Set-Cookie': buildAuthCookieHeader('', 0)
  })
}
